import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response();
  }

  // The payload contains the Customer object ID
  const customerId = `gid://shopify/Customer/${payload.id}`;

  // Fetch accurate tags and current metafield from GraphQL
  const customerRes = await admin.graphql(`
    query($id: ID!) {
      customer(id: $id) {
        tags
        metafield(namespace: "wholesale_engine", key: "min_quantity") {
          value
        }
      }
    }
  `, { variables: { id: customerId } });

  const customerData = await customerRes.json();
  const customerNode = customerData.data?.customer;
  if (!customerNode) return new Response();

  const tags = customerNode.tags || [];
  const currentLimitValue = customerNode.metafield?.value;

  // Get all tag limits from DB
  const allLimits = await prisma.quantityLimit.findMany({
    where: { shop }
  });

  // Calculate the highest limit from the customer's tags
  let highestLimit = 1; // Default
  for (const rawTag of tags) {
    const t = rawTag.toLowerCase();
    const limitRecord = allLimits.find(l => l.tag.trim().toLowerCase() === t);
    if (limitRecord && limitRecord.limit > highestLimit) {
      highestLimit = limitRecord.limit;
    }
  }

  // Prevent infinite loops: only update if the limit actually changed
  if (highestLimit.toString() === currentLimitValue) {
    return new Response();
  }

  // Update the customer metafield
  try {
    const response = await admin.graphql(
      `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: customerId,
              namespace: "wholesale_engine",
              key: "min_quantity",
              value: highestLimit.toString(),
              type: "number_integer"
            }
          ]
        }
      }
    );

    const responseJson = await response.json();
    if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Failed to update customer metafield via webhook:", responseJson.data.metafieldsSet.userErrors);
    }
  } catch (error) {
    console.error("Error updating customer metafield in webhook:", error);
  }

  return new Response();
};
