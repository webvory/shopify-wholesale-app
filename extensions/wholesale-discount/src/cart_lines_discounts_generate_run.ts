/*
========================================
SHOPIFY FUNCTION LOGIC
========================================
*/

export function cartLinesDiscountsGenerateRun(input: any) {
  
  /*
  STEP 1: Read config from metafield
  */
  const config = JSON.parse(
    input?.discount?.metafield?.value || "{}"
  );

  /*
  STEP 2: Get customer
  */
  const customer = input.cart?.buyerIdentity?.customer;

  if (!customer) {
    return {
      operations: []
    };
  }

  /*
  STEP 3: Map GraphQL flags to possible tag names
  */
  const potentialTags = [];
  if (customer.bronze) potentialTags.push("wholesale-bronze");
  if (customer.silver) potentialTags.push("wholesale-silver");
  if (customer.gold) potentialTags.push("wholesale-gold");
  if (customer.platinum) potentialTags.push("wholesale-platinum");
  if (customer.distributor) potentialTags.push("distributor");
  if (customer.vip) {
    potentialTags.push("vip");
    potentialTags.push("vip-wholesale");
  }
  if (customer.wholesale) potentialTags.push("wholesale");

  /*
  STEP 4: Find the maximum discount % matching the customer's tags
  */
  let percentage = 0;

  for (const tag of potentialTags) {
    if (config[tag]) {
      const val = Number(config[tag]);
      if (val > percentage) {
        percentage = val;
      }
    }
  }

  /*
  STEP 5: If no discount → return empty
  */
  if (!percentage) {
    return {
      operations: []
    };
  }

  /*
  STEP 6: Apply to all cart lines
  */
  const targets = input.cart.lines.map((line: any) => ({
    cartLine: {
      id: line.id,
      quantity: line.quantity
    },
  }));

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `${percentage}% OFF`,
              targets: targets,
              value: {
                percentage: {
                  value: percentage,
                },
              },
            },
          ],
          selectionStrategy: "FIRST",
        },
      },
    ],
  };
}