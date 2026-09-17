import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";

function secret() {
  const key =
    process.env.REGISTRATION_SIGNING_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!key) throw new Error("Registration signing secret is not configured.");
  return key;
}
export function signFormToken({ shop, pageId, handle, publishedAt }) {
  const payload = Buffer.from(
    JSON.stringify({
      shop,
      pageId,
      handle,
      publishedAt,
      exp: Date.now() + 60 * 60 * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyFormToken(token, handle) {
  if (typeof token !== "string" || token.length > 2048)
    throw new Response("Invalid form link", { status: 403 });
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra)
    throw new Response("Invalid form link", { status: 403 });
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Response("Invalid form link", { status: 403 });
  let result;
  try {
    result = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Response("Invalid form link", { status: 403 });
  }
  if (
    !Number.isFinite(result.exp) ||
    result.exp < Date.now() ||
    result.handle !== handle ||
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(result.shop)
  )
    throw new Response(
      "This form link expired. Reopen the registration page from the store.",
      { status: 403 },
    );
  return result;
}
export function newNonce() {
  return randomBytes(32).toString("hex");
}
export async function enforceRate(tx, shop, scope, limit, windowMs = 600000) {
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  const id = createHash("sha256")
    .update(`${shop}:${scope}:${start}`)
    .digest("hex");
  const rate = await tx.submissionRate.upsert({
    where: { id },
    create: { id, shop, windowStart: new Date(start) },
    update: { count: { increment: 1 } },
  });
  if (rate.count > limit)
    throw new Response("Too many requests. Please try again later.", {
      status: 429,
      headers: { "Retry-After": "600" },
    });
}
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"'{}]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "{": "&#123;", "}": "&#125;" })[
        c
      ],
  );
}
