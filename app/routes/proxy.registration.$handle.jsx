import { authenticate } from "../shopify.server";
import process from "node:process";
import db from "../db.server";
import { signFormToken, escapeHtml } from "../registration/security.server.js";

export async function loader({ request, params }) {
  const { session, liquid } = await authenticate.public.appProxy(request);
  if (!session)
    throw new Response("Store has not installed the app", { status: 403 });
  const page = await db.registrationPage.findFirst({
    where: {
      shop: session.shop,
      publishedHandle: params.handle,
      status: "published",
    },
  });
  if (!page?.publishedSnapshot)
    throw new Response("Registration page not found", { status: 404 });
  const token = signFormToken({
    shop: session.shop,
    pageId: page.id,
    handle: page.publishedHandle,
    publishedAt: page.publishedAt.toISOString(),
  });
  const appOrigin = new URL(process.env.SHOPIFY_APP_URL).origin;
  const src = `${appOrigin}/registration/${encodeURIComponent(page.publishedHandle)}?token=${encodeURIComponent(token)}`;
  // Only server-created values enter script; all HTML values escaped, no merchant Liquid evaluated.
  const iframeId = `wholesale-registration-${page.id}`;
  const body = `<iframe id="${escapeHtml(iframeId)}" title="${escapeHtml(page.name)}" src="${escapeHtml(src)}" style="display:block;width:100%;min-height:800px;border:0" referrerpolicy="no-referrer"></iframe>
  <script>(function(){var f=document.getElementById(${JSON.stringify(iframeId)});window.addEventListener('message',function(e){if(e.origin!==${JSON.stringify(appOrigin)}||e.source!==f.contentWindow)return;if(e.data&&e.data.type==='wholesale-form-height'&&Number.isFinite(e.data.height))f.style.height=Math.max(300,Math.min(40000,e.data.height))+'px';});})();</script>`;
  return liquid(body, { headers: { "Cache-Control": "no-store" } });
}
