import { useFetcher, useLoaderData } from "react-router";
import { useEffect } from "react";
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
ACTION → Pause / Resume / Delete
========================================
*/
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");
  const id = formData.get("id");

  if (actionType === "pause") {
    const res = await admin.graphql(`
      mutation PauseDiscount($id: ID!) {
        discountAutomaticDeactivate(id: $id) {
          userErrors { message }
        }
      }
    `, { variables: { id } });
    const json = await res.json();
    if (json.data.discountAutomaticDeactivate.userErrors.length) {
      return { error: json.data.discountAutomaticDeactivate.userErrors[0].message };
    }
    return { success: "Discount paused successfully." };
  }

  if (actionType === "resume") {
    const res = await admin.graphql(`
      mutation ResumeDiscount($id: ID!) {
        discountAutomaticActivate(id: $id) {
          userErrors { message }
        }
      }
    `, { variables: { id } });
    const json = await res.json();
    if (json.data.discountAutomaticActivate.userErrors.length) {
      return { error: json.data.discountAutomaticActivate.userErrors[0].message };
    }
    return { success: "Discount resumed successfully." };
  }

  if (actionType === "delete") {
    const res = await admin.graphql(`
      mutation DeleteDiscount($id: ID!) {
        discountAutomaticDelete(id: $id) {
          userErrors { message }
        }
      }
    `, { variables: { id } });
    const json = await res.json();
    if (json.data.discountAutomaticDelete.userErrors.length) {
      return { error: json.data.discountAutomaticDelete.userErrors[0].message };
    }
    return { success: "Discount deleted successfully." };
  }

  return null;
};

/*
========================================
UI
========================================
*/
export default function CreateDiscount() {
  const fetcher = useFetcher();
  const { discounts } = useLoaderData();

  useEffect(() => {
    if (fetcher.data?.success) {
      if (typeof shopify !== 'undefined') shopify.toast.show(fetcher.data.success);
    } else if (fetcher.data?.error) {
      if (typeof shopify !== 'undefined') shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data]);

  return (
    <s-page heading="Wholesale Discount Engine">
      <s-section heading="Master Control">
        <s-paragraph>
          This is the master switch for your background discount engine. The engine applies automatic percentage discounts to customer carts based on their tags.
        </s-paragraph>
        <br />
        <s-banner tone="info">
          <strong>Need to change percentages or add new tags?</strong>
          <br/>
          Go to the "Discounts" page in your app menu to manage dynamic tag rules (Bronze, Silver, Gold, etc.).
        </s-banner>
      </s-section>

      <s-section heading="Engine Status">
        {discounts.length === 0 ? (
          <s-banner tone="warning">
            The discount engine is currently completely disabled. To activate it, go to the "Discounts" page and create your first discount rule. The engine will be automatically created and synced.
          </s-banner>
        ) : (
          discounts.map((d) => (
            <s-card key={d.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <s-text><strong>{d.discount.title}</strong></s-text>
                  <br />
                  <s-badge tone={d.discount.status === "ACTIVE" ? "success" : "critical"}>
                    {d.discount.status}
                  </s-badge>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <s-button
                    onClick={() =>
                      fetcher.submit(
                        { id: d.id, actionType: d.discount.status === "ACTIVE" ? "pause" : "resume" },
                        { method: "POST" }
                      )
                    }
                  >
                    {d.discount.status === "ACTIVE" ? "Pause Engine" : "Resume Engine"}
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
                    Delete Completely
                  </s-button>
                </div>
              </div>
            </s-card>
          ))
        )}
      </s-section>
    </s-page>
  );
}