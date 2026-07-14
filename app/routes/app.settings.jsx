import { useLoaderData, useFetcher, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.appSetting.findUnique({ where: { shop } });
  if (!settings) {
    settings = { 
      newCustomerMessage: "As a new customer, you must order at least {limit} items. You currently have {total} items.", 
      taggedCustomerMessage: "Based on your tags, you must order at least {limit} items. You currently have {total} items." 
    };
  } else {
    if (!settings.newCustomerMessage) settings.newCustomerMessage = "As a new customer, you must order at least {limit} items. You currently have {total} items.";
    if (!settings.taggedCustomerMessage) settings.taggedCustomerMessage = "Based on your tags, you must order at least {limit} items. You currently have {total} items.";
  }

  return { settings };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const newCustomerMessage = formData.get("newCustomerMessage") || "";
  const taggedCustomerMessage = formData.get("taggedCustomerMessage") || "";

  await prisma.appSetting.upsert({
    where: { shop },
    update: { newCustomerMessage, taggedCustomerMessage },
    create: { shop, newCustomerMessage, taggedCustomerMessage }
  });

  // Sync to Shop Metafield so Checkout Function can access it
  const messagesJson = JSON.stringify({
    newCustomerMessage,
    taggedCustomerMessage
  });

  // Get Shop ID to set metafield
  const shopRes = await admin.graphql(`
    query {
      shop {
        id
      }
    }
  `);
  const shopData = await shopRes.json();
  const shopId = shopData.data?.shop?.id;

  if (shopId) {
    await admin.graphql(`
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { message }
        }
      }
    `, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "wholesale_engine",
            key: "error_messages",
            value: messagesJson,
            type: "json"
          }
        ]
      }
    });
  }

  return { success: true };
};

export default function Settings() {
  const { settings } = useLoaderData();
  const fetcher = useFetcher();
  
  const [newCustomerMessage, setNewCustomerMessage] = useState(settings.newCustomerMessage || "");
  const [taggedCustomerMessage, setTaggedCustomerMessage] = useState(settings.taggedCustomerMessage || "");
  
  const isSaving = fetcher.state !== "idle";
  const isSuccess = fetcher.data?.success && fetcher.state === "idle";

  useEffect(() => {
    if (isSuccess) {
      shopify.toast.show("Settings saved successfully");
    }
  }, [isSuccess]);

  const handleSave = () => {
    fetcher.submit({
      newCustomerMessage,
      taggedCustomerMessage
    }, { method: "post" });
  };

  return (
    <s-page heading="App Settings">
      <div className="lx-container" style={{ maxWidth: "800px" }}>
        <header className="lx-header">
          <h1 className="lx-title">App Settings</h1>
          <p className="lx-subtitle">Configure global app settings and checkout validation messages.</p>
        </header>

        <div className="lx-card" style={{ padding: "2.5rem" }}>
          <div style={{ marginBottom: "2rem" }}>
            <h2 className="lx-card-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Checkout Error Messages</h2>
            <p className="lx-subtitle" style={{ margin: "0", fontSize: "0.95rem" }}>
              Customize the warning messages shown to customers when they don't meet the minimum quantity rules. 
              Use <strong>{'{limit}'}</strong> to show the required quantity and <strong>{'{total}'}</strong> to show their current cart quantity.
            </p>
          </div>
          
          <div className="lx-form-group">
            <label className="lx-label">New Customer Error Message</label>
            <textarea
              className="lx-input"
              value={newCustomerMessage}
              onChange={(e) => setNewCustomerMessage(e.target.value)}
              rows={3}
              placeholder="As a new customer, you must order at least {limit} items. You currently have {total} items."
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            <p style={{ color: "#6B7280", marginTop: "6px", fontSize: "0.85rem", fontWeight: "500" }}>Leave blank to use the default message.</p>
          </div>

          <div className="lx-form-group" style={{ marginBottom: "2.5rem" }}>
            <label className="lx-label">Tagged Customer Error Message</label>
            <textarea
              className="lx-input"
              value={taggedCustomerMessage}
              onChange={(e) => setTaggedCustomerMessage(e.target.value)}
              rows={3}
              placeholder="Based on your tags, you must order at least {limit} items. You currently have {total} items."
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            <p style={{ color: "#6B7280", marginTop: "6px", fontSize: "0.85rem", fontWeight: "500" }}>Leave blank to use the default message.</p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--lx-border)", paddingTop: "1.5rem", marginTop: "1rem" }}>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="lx-button"
              style={{ opacity: isSaving ? 0.7 : 1 }}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </s-page>
  );
}