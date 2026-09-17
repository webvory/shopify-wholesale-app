import db from "../db.server";
import { authenticate } from "../shopify.server";
import {
  assertAdminOrigin,
  failure,
  limitedFormData,
} from "./common.server.js";
import {
  deliverNotifications,
  emailConfigured,
  queueNotification,
} from "./email.server.js";
import { integrateApplication } from "./shopify-integration.server.js";

const statuses = [
  "pending",
  "under_review",
  "information_required",
  "approved",
  "rejected",
  "on_hold",
];
export async function applicationsLoader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").slice(0, 200);
  const status = url.searchParams.get("status");
  const registrationPageId = url.searchParams.get("registrationPageId");
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1") || 1),
  );
  const where = {
    shop: session.shop,
    ...(statuses.includes(status) ? { status } : {}),
    ...(registrationPageId ? { registrationPageId } : {}),
    ...(search
      ? {
          OR: [
            { companyName: { contains: search } },
            { applicantName: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };
  const [applications, pages] = await Promise.all([
    db.wholesaleApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 26,
      skip: (page - 1) * 25,
      select: {
        id: true,
        companyName: true,
        applicantName: true,
        email: true,
        country: true,
        pageName: true,
        status: true,
        createdAt: true,
      },
    }),
    db.registrationPage.findMany({
      where: { shop: session.shop },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    applications: applications.slice(0, 25),
    pages,
    hasMore: applications.length > 25,
    page,
  };
}
export async function applicationLoader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const application = await db.wholesaleApplication.findFirst({
    where: { shop: session.shop, id: params.id },
  });
  if (!application)
    throw new Response("Application not found", { status: 404 });
  const [files, notifications] = await Promise.all([
    db.applicationFile.findMany({
      where: { shop: session.shop, applicationId: application.id },
      select: {
        id: true,
        fieldId: true,
        filename: true,
        mimeType: true,
        size: true,
      },
    }),
    db.emailNotification.findMany({
      where: { shop: session.shop, applicationId: application.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    application,
    files,
    notifications,
    emailConfigured: emailConfigured(),
  };
}
export async function applicationAction({ request, params }) {
  const { session, admin } = await authenticate.admin(request);
  assertAdminOrigin(request);
  const form = await limitedFormData(request);
  const application = await db.wholesaleApplication.findFirst({
    where: { shop: session.shop, id: params.id },
  });
  if (!application)
    throw new Response("Application not found", { status: 404 });
  const intent = form.get("intent");
  if (intent === "retry_email") {
    await deliverNotifications(session.shop, application.id);
    return { ok: true };
  }
  if (!["approve", "reject", "information", "hold", "review"].includes(intent))
    return failure("Unknown action.");
  const version = Number(form.get("version"));
  if (!Number.isSafeInteger(version) || version !== application.version)
    return failure("This application changed. Reload before continuing.", 409);
  if (application.status === "approved")
    return failure(
      "This application is already approved. Manage its customer or B2B access in Shopify.",
      409,
    );
  const note = String(form.get("note") || "").slice(0, 5000);
  const shop = session.shop;
  // Shopify calls time out after 20s. A ten-minute lease permits recovery after a process crash;
  // persisted unconfirmed-create markers still prevent repeating an uncertain remote creation.
  const claim = await db.wholesaleApplication.updateMany({
    where: {
      shop,
      id: application.id,
      version,
      OR: [
        { processingAt: null },
        { processingAt: { lt: new Date(Date.now() - 600000) } },
      ],
    },
    data: { processingAt: new Date(), version: { increment: 1 } },
  });
  if (!claim.count)
    return failure(
      "An action is already processing or this application changed. Reload to see its state.",
      409,
    );
  try {
    if (intent === "approve") {
      const options = Object.fromEntries(
        [
          "customerId",
          "companyId",
          "companyLocationId",
          "catalogId",
          "paymentTermsTemplateId",
        ].map((key) => [key, String(form.get(key) || "").trim()]),
      );
      await integrateApplication(admin, application, options, async (patch) => {
        await db.wholesaleApplication.updateMany({
          where: { shop, id: application.id },
          data: patch,
        });
      });
    }
    const status = {
      approve: "approved",
      reject: "rejected",
      information: "information_required",
      hold: "on_hold",
      review: "under_review",
    }[intent];
    await db.$transaction(async (tx) => {
      await tx.wholesaleApplication.updateMany({
        where: { shop, id: application.id },
        data: {
          status,
          adminNote: note,
          integrationError: null,
          processingAt: null,
        },
      });
      const updated = await tx.wholesaleApplication.findFirst({
        where: { shop, id: application.id },
      });
      const event = {
        approve: "approved",
        reject: "rejected",
        information: "information",
      }[intent];
      if (event) await queueNotification(tx, updated, event, note);
    });
    await deliverNotifications(shop, application.id);
    return { ok: true };
  } catch (error) {
    const message =
      error.message || "Unable to complete the action. Please retry.";
    await db.wholesaleApplication.updateMany({
      where: { shop, id: application.id },
      data: { processingAt: null, integrationError: message.slice(0, 2000) },
    });
    return failure(message);
  }
}
