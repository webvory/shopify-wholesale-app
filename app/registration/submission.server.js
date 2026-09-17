import { data } from "react-router";
import db from "../db.server";
import { allFields, validateSubmission } from "./schema.js";
import { limitedFormData } from "./common.server.js";
import { enforceRate, newNonce, verifyFormToken } from "./security.server.js";
import { validateUpload } from "./files.server.js";
import { queueNotification, deliverNotifications } from "./email.server.js";

const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function publishedForm(request, handle) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const signed = verifyFormToken(token, handle);
  const page = await db.registrationPage.findFirst({
    where: {
      id: signed.pageId,
      shop: signed.shop,
      publishedHandle: handle,
      status: "published",
    },
  });
  if (
    !page?.publishedSnapshot ||
    page.publishedAt?.toISOString() !== signed.publishedAt
  )
    throw new Response(
      "This form is no longer available. Reopen it from the store.",
      { status: 404 },
    );
  return { page, token };
}
export async function publicLoader({ request, params }) {
  const { page } = await publishedForm(request, params.handle);
  // Per-shop persistent cap, independent of untrusted forwarded IP headers.
  await enforceRate(db, page.shop, "form-load", 600);
  const nonce = newNonce();
  await db.submissionNonce.deleteMany({
    where: { shop: page.shop, expiresAt: { lt: new Date() } },
  });
  await db.submissionRate.deleteMany({
    where: {
      shop: page.shop,
      windowStart: { lt: new Date(Date.now() - 86400000) },
    },
  });
  await db.submissionNonce.create({
    data: {
      id: nonce,
      shop: page.shop,
      pageId: page.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const snapshot = page.publishedSnapshot;
  // Mapping destinations and private email settings are never sent to the public form.
  const configuration = structuredClone(snapshot.configuration);
  for (const field of allFields(configuration)) delete field.dataDestination;
  return data(
    {
      configuration,
      styling: snapshot.styling,
      nonce,
      success: {
        heading: snapshot.settings.successHeading,
        description: snapshot.settings.successDescription,
        buttonText: snapshot.settings.successButtonText,
        redirectUrl: snapshot.settings.successRedirectUrl,
      },
    },
    { headers },
  );
}
export function applicationSummary(configuration, values) {
  const fields = allFields(configuration);
  const byRole = (role) => {
    const field = fields.find(
      (field) => field.summaryRole === role && values[field.id] !== undefined,
    );
    return field ? String(values[field.id] ?? "") : "";
  };
  const byName = (...names) => {
    const field = fields.find(
      (field) => names.includes(field.name) && values[field.id] !== undefined,
    );
    return field ? String(values[field.id] ?? "") : "";
  };
  const byMapping = (type, key) => {
    const field = fields.find(
      (field) =>
        field.dataDestination?.type === type &&
        field.dataDestination.key === key &&
        values[field.id] !== undefined,
    );
    return field ? String(values[field.id] ?? "") : "";
  };
  return {
    companyName: (
      byRole("company") || byName("company_name", "store_name", "business_name")
    ).slice(0, 200),
    applicantName: [
      byRole("firstName") ||
        byMapping("customer", "firstName") ||
        byName("first_name"),
      byRole("lastName") ||
        byMapping("customer", "lastName") ||
        byName("last_name"),
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 200),
    email: (
      byRole("email") ||
      byMapping("customer", "email") ||
      byName("contact_email", "email", "business_email") ||
      String(values[fields.find((field) => field.type === "email")?.id] || "")
    ).slice(0, 254),
    country: (
      byRole("country") ||
      byMapping("address", "countryCode") ||
      byName("country")
    ).slice(0, 80),
  };
}
export async function publicAction({ request, params }) {
  const { page } = await publishedForm(request, params.handle);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Response("Invalid submission origin", { status: 403 });
  await enforceRate(db, page.shop, "submission", 100);
  const form = await limitedFormData(request, 22 * 1024 * 1024);
  if (String(form.get("website_confirmation") || ""))
    return data(
      { error: "Unable to accept this submission." },
      { status: 400, headers },
    );
  const nonce = String(form.get("nonce") || "");
  const issued = await db.submissionNonce.findFirst({
    where: {
      id: nonce,
      shop: page.shop,
      pageId: page.id,
      expiresAt: { gt: new Date() },
    },
  });
  if (!issued)
    return data(
      {
        error:
          "Your form session expired or was already submitted. Reload the page.",
      },
      { status: 409, headers },
    );
  const snapshot = page.publishedSnapshot;
  const input = {};
  for (const field of allFields(snapshot.configuration)) {
    const entries = form.getAll(`field_${field.id}`);
    if (["file", "checkboxGroup", "multiselect"].includes(field.type))
      input[field.id] = entries.filter(
        (entry) => typeof entry === "string" || entry.size > 0,
      );
    else if (field.type === "checkbox")
      input[field.id] = entries.length > 1 ? entries : (entries[0] ?? false);
    else input[field.id] = entries.length > 1 ? entries : (entries[0] ?? "");
  }
  const { values, errors } = validateSubmission(snapshot.configuration, input);
  const attachments = [];
  let totalBytes = 0;
  for (const field of allFields(snapshot.configuration).filter(
    (field) => field.type === "file",
  )) {
    const files = values[field.id];
    if (!files) continue;
    const references = [];
    for (const file of Array.isArray(files) ? files : [files]) {
      try {
        const attachment = await validateUpload(file, field);
        if (
          field.settings?.imagesOnly &&
          attachment.mimeType === "application/pdf"
        )
          throw new Error("Upload a JPG or PNG image.");
        totalBytes += attachment.size;
        if (totalBytes > 20 * 1024 * 1024)
          throw new Error("Total uploads must not exceed 20 MB.");
        const id = `file_${newNonce().slice(0, 24)}`;
        attachments.push({ id, fieldId: field.id, ...attachment });
        references.push({
          id,
          filename: attachment.filename,
          size: attachment.size,
          mimeType: attachment.mimeType,
        });
      } catch (error) {
        errors[field.id] = error.message;
      }
    }
    values[field.id] = references;
  }
  if (Object.keys(errors).length)
    return data(
      { errors, error: "Please correct the highlighted fields." },
      { status: 422, headers },
    );
  const summary = applicationSummary(snapshot.configuration, values);
  if (summary.email)
    await enforceRate(
      db,
      page.shop,
      `email:${summary.email.toLowerCase()}`,
      5,
      3600000,
    );
  const application = await db.$transaction(async (tx) => {
    const consumed = await tx.submissionNonce.deleteMany({
      where: {
        id: nonce,
        shop: page.shop,
        pageId: page.id,
        expiresAt: { gt: new Date() },
      },
    });
    if (!consumed.count)
      throw new Response("Already submitted. Reload the form to start again.", {
        status: 409,
      });
    // Publishing/unpublishing during a submission must not accept a stale form.
    const current = await tx.registrationPage.findFirst({
      where: {
        id: page.id,
        shop: page.shop,
        status: "published",
        publishedAt: page.publishedAt,
      },
    });
    if (!current)
      throw new Response("This form was updated. Reload it from the store.", {
        status: 409,
      });
    const result = await tx.wholesaleApplication.create({
      data: {
        shop: page.shop,
        registrationPageId: page.id,
        pageName: snapshot.name,
        submittedData: values,
        configurationSnapshot: snapshot.configuration,
        settingsSnapshot: snapshot.settings,
        ...summary,
      },
    });
    for (const attachment of attachments)
      await tx.applicationFile.create({
        data: { ...attachment, shop: page.shop, applicationId: result.id },
      });
    await queueNotification(tx, result, "received");
    return result;
  });
  await deliverNotifications(page.shop, application.id);
  return data({ ok: true }, { headers });
}
