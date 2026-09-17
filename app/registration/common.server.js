import { data } from "react-router";

export const MAX_JSON_BYTES = 512 * 1024;
export function failure(error, status = 400, extra = {}) {
  return data({ error, ...extra }, { status });
}
export async function limitedFormData(request, limit = MAX_JSON_BYTES) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > limit)
    throw new Response("Request too large", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new FormData();
  const chunks = [];
  let size = 0;
  for (let reading = true; reading; ) {
    const { done, value } = await reader.read();
    if (done) {
      reading = false;
      continue;
    }
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Response("Request too large", { status: 413 });
    }
    chunks.push(value);
  }
  try {
    return await new Response(new Blob(chunks), {
      headers: {
        "Content-Type":
          request.headers.get("content-type") ||
          "application/x-www-form-urlencoded",
      },
    }).formData();
  } catch {
    throw new Response("Invalid form body", { status: 400 });
  }
}
export const validEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function safeHttpUrl(value, allowRelative = false) {
  if (!value) return true;
  if (allowRelative && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value))
    return true;
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function assertAdminOrigin(request) {
  // Shopify authenticates session tokens; additionally reject cross-origin form POSTs.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new Response("Invalid request origin", { status: 403 });
  }
}
export function assertSettings(settings, styling) {
  const errors = [];
  if (!settings || typeof settings !== "object" || Array.isArray(settings))
    return ["Invalid submission settings."];
  if (!styling || typeof styling !== "object" || Array.isArray(styling))
    return ["Invalid styling settings."];
  if (!safeHttpUrl(settings.successRedirectUrl, true))
    errors.push("Success URL must be an HTTP(S) URL or local path.");
  if (settings.adminEmail && !validEmail(settings.adminEmail))
    errors.push("Enter a valid admin email address.");
  if (
    settings.approval &&
    !["customer", "b2b"].includes(settings.approval.mode)
  )
    errors.push("Invalid approval workflow.");
  for (const [event, template] of Object.entries(settings.emails || {})) {
    if (!["received", "approved", "rejected", "information"].includes(event)) {
      errors.push("Unknown email event.");
      continue;
    }
    if (!template || !["applicant", "admin", "both"].includes(template.to))
      errors.push("Choose an email recipient.");
    if (
      String(template?.subject || "").length > 200 ||
      /[\r\n]/.test(template?.subject || "")
    )
      errors.push(
        "Email subject must be a single line of up to 200 characters.",
      );
    if (String(template?.body || "").length > 10000)
      errors.push("Email body exceeds 10,000 characters.");
    if (
      template?.enabled &&
      ["admin", "both"].includes(template.to) &&
      !validEmail(settings.adminEmail)
    )
      errors.push("Admin email is required for admin notifications.");
  }
  for (const [key, value] of Object.entries(styling)) {
    if (
      typeof value === "string" &&
      (value.length > 100 || /[<>;{}]|url\s*\(/i.test(value))
    )
      errors.push(`Invalid style: ${key}.`);
  }
  return errors;
}
export function gid(value, type) {
  if (!value) return null;
  const id = String(value).trim();
  if (new RegExp(`^gid://shopify/${type}/[0-9]+$`).test(id)) return id;
  if (/^[0-9]+$/.test(id)) return `gid://shopify/${type}/${id}`;
  throw new Error(`Enter a valid Shopify ${type} ID.`);
}
