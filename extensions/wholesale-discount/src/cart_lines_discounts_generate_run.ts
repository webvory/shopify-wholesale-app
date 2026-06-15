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
    input?.discountNode?.metafield?.value || "{}"
  );

  /*
  STEP 2: Get customer
  */
  const customer = input.cart?.buyerIdentity?.customer;

  const isWholesale = customer?.wholesale;
  const isVIP = customer?.vip;

  /*
  STEP 3: Decide discount %
  */
  let percentage = 0;

  if (isVIP) {
    percentage = config.vip || 0;
  } else if (isWholesale) {
    percentage = config.wholesale || 0;
  }

  /*
  STEP 4: If no discount → return empty
  */
  if (!percentage) {
    return {
      discountApplicationStrategy: "FIRST",
      discounts: [],
    };
  }

  /*
  STEP 5: Apply to all cart lines
  */
  const targets = input.cart.lines.map((line: any) => ({
    productVariant: {
      id: line.merchandise.id,
    },
  }));

  return {
    discountApplicationStrategy: "FIRST",
    discounts: [
      {
        message: `${percentage}% OFF`,
        targets,
        value: {
          percentage: {
            value: percentage,
          },
        },
      },
    ],
  };
}