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
      <div className="lx-container" style={{ maxWidth: "800px" }}>
        <header className="lx-header">
          <h1 className="lx-title">Discount Engine</h1>
          <p className="lx-subtitle">Master switch for your background discount engine.</p>
        </header>

        <div className="lx-card" style={{ padding: "2.5rem", marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 className="lx-card-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Engine Status</h2>
            <p className="lx-subtitle" style={{ margin: "0", fontSize: "0.95rem" }}>
              The engine applies automatic percentage discounts to customer carts based on their tags.
            </p>
          </div>
          
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "16px", marginBottom: "2rem" }}>
            <p style={{ margin: 0, color: "#1D4ED8", fontSize: "0.9rem" }}>
              <strong>Need to change percentages or add new tags?</strong><br />
              Go to the "Discounts" page in your app menu to manage dynamic tag rules (Bronze, Silver, Gold, etc.).
            </p>
          </div>

          {discounts.length === 0 ? (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "8px", padding: "16px" }}>
              <p style={{ margin: 0, color: "#92400E", fontSize: "0.95rem", fontWeight: "500" }}>
                The discount engine is currently disabled. To activate it, go to the "Discounts" page and create your first discount rule. The engine will be automatically created and synced.
              </p>
            </div>
          ) : (
            discounts.map((d) => (
              <div key={d.id} style={{ border: "1px solid var(--lx-border)", borderRadius: "8px", padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "var(--lx-text-primary)", margin: "0 0 0.5rem 0" }}>
                    {d.discount.title}
                  </h3>
                  <span className={`lx-badge ${d.discount.status === "ACTIVE" ? "lx-badge-success" : "lx-badge-info"}`}>
                    {d.discount.status}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="lx-btn-outline"
                    onClick={() =>
                      fetcher.submit(
                        { id: d.id, actionType: d.discount.status === "ACTIVE" ? "pause" : "resume" },
                        { method: "POST" }
                      )
                    }
                  >
                    {d.discount.status === "ACTIVE" ? "Pause Engine" : "Resume Engine"}
                  </button>

                  <button
                    className="lx-button lx-button-danger"
                    style={{ padding: "0.5rem 1.25rem" }}
                    onClick={() =>
                      fetcher.submit(
                        { id: d.id, actionType: "delete" },
                        { method: "POST" }
                      )
                    }
                  >
                    Delete Completely
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </s-page>
  );
}