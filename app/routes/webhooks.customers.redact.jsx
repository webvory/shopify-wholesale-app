import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  console.log("CUSTOMER REDACT:", payload);

  // Delete customer data from your DB

  return new Response(null, { status: 200 });
};
