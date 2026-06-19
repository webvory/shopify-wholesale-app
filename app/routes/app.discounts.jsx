import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/*
========================================
SYNC HELPER: Sync Prisma Rules to Shopify Metafield
========================================
*/
async function syncRulesToMetafield(admin, shop) {
  // 1. Get all rules for this shop
  const rules = await prisma.wholesaleDiscount.findMany({
    where: { shop },
  });

  // 2. Format into JSON Object { "wholesale-gold": 20, "vip": 30 }
  const configObj = rules.reduce((acc, rule) => {
    acc[rule.tag] = rule.discount;
    return acc;
  }, {});
  const configString = JSON.stringify(configObj);

  // 3. Get Function ID
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
    throw new Error("Function not found. Deploy wholesale-discount first.");
  }

  // 4. Get existing Discount
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

  // 5. Create or Update Metafield
  if (!existing) {
    const createRes = await admin.graphql(`
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
    `, {
      variables: { functionId, config: configString },
    });
    const createJson = await createRes.json();
    if (createJson.data.discountAutomaticAppCreate.userErrors.length) {
      throw new Error(createJson.data.discountAutomaticAppCreate.userErrors[0].message);
    }
  } else {
    const updateRes = await admin.graphql(`
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
    `, {
      variables: { ownerId: existing.id, config: configString },
    });
    const updateJson = await updateRes.json();
    if (updateJson.data.metafieldsSet.userErrors.length) {
      throw new Error(updateJson.data.metafieldsSet.userErrors[0].message);
    }
  }
}

/*
========================================
LOADER
========================================
*/
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const rules = await prisma.wholesaleDiscount.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return { rules };
};

/*
========================================
ACTION
========================================
*/
export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    if (actionType === "delete") {
      const id = parseInt(formData.get("id"), 10);
      await prisma.wholesaleDiscount.delete({ where: { id } });
    } else if (actionType === "create") {
      const tag = formData.get("tag")?.toLowerCase()?.trim();
      const discount = parseInt(formData.get("discount"));
      if (!tag || !discount) {
        return { error: "Tag and discount required" };
      }
      
      // Check if tag already exists
      const existingRule = await prisma.wholesaleDiscount.findFirst({
        where: { shop: session.shop, tag }
      });
      
      if (existingRule) {
        // Update existing
        await prisma.wholesaleDiscount.update({
          where: { id: existingRule.id },
          data: { discount }
        });
      } else {
        // Create new
        await prisma.wholesaleDiscount.create({
          data: { shop: session.shop, tag, discount },
        });
      }
    }

    // Sync to Shopify Metafield
    await syncRulesToMetafield(admin, session.shop);

    return { success: true };
  } catch (error) {
    console.error("Discount Sync Error:", error);
    return { error: error.message || "An error occurred" };
  }
};

/*
========================================
PAGE UI
========================================
*/
export default function Discounts() {
  const fetcher = useFetcher();
  const { rules } = useLoaderData();

  const [tag, setTag] = useState("");
  const [discount, setDiscount] = useState("");

  const isCreating = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "create";

  useEffect(() => {
    if (fetcher.data?.success) {
      if (typeof shopify !== 'undefined') shopify.toast.show("Rules synced successfully!");
    } else if (fetcher.data?.error) {
      if (typeof shopify !== 'undefined') shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data]);

  const createRule = () => {
    fetcher.submit(
      { tag, discount, actionType: "create" },
      { method: "POST" }
    );
    setTag("");
    setDiscount("");
  };

  const deleteRule = (id) => {
    fetcher.submit(
      { id, actionType: "delete" },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Wholesale Discount Rules">
      <s-section heading="Manage Dynamic Discounts">
        <s-paragraph>
          Create discount percentages for specific customer tags. These rules are automatically synced to the Shopify Background Discount Engine.
        </s-paragraph>
        
        <div style={{
          display: "flex",
          gap: "15px",
          alignItems: "flex-end",
          background: "#f9f9f9",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #e1e3e5",
          marginTop: "16px",
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <s-text-field
              label="Customer Tag"
              value={tag}
              onInput={(e) => setTag(e.target.value)}
              placeholder="e.g. wholesale-gold"
            />
          </div>
          <div style={{ flex: 1, minWidth: "150px" }}>
            <s-text-field
              label="Discount %"
              type="number"
              value={discount}
              onInput={(e) => setDiscount(e.target.value)}
              placeholder="e.g. 20"
            />
          </div>
          <div style={{ paddingBottom: "2px" }}>
            <s-button variant="primary" onClick={createRule} loading={isCreating}>
              Save Rule
            </s-button>
          </div>
        </div>
      </s-section>

      <s-section heading="Active Tag Rules">
        {rules.length === 0 && <s-paragraph>No rules configured yet.</s-paragraph>}

        {rules.length > 0 && (
          <div style={{ background: "white", border: "1px solid #e1e3e5", borderRadius: "8px", overflow: "hidden", marginTop: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f4f6f8", borderBottom: "1px solid #e1e3e5" }}>
                  <th style={{ padding: "14px 20px", fontWeight: "600", color: "#202223" }}>Customer Tag</th>
                  <th style={{ padding: "14px 20px", fontWeight: "600", color: "#202223" }}>Discount</th>
                  <th style={{ padding: "14px 20px", textAlign: "right", fontWeight: "600", color: "#202223" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const isDeletingThis = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "delete" && fetcher.formData?.get("id") === rule.id.toString();
                  return (
                    <tr key={rule.id} style={{ borderBottom: "1px solid #e1e3e5" }}>
                      <td style={{ padding: "16px 20px", fontWeight: "500", color: "#202223" }}>{rule.tag}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <s-badge>{rule.discount}% OFF</s-badge>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <s-button tone="critical" onClick={() => deleteRule(rule.id)} loading={isDeletingThis}>Delete</s-button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}