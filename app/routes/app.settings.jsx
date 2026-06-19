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
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "20px", color: "#202223" }}>Settings</h1>

      <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", boxShadow: "0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px 0 rgba(63, 63, 68, 0.15)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px", color: "#202223" }}>Checkout Validation Error Messages</h2>
        <p style={{ color: "#6d7175", marginBottom: "20px", fontSize: "14px" }}>
          Customize the warning messages shown to customers when they don't meet the minimum quantity rules. 
          Use <strong>{'{limit}'}</strong> to show the required quantity and <strong>{'{total}'}</strong> to show their current cart quantity.
        </p>
        
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#202223", fontSize: "14px" }}>
            New Customer Error Message
          </label>
          <textarea
            value={newCustomerMessage}
            onChange={(e) => setNewCustomerMessage(e.target.value)}
            rows={3}
            placeholder="As a new customer, you must order at least {limit} items. You currently have {total} items."
            style={{ width: "100%", padding: "10px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px", outline: "none", resize: "vertical" }}
          />
          <p style={{ color: "#6d7175", marginTop: "4px", fontSize: "13px" }}>Leave blank to use the default message.</p>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#202223", fontSize: "14px" }}>
            Tagged Customer Error Message
          </label>
          <textarea
            value={taggedCustomerMessage}
            onChange={(e) => setTaggedCustomerMessage(e.target.value)}
            rows={3}
            placeholder="Based on your tags, you must order at least {limit} items. You currently have {total} items."
            style={{ width: "100%", padding: "10px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "14px", outline: "none", resize: "vertical" }}
          />
          <p style={{ color: "#6d7175", marginTop: "4px", fontSize: "13px" }}>Leave blank to use the default message.</p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            style={{ 
              padding: "8px 16px", 
              background: "#005bd3", 
              color: "#fff", 
              border: "1px solid #005bd3", 
              borderRadius: "4px", 
              cursor: isSaving ? "not-allowed" : "pointer", 
              fontWeight: "500", 
              fontSize: "14px",
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}