import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  console.log("SHOP REDACT:", payload);

  return new Response(null, { status: 200 });
};
