import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const file = await db.applicationFile.findFirst({
    where: { shop: session.shop, id: params.id },
  });
  if (!file) throw new Response("Document not found", { status: 404 });
  return new Response(file.data, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="document.${file.mimeType === "application/pdf" ? "pdf" : file.mimeType === "image/png" ? "png" : "jpg"}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
