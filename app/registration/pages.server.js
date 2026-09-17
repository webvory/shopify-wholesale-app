import { redirect } from "react-router";
import { Prisma } from "@prisma/client";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import {
  createTemplate,
  defaultSettings,
  defaultStyling,
  validateConfiguration,
  validateDraftConfiguration,
} from "./schema.js";
import {
  assertAdminOrigin,
  assertSettings,
  failure,
  limitedFormData,
} from "./common.server.js";
import { emailConfigured } from "./email.server.js";

const notFound = () =>
  new Response("Registration page not found", { status: 404 });
export async function listLoader({ request }) {
  const { session } = await authenticate.admin(request);
  const pages = await db.registrationPage.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      handle: true,
      publishedHandle: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      revision: true,
    },
  });
  return { pages, shop: session.shop };
}
export async function templatesLoader({ request }) {
  await authenticate.admin(request);
  return {};
}
export async function editorLoader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const page = await db.registrationPage.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!page) throw notFound();
  return { page, shop: session.shop, emailConfigured: emailConfigured() };
}
function validatePage(page, draft = false) {
  const errors = [];
  if (
    typeof page.name !== "string" ||
    !page.name.trim() ||
    page.name.length > 120
  )
    errors.push("Page name is required (maximum 120 characters).");
  if (
    typeof page.handle !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.handle) ||
    page.handle.length > 100
  )
    errors.push(
      "Handle must contain lowercase letters, numbers and single hyphens.",
    );
  errors.push(
    ...(draft
      ? validateDraftConfiguration(page.configuration)
      : validateConfiguration(page.configuration)),
    ...assertSettings(page.settings, page.styling),
  );
  return errors;
}
const snapshot = (page) => ({
  name: page.name,
  configuration: page.configuration,
  styling: page.styling,
  settings: page.settings,
});
async function unusedHandle(shop, base) {
  const stem =
    (base || "wholesale-registration")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "wholesale-registration";
  let handle = stem;
  for (
    let n = 2;
    await db.registrationPage.findUnique({
      where: { shop_handle: { shop, handle } },
      select: { id: true },
    });
    n++
  )
    handle = `${stem}-${n}`;
  return handle;
}
export async function listAction({ request }) {
  const { session } = await authenticate.admin(request);
  assertAdminOrigin(request);
  const form = await limitedFormData(request);
  const intent = form.get("intent");
  const shop = session.shop;
  try {
    if (intent === "create") {
      const name = String(form.get("name") || "Wholesale Registration")
        .trim()
        .slice(0, 120);
      const configuration = createTemplate(
        String(form.get("templateId") || "blank"),
      );
      const page = await db.registrationPage.create({
        data: {
          shop,
          name,
          handle: await unusedHandle(shop, form.get("handle") || name),
          configuration,
          styling: structuredClone(defaultStyling),
          settings: structuredClone(defaultSettings),
        },
      });
      return redirect(`/app/registration-pages/${page.id}`);
    }
    const page = await db.registrationPage.findFirst({
      where: { shop, id: String(form.get("id") || "") },
    });
    if (!page) throw notFound();
    if (intent === "duplicate") {
      const duplicate = await db.registrationPage.create({
        data: {
          shop,
          name: `${page.name.slice(0, 110)} (copy)`,
          handle: await unusedHandle(shop, `${page.handle}-copy`),
          configuration: page.configuration,
          styling: page.styling,
          settings: page.settings,
        },
      });
      return redirect(`/app/registration-pages/${duplicate.id}`);
    }
    if (intent === "delete") {
      await db.registrationPage.deleteMany({ where: { id: page.id, shop } });
      return { ok: true };
    }
    if (!["publish", "unpublish"].includes(intent))
      return failure("Unknown action.");
    const errors = intent === "publish" ? validatePage(page) : [];
    if (errors.length) return failure(errors.join(" "), 400, { errors });
    const updated = await db.registrationPage.updateMany({
      where: { id: page.id, shop, revision: page.revision },
      data: {
        status: intent === "publish" ? "published" : "unpublished",
        revision: { increment: 1 },
        publishedHandle: intent === "publish" ? page.handle : null,
        publishedSnapshot:
          intent === "publish" ? snapshot(page) : Prisma.DbNull,
        ...(intent === "publish" ? { publishedAt: new Date() } : {}),
      },
    });
    if (!updated.count)
      return failure("This page changed. Reload before publishing.", 409);
    return { ok: true };
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error.code === "P2002")
      return failure("That handle is already used. Choose another.", 409);
    return failure(error.message || "Unable to update page.");
  }
}
export async function editorAction({ request, params }) {
  const { session } = await authenticate.admin(request);
  assertAdminOrigin(request);
  const form = await limitedFormData(request);
  const intent = form.get("intent");
  if (!["save", "publish", "unpublish"].includes(intent))
    return failure("Unknown action.");
  let input;
  try {
    input = JSON.parse(String(form.get("payload")));
  } catch {
    return failure("Invalid page configuration.");
  }
  if (!input || !Number.isSafeInteger(input.revision))
    return failure("Missing page revision.");
  const existing = await db.registrationPage.findFirst({
    where: { shop: session.shop, id: params.id },
  });
  if (!existing) throw notFound();
  if (existing.revision !== input.revision)
    return failure(
      "This page changed in another window. Reload before saving.",
      409,
      { conflict: true },
    );
  // Drafts may be incomplete; validate structure on save, strict configuration on publish.
  const draftErrors = validatePage(input, intent !== "publish");
  if (draftErrors.length)
    return failure(draftErrors.join(" "), 400, { errors: draftErrors });
  try {
    const page = await db.$transaction(async (tx) => {
      const result = await tx.registrationPage.updateMany({
        where: { id: params.id, shop: session.shop, revision: input.revision },
        data: {
          name: input.name.trim(),
          handle: input.handle,
          configuration: input.configuration,
          styling: input.styling,
          settings: input.settings,
          revision: { increment: 1 },
          ...(intent === "publish"
            ? {
                status: "published",
                publishedHandle: input.handle,
                publishedSnapshot: snapshot(input),
                publishedAt: new Date(),
              }
            : {}),
          ...(intent === "unpublish"
            ? {
                status: "unpublished",
                publishedHandle: null,
                publishedSnapshot: Prisma.DbNull,
              }
            : {}),
        },
      });
      if (!result.count)
        throw new Error("Revision conflict. Reload before saving.");
      return tx.registrationPage.findFirst({
        where: { id: params.id, shop: session.shop },
      });
    });
    return { ok: true, page };
  } catch (error) {
    if (error.code === "P2002")
      return failure("That handle is already used. Choose another.", 409);
    return failure(error.message || "Unable to save page.", 409);
  }
}
