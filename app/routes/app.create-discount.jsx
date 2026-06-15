import { useFetcher, useLoaderData } from "react-router";
import { useState } from "react";
import { authenticate } from "../shopify.server";

/*
========================================
LOADER → Fetch existing discount
========================================
*/
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(`
    query {
      discountNodes(first: 20) {
        nodes {
          id
          discount {
            ... on DiscountAutomaticApp {
              title
              status
            }
          }
        }
      }
    }
  `);

  const json = await res.json();

  const discounts = json.data.discountNodes.nodes.filter(
    (d) => d.discount?.title === "Wholesale Engine Discount"
  );

  return { discounts };
};

/*
========================================
ACTION → Create / Update / Pause / Delete
========================================
*/
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();

  const actionType = formData.get("actionType");
  const id = formData.get("id");

  const wholesale = Number(formData.get("wholesale")) || 0;
  const vip = Number(formData.get("vip")) || 0;

  const discountConfig = { wholesale, vip };

  /*
  ========================================
  PAUSE
  ========================================
  */
  if (actionType === "pause") {
    const res = await admin.graphql(
      `
      mutation PauseDiscount($id: ID!) {
        discountAutomaticDeactivate(id: $id) {
          userErrors { message }
        }
      }
    `,
      { variables: { id } }
    );

    const json = await res.json();

    if (json.data.discountAutomaticDeactivate.userErrors.length) {
      return { error: json.data.discountAutomaticDeactivate.userErrors[0].message };
    }

    return { success: "Discount paused" };
  }

  /*
  ========================================
  RESUME
  ========================================
  */
  if (actionType === "resume") {
    const res = await admin.graphql(
      `
      mutation ResumeDiscount($id: ID!) {
        discountAutomaticActivate(id: $id) {
          userErrors { message }
        }
      }
    `,
      { variables: { id } }
    );

    const json = await res.json();

    if (json.data.discountAutomaticActivate.userErrors.length) {
      return { error: json.data.discountAutomaticActivate.userErrors[0].message };
    }

    return { success: "Discount resumed" };
  }

  /*
  ========================================
  DELETE
  ========================================
  */
  if (actionType === "delete") {
    const res = await admin.graphql(
      `
      mutation DeleteDiscount($id: ID!) {
        discountAutomaticDelete(id: $id) {
          userErrors { message }
        }
      }
    `,
      { variables: { id } }
    );

    const json = await res.json();

    if (json.data.discountAutomaticDelete.userErrors.length) {
      return { error: json.data.discountAutomaticDelete.userErrors[0].message };
    }

    return { success: "Discount deleted" };
  }

  /*
  ========================================
  SAVE (CREATE / UPDATE)
  ========================================
  */

  // Get function ID
  const functionRes = await admin.graphql(`
    query {
      shopifyFunctions(first: 10) {
        nodes {
          id
          title
        }
      }
    }
  `);

  const functionJson = await functionRes.json();

  const functionId = functionJson.data.shopifyFunctions.nodes.find(
    (f) => f.title === "wholesale-discount"
  )?.id;

  if (!functionId) {
    return { error: "Function not found. Deploy your Shopify Function." };
  }

  // Get existing discount
  const discountRes = await admin.graphql(`
    query {
      discountNodes(first: 20) {
        nodes {
          id
          discount {
            ... on DiscountAutomaticApp {
              title
            }
          }
        }
      }
    }
  `);

  const discountJson = await discountRes.json();

  const existing = discountJson.data.discountNodes.nodes.find(
    (d) => d.discount?.title === "Wholesale Engine Discount"
  );

  /*
  CREATE
  */
  if (!existing) {
    const res = await admin.graphql(
      `
      mutation CreateDiscount($functionId: String!, $config: String!) {
        discountAutomaticAppCreate(
          automaticAppDiscount: {
            title: "Wholesale Engine Discount"
            functionId: $functionId
            startsAt: "${new Date().toISOString()}"
            discountClasses: [PRODUCT]
            metafields: [
              {
                namespace: "discount"
                key: "config"
                type: "json"
                value: $config
              }
            ]
          }
        ) {
          userErrors { message }
        }
      }
    `,
      {
        variables: {
          functionId,
          config: JSON.stringify(discountConfig),
        },
      }
    );

    const json = await res.json();

    if (json.data.discountAutomaticAppCreate.userErrors.length) {
      return { error: json.data.discountAutomaticAppCreate.userErrors[0].message };
    }

    return { success: "Discount created" };
  }

  /*
  UPDATE (FIXED)
  */
  const ownerId = existing.id;

  const updateRes = await admin.graphql(
    `
    mutation UpdateMetafield($ownerId: ID!, $config: String!) {
      metafieldsSet(metafields: [
        {
          ownerId: $ownerId
          namespace: "discount"
          key: "config"
          type: "json"
          value: $config
        }
      ]) {
        userErrors { message }
      }
    }
  `,
    {
      variables: {
        ownerId,
        config: JSON.stringify(discountConfig),
      },
    }
  );

  const updateJson = await updateRes.json();

  if (updateJson.data.metafieldsSet.userErrors.length) {
    return { error: updateJson.data.metafieldsSet.userErrors[0].message };
  }

  return { success: "Discount updated" };
};

/*
========================================
UI
========================================
*/
export default function CreateDiscount() {
  const fetcher = useFetcher();
  const { discounts } = useLoaderData();

  const [wholesale, setWholesale] = useState(20);
  const [vip, setVip] = useState(30);

  const isSubmitting = fetcher.state === "submitting";

  return (
    <s-page heading="Wholesale Engine">

      <s-section heading="Discount Settings">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>

          <div>
            <s-text>Wholesale Discount (%)</s-text>
            <input
              type="number"
              value={wholesale}
              onChange={(e) => setWholesale(Number(e.target.value))}
            />
          </div>

          <div>
            <s-text>VIP Discount (%)</s-text>
            <input
              type="number"
              value={vip}
              onChange={(e) => setVip(Number(e.target.value))}
            />
          </div>

          <s-button
            variant="primary"
            loading={isSubmitting}
            onClick={() =>
              fetcher.submit(
                { wholesale, vip, actionType: "save" },
                { method: "POST" }
              )
            }
          >
            Save / Update
          </s-button>
        </div>

        {fetcher.data?.success && (
          <s-banner tone="success">{fetcher.data.success}</s-banner>
        )}

        {fetcher.data?.error && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}
      </s-section>

      <s-section heading="Existing Discount">
        {discounts.length === 0 && (
          <s-paragraph>No discount found</s-paragraph>
        )}

        {discounts.map((d) => (
          <s-card key={d.id}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>

              <div>
                <s-text>{d.discount.title}</s-text>
                <br />
                <s-badge>{d.discount.status}</s-badge>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>

                <s-button
                  onClick={() =>
                    fetcher.submit(
                      {
                        id: d.id,
                        actionType:
                          d.discount.status === "ACTIVE"
                            ? "pause"
                            : "resume",
                      },
                      { method: "POST" }
                    )
                  }
                >
                  {d.discount.status === "ACTIVE" ? "Pause" : "Resume"}
                </s-button>

                <s-button
                  tone="critical"
                  onClick={() =>
                    fetcher.submit(
                      { id: d.id, actionType: "delete" },
                      { method: "POST" }
                    )
                  }
                >
                  Delete
                </s-button>

              </div>

            </div>
          </s-card>
        ))}
      </s-section>

    </s-page>
  );
}