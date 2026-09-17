import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createServer } from "vite";
import {
  createTemplate,
  createField,
  allFields,
  defaultSettings,
  defaultStyling,
} from "../app/registration/schema.js";
import {
  signFormToken,
  verifyFormToken,
  escapeHtml,
} from "../app/registration/security.server.js";
import { validateUpload } from "../app/registration/files.server.js";
import { buildMappings } from "../app/registration/mapping.js";

let server, db, pages, submissions, applications, files, integration;
const shopA = "registration-a.myshopify.com",
  shopB = "registration-b.myshopify.com";
const unwrap = (result) => result.data || result;
const request = (
  shop,
  fields,
  url = "http://localhost/app/registration-pages",
) => {
  const headers = { "x-test-shop": shop };
  if (!fields) return new Request(url, { headers });
  headers.origin = "http://localhost";
  const body = new FormData();
  for (const [key, value] of Object.entries(fields))
    body.set(key, String(value));
  return new Request(url, { method: "POST", headers, body });
};
before(async () => {
  process.env.SHOPIFY_API_KEY = "integration-test";
  process.env.SHOPIFY_API_SECRET = "integration-test-secret-not-production";
  process.env.SHOPIFY_APP_URL = "http://localhost";
  delete process.env.SMTP_HOST;
  const directory = await mkdtemp(path.join(tmpdir(), "registration-test-"));
  const databasePath = path.join(directory, "test.sqlite");
  db = new PrismaClient({
    datasources: { db: { url: `file:${databasePath.replaceAll("\\", "/")}` } },
  });
  for (const migration of (await readdir("prisma/migrations"))
    .filter((name) => /^\d/.test(name))
    .sort()) {
    const sql = await readFile(
      `prisma/migrations/${migration}/migration.sql`,
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean))
      await db.$executeRawUnsafe(statement);
  }
  global.prismaGlobal = db;
  server = await createServer({
    configFile: false,
    cacheDir: path.join(directory, "vite-cache"),
    server: { middlewareMode: true },
    appType: "custom",
  });
  const shopify = await server.ssrLoadModule("/app/shopify.server.js");
  shopify.authenticate.admin = async (req) => {
    const shop = req.headers.get("x-test-shop");
    if (![shopA, shopB].includes(shop))
      throw new Response("Unauthorized", { status: 401 });
    return {
      session: { shop },
      admin: {
        graphql: async () => {
          throw new Error("No live Shopify calls permitted in tests");
        },
      },
    };
  };
  pages = await server.ssrLoadModule("/app/registration/pages.server.js");
  submissions = await server.ssrLoadModule(
    "/app/registration/submission.server.js",
  );
  applications = await server.ssrLoadModule(
    "/app/registration/applications.server.js",
  );
  files = await server.ssrLoadModule(
    "/app/routes/app.application-files.$id.jsx",
  );
  integration = await server.ssrLoadModule(
    "/app/registration/shopify-integration.server.js",
  );
});
after(async () => {
  await server?.close();
  await db?.$disconnect();
  delete global.prismaGlobal;
});

async function makePage(shop = shopA) {
  const configuration = createTemplate("blank");
  const email = createField("contact_email"),
    company = createField("company_name"),
    file = createField("file_upload");
  // Library keys may use the canonical basic file field.
  file.type = "file";
  file.name = "document";
  file.required = false;
  file.settings = { maxFiles: 1, maxFileSizeMB: 1 };
  file.dataDestination = { type: "application" };
  configuration.sections[0].rows[0].columns[0].fields = [company, email, file];
  const settings = structuredClone(defaultSettings);
  const handle = `wholesale-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return db.registrationPage.create({
    data: {
      shop,
      name: "Test wholesale",
      handle,
      configuration,
      styling: defaultStyling,
      settings,
    },
  });
}

test("shop boundaries protect page read/write/list, applications and private files", async () => {
  const page = await makePage();
  await assert.rejects(
    pages.editorLoader({ request: request(shopB), params: { id: page.id } }),
    (error) => error.status === 404,
  );
  await assert.rejects(
    pages.listAction({
      request: request(shopB, { intent: "delete", id: page.id }),
    }),
    (error) => error.status === 404,
  );
  assert.equal(
    unwrap(await pages.listLoader({ request: request(shopB) })).pages.length,
    0,
  );
  await assert.rejects(
    pages.listLoader({ request: request("not-authenticated") }),
    (error) => error.status === 401,
  );
  const application = await db.wholesaleApplication.create({
    data: {
      shop: shopA,
      pageName: page.name,
      submittedData: {},
      configurationSnapshot: page.configuration,
      settingsSnapshot: page.settings,
    },
  });
  const file = await db.applicationFile.create({
    data: {
      shop: shopA,
      applicationId: application.id,
      fieldId: "document",
      filename: "secret.pdf",
      mimeType: "application/pdf",
      size: 5,
      data: Buffer.from("%PDF-"),
    },
  });
  await assert.rejects(
    applications.applicationLoader({
      request: request(shopB),
      params: { id: application.id },
    }),
    (error) => error.status === 404,
  );
  await assert.rejects(
    files.loader({ request: request(shopB), params: { id: file.id } }),
    (error) => error.status === 404,
  );
  const response = await files.loader({
    request: request(shopA),
    params: { id: file.id },
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition"), /^attachment/);
});

test("draft persistence, optimistic conflict, publish snapshot, unpublish", async () => {
  const page = await makePage();
  const edit = async (intent, payload) =>
    unwrap(
      await pages.editorAction({
        request: request(shopA, { intent, payload: JSON.stringify(payload) }),
        params: { id: page.id },
      }),
    );
  const published = await edit("publish", page);
  assert.equal(published.ok, true, published.error);
  assert.equal(published.page.status, "published");
  const draft = structuredClone(published.page);
  draft.configuration.title = "Unpublished revision";
  draft.handle += "-draft";
  const saved = await edit("save", draft);
  assert.equal(saved.ok, true, saved.error);
  assert.notEqual(
    saved.page.publishedSnapshot.configuration.title,
    draft.configuration.title,
  );
  assert.equal(saved.page.publishedHandle, page.handle);
  const conflict = await edit("save", draft);
  assert.equal(conflict.conflict, true);
  const reloaded = await pages.editorLoader({
    request: request(shopA),
    params: { id: page.id },
  });
  assert.equal(reloaded.page.configuration.title, draft.configuration.title);
  assert.equal(
    (await edit("unpublish", saved.page)).page.status,
    "unpublished",
  );
});

test("published submission validates server-side, creates private application, consumes nonce once", async () => {
  let page = await makePage();
  const published = unwrap(
    await pages.editorAction({
      request: request(shopA, {
        intent: "publish",
        payload: JSON.stringify(page),
      }),
      params: { id: page.id },
    }),
  );
  assert.equal(published.ok, true, published.error);
  page = published.page;
  const token = signFormToken({
    shop: shopA,
    pageId: page.id,
    handle: page.handle,
    publishedAt: page.publishedAt.toISOString(),
  });
  const url = `http://localhost/registration/${page.handle}?token=${token}`;
  const loaded = unwrap(
    await submissions.publicLoader({
      request: new Request(url),
      params: { handle: page.handle },
    }),
  );
  assert.ok(!allFields(loaded.configuration)[0].dataDestination);
  const fields = allFields(page.configuration);
  const body = () => {
    const form = new FormData();
    form.set("nonce", loaded.nonce);
    form.set(`field_${fields[0].id}`, "Acme");
    form.set(`field_${fields[1].id}`, "buyer@example.com");
    return form;
  };
  const submit = (form, origin = "http://localhost") =>
    submissions.publicAction({
      request: new Request(url, {
        method: "POST",
        headers: { origin },
        body: form,
      }),
      params: { handle: page.handle },
    });
  await assert.rejects(
    submit(body(), "https://evil.example"),
    (error) => error.status === 403,
  );
  const invalid = body();
  invalid.set(`field_${fields[1].id}`, "bad email");
  assert.ok(unwrap(await submit(invalid)).errors[fields[1].id]);
  const poisoned = body();
  poisoned.set("website_confirmation", "bot");
  assert.ok(unwrap(await submit(poisoned)).error);
  const form = body();
  form.set(
    `field_${fields[2].id}`,
    new File(["%PDF-1.7\nprivate"], "certificate.pdf", {
      type: "application/pdf",
    }),
  );
  assert.equal(unwrap(await submit(form)).ok, true);
  assert.ok(unwrap(await submit(body())).error);
  const application = await db.wholesaleApplication.findFirst({
    where: { shop: shopA, registrationPageId: page.id },
    include: { files: true },
  });
  assert.equal(application.status, "pending");
  assert.equal(application.companyName, "Acme");
  assert.equal(application.files.length, 1);
  assert.deepEqual(
    Object.keys(application.submittedData[fields[2].id][0]).sort(),
    ["filename", "id", "mimeType", "size"],
  );
  await assert.rejects(
    submissions.publicLoader({
      request: new Request(url.replace(token, `${token}x`)),
      params: { handle: page.handle },
    }),
    (error) => error.status === 403,
  );
});

test("file magic, token tampering and forged mapping shapes are rejected", async () => {
  assert.equal(escapeHtml('{{ shop.name }}'), '&#123;&#123; shop.name &#125;&#125;');
  await assert.rejects(
    validateUpload(
      new File(["not a pdf"], "forged.pdf", { type: "application/pdf" }),
      { settings: {} },
    ),
    /contents/,
  );
  const token = signFormToken({
    shop: shopA,
    pageId: "a",
    handle: "test",
    publishedAt: "today",
  });
  assert.throws(
    () => verifyFormToken(token, "another"),
    (error) => error.status === 403,
  );
  const config = createTemplate("blank"),
    field = createField("number");
  field.dataDestination = {
    type: "company_metafield",
    namespace: "wholesale",
    key: "amount",
    metafieldType: "number_integer",
  };
  config.sections[0].rows[0].columns[0].fields = [field];
  assert.throws(
    () => buildMappings(config, { [field.id]: "wrong" }),
    /number_integer/,
  );
});

test("review transitions queue notifications and expose an unconfigured transport without losing state", async () => {
  const page = await makePage();
  const settings = structuredClone(page.settings);
  settings.emails.information.enabled = true;
  const application = await db.wholesaleApplication.create({
    data: {
      shop: shopA,
      pageName: page.name,
      email: "buyer@example.com",
      submittedData: {},
      configurationSnapshot: page.configuration,
      settingsSnapshot: settings,
    },
  });
  const result = unwrap(
    await applications.applicationAction({
      request: request(shopA, {
        intent: "information",
        version: 1,
        note: "Please provide your resale certificate.",
      }),
      params: { id: application.id },
    }),
  );
  assert.equal(result.ok, true, result.error);
  const updated = await db.wholesaleApplication.findFirst({
    where: { shop: shopA, id: application.id },
  });
  assert.equal(updated.status, "information_required");
  const notification = await db.emailNotification.findFirst({
    where: { shop: shopA, applicationId: application.id },
  });
  assert.equal(notification.status, "failed");
  assert.match(notification.error, /not configured/);
  assert.match(notification.body, /resale certificate/);
});

test("store rate limit persists across calls and forged shop tokens cannot read another form", async () => {
  const security = await server.ssrLoadModule(
    "/app/registration/security.server.js",
  );
  await security.enforceRate(db, shopA, "test-rate", 2);
  await security.enforceRate(db, shopA, "test-rate", 2);
  await assert.rejects(
    security.enforceRate(db, shopA, "test-rate", 2),
    (error) => error.status === 429,
  );
  await security.enforceRate(db, shopB, "test-rate", 2);
  const page = await makePage();
  const token = signFormToken({
    shop: shopB,
    pageId: page.id,
    handle: page.handle,
    publishedAt: new Date().toISOString(),
  });
  await assert.rejects(
    submissions.publicLoader({
      request: new Request(
        `http://localhost/registration/${page.handle}?token=${token}`,
      ),
      params: { handle: page.handle },
    }),
    (error) => error.status === 404,
  );
});

test("approval API error preserves pending status and records error instead of reporting approved", async () => {
  const page = await makePage();
  const application = await db.wholesaleApplication.create({
    data: {
      shop: shopA,
      pageName: page.name,
      email: "buyer@example.com",
      submittedData: {},
      configurationSnapshot: page.configuration,
      settingsSnapshot: page.settings,
    },
  });
  const result = unwrap(
    await applications.applicationAction({
      request: request(shopA, { intent: "approve", version: 1 }),
      params: { id: application.id },
    }),
  );
  assert.ok(result.error);
  const saved = await db.wholesaleApplication.findFirst({
    where: { id: application.id, shop: shopA },
  });
  assert.equal(saved.status, "pending");
  assert.ok(saved.integrationError);
  assert.equal(saved.processingAt, null);
});

test("B2B workflow creates relationships, applies catalog/terms and retries without recreating records", async () => {
  const configuration = createTemplate("blank");
  configuration.sections[0].rows[0].columns[0].fields = [];
  const application = {
    id: "application-test",
    companyName: "Acme",
    email: "buyer@example.com",
    configurationSnapshot: configuration,
    submittedData: {},
    settingsSnapshot: {
      approval: {
        mode: "b2b",
        catalogId: "12",
        paymentTermsTemplateId: "13",
        customerTag: "wholesale",
      },
    },
    integrationState: {},
  };
  const calls = [];
  const resultFor = (query) => {
    if (query.includes("RegistrationCustomerSearch"))
      return { customers: { nodes: [] } };
    if (query.includes("RegistrationCustomerCreate"))
      return {
        customerCreate: {
          customer: { id: "gid://shopify/Customer/1" },
          userErrors: [],
        },
      };
    if (query.includes("RegistrationCustomer("))
      return { customer: { id: "gid://shopify/Customer/1" } };
    if (query.includes("RegistrationB2BAccess"))
      return { companies: { nodes: [] } };
    if (query.includes("RegistrationCompanyCreate"))
      return {
        companyCreate: {
          company: {
            id: "gid://shopify/Company/2",
            defaultRole: { id: "gid://shopify/CompanyContactRole/5" },
          },
          userErrors: [],
        },
      };
    if (query.includes("RegistrationCompany("))
      return {
        company: {
          id: "gid://shopify/Company/2",
          defaultRole: { id: "gid://shopify/CompanyContactRole/5" },
        },
      };
    if (query.includes("RegistrationLocationCreate"))
      return {
        companyLocationCreate: {
          companyLocation: { id: "gid://shopify/CompanyLocation/3" },
          userErrors: [],
        },
      };
    if (query.includes("RegistrationLocation("))
      return {
        companyLocation: {
          id: "gid://shopify/CompanyLocation/3",
          company: { id: "gid://shopify/Company/2" },
        },
      };
    if (query.includes("RegistrationContacts("))
      return {
        company: { contacts: { nodes: [], pageInfo: { hasNextPage: false } } },
      };
    if (query.includes("RegistrationCompanyContact"))
      return {
        companyAssignCustomerAsContact: {
          companyContact: { id: "gid://shopify/CompanyContact/4" },
          userErrors: [],
        },
      };
    if (query.includes("RegistrationExistingRoles"))
      return {
        companyContact: {
          company: { id: "gid://shopify/Company/2" },
          customer: { id: "gid://shopify/Customer/1" },
          roleAssignments: { nodes: [], pageInfo: { hasNextPage: false } },
        },
      };
    for (const [operation, mutation] of [
      ["RegistrationContactRole", "companyContactAssignRole"],
      ["RegistrationCatalog", "catalogContextUpdate"],
      ["RegistrationTerms", "companyLocationUpdate"],
      ["RegistrationTags", "tagsAdd"],
    ])
      if (query.includes(operation)) return { [mutation]: { userErrors: [] } };
    throw new Error(`Unexpected GraphQL query ${query}`);
  };
  const admin = {
    graphql: async (query, options) => {
      calls.push({ query, options });
      return Response.json({ data: resultFor(query) });
    },
  };
  const persist = async (patch) =>
    Object.assign(application, structuredClone(patch));
  const ids = await integration.integrateApplication(
    admin,
    application,
    {},
    persist,
  );
  assert.equal(ids.companyLocationId, "gid://shopify/CompanyLocation/3");
  assert.equal(ids.companyContactId, "gid://shopify/CompanyContact/4");
  assert.ok(calls.some((call) => call.query.includes("RegistrationCatalog")));
  await integration.integrateApplication(admin, application, {}, persist);
  assert.equal(
    calls.filter((call) => call.query.includes("RegistrationCompanyCreate"))
      .length,
    1,
  );
  assert.equal(
    calls.filter((call) => call.query.includes("RegistrationLocationCreate"))
      .length,
    1,
  );
  assert.equal(
    calls.filter((call) => call.query.includes("RegistrationCustomerCreate"))
      .length,
    1,
  );
});
