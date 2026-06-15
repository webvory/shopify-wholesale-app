import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/* ======================
   LOADER - GET RULES
====================== */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const rules = await db.wholesaleRule.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return { rules };
};

/* ======================
   ACTION - CREATE / DELETE
====================== */
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");

  if (intent === "create") {
    await db.wholesaleRule.create({
      data: {
        shop: session.shop,
        name: formData.get("name"),
        discountType: formData.get("discountType"),
        discountValue: parseFloat(formData.get("discountValue")),
        minQuantity: formData.get("minQuantity")
          ? parseInt(formData.get("minQuantity"))
          : null,
      },
    });
  }

  if (intent === "delete") {
    await db.wholesaleRule.delete({
      where: { id: formData.get("id") },
    });
  }

  return null;
};

/* ======================
   COMPONENT
====================== */
export default function WholesaleRules() {
  const { rules } = useLoaderData();
  const fetcher = useFetcher();

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minQuantity, setMinQuantity] = useState("");

  const handleCreate = () => {
    fetcher.submit(
      {
        intent: "create",
        name,
        discountType,
        discountValue,
        minQuantity,
      },
      { method: "POST" }
    );

    setName("");
    setDiscountValue("");
    setMinQuantity("");
  };

  const handleDelete = (id) => {
    fetcher.submit(
      { intent: "delete", id },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Wholesale Rules">
      <s-section heading="Create Rule">

        <s-text-field
          label="Rule Name"
          value={name}
          oninput={(e) => setName(e.target.value)}
        />

        <s-select
          label="Discount Type"
          value={discountType}
          onchange={(e) => setDiscountType(e.target.value)}
        >
          <option value="percentage">Percentage (%)</option>
          <option value="fixed">Fixed Amount ($)</option>
        </s-select>

        <s-text-field
          label="Discount Value"
          type="number"
          value={discountValue}
          oninput={(e) => setDiscountValue(e.target.value)}
        />

        <s-text-field
          label="Minimum Quantity (optional)"
          type="number"
          value={minQuantity}
          oninput={(e) => setMinQuantity(e.target.value)}
        />

        <s-button variant="primary" onclick={handleCreate}>
          Create Rule
        </s-button>
      </s-section>

      <s-section heading="Existing Rules">

        {rules.length === 0 && (
          <s-paragraph>No wholesale rules created yet.</s-paragraph>
        )}

        {rules.map((rule) => (
          <s-card key={rule.id} padding="base">
            <s-stack direction="inline" gap="base" alignment="center">
              <s-text fontWeight="bold">{rule.name}</s-text>

              <s-badge tone="info">
                {rule.discountType === "percentage"
                  ? `${rule.discountValue}%`
                  : `$${rule.discountValue}`}
              </s-badge>

              {rule.minQuantity && (
                <s-badge tone="success">
                  Min Qty: {rule.minQuantity}
                </s-badge>
              )}

              <s-button
                variant="plain"
                tone="critical"
                onclick={() => handleDelete(rule.id)}
              >
                Delete
              </s-button>
            </s-stack>
          </s-card>
        ))}
      </s-section>
    </s-page>
  );
}