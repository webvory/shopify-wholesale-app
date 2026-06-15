// @ts-check

/**
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} CartValidationsGenerateRunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} CartValidationsGenerateRunResult
 */

/**
 * @param {CartValidationsGenerateRunInput} input
 * @returns {CartValidationsGenerateRunResult}
 */
export function cartValidationsGenerateRun(input) {
  const errors = [];

  const customer = input.cart.buyerIdentity?.customer;
  
  // Calculate total quantity of items in the cart
  const totalQuantity = input.cart.lines.reduce((total, line) => total + line.quantity, 0);

  let minQuantity = 1;
  let isNewCustomer = false;

  // RULE 1: If 0 orders (or guest), minimum is always 6
  if (!customer || customer.numberOfOrders === 0) {
    minQuantity = 6;
    isNewCustomer = true;
  } 
  // RULE 2 & 3: If 1+ orders, use Tag Limit if it exists, otherwise 1.
  else if (customer.min_quantity && customer.min_quantity.value) {
    const tagLimit = parseInt(customer.min_quantity.value, 10);
    if (!isNaN(tagLimit)) {
      minQuantity = tagLimit;
    }
  }

  // If the total quantity in the cart is less than the required minimum, block the action
  if (totalQuantity < minQuantity) {
    if (input.buyerJourney?.step !== "CART_INTERACTION") {
      const errorMessage = isNewCustomer 
        ? `As a new customer, you must order at least ${minQuantity} items. You currently have ${totalQuantity} items in your cart.`
        : `Based on your customer tags, you must order at least ${minQuantity} items. You currently have ${totalQuantity} items in your cart.`;

      errors.push({
        message: errorMessage,
        target: "$.cart",
      });
    }
  }

  return {
    operations: [
      {
        validationAdd: {
          errors
        }
      }
    ]
  };
}