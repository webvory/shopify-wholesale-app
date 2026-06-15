import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch up to 250 customers to extract unique tags
  const response = await admin.graphql(`
    #graphql
    query {
      customers(first: 250) {
        edges {
          node {
            tags
          }
        }
      }
    }
  `);
  
  const json = await response.json();
  const customers = json.data?.customers?.edges?.map(e => e.node) || [];
  
  const uniqueTags = new Set();
  customers.forEach(customer => {
    if (customer.tags && customer.tags.length > 0) {
      customer.tags.forEach(tag => uniqueTags.add(tag));
    }
  });

  const allTags = Array.from(uniqueTags).sort();

  // Fetch existing limits from DB
  const limits = await prisma.quantityLimit.findMany({
    where: { shop }
  });

  const limitsMap = {};
  limits.forEach(l => {
    limitsMap[l.tag] = l.limit;
  });

  return { tags: allTags, limitsMap };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  
  const tag = formData.get("tag");
  const limitStr = formData.get("limit");
  
  if (!tag) return { success: false, error: "Tag is required" };

  if (!limitStr || limitStr.trim() === "") {
    // delete limit if empty
    await prisma.quantityLimit.deleteMany({
      where: { shop, tag }
    });
  } else {
    const limit = parseInt(limitStr, 10);
    if (isNaN(limit)) return { success: false, error: "Invalid limit" };

    await prisma.quantityLimit.upsert({
      where: {
        shop_tag: {
          shop,
          tag
        }
      },
      update: { limit },
      create: { shop, tag, limit }
    });
  }

  // SYNC TO SHOP METAFIELD FOR SHOPIFY FUNCTION
  const allLimits = await prisma.quantityLimit.findMany({ where: { shop } });
  const limitsMap = {};
  allLimits.forEach(l => {
    limitsMap[l.tag] = l.limit;
  });
  
  const metafieldValue = JSON.stringify(limitsMap);

  const shopQuery = await admin.graphql(`query { shop { id } }`);
  const shopJson = await shopQuery.json();
  const shopId = shopJson.data?.shop?.id;

  if (shopId) {
    await admin.graphql(`
      #graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            message
          }
        }
      }
    `, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "wholesale_engine",
            key: "tag_limits",
            value: metafieldValue,
            type: "json"
          }
        ]
      }
    });
  }

  // Sync affected customers immediately (awaiting to prevent request context from closing)
  try {
    await syncCustomersWithTag(admin, tag, allLimits);
  } catch (err) {
    console.error("Sync error:", err);
  }

  return { success: true };
};

async function syncCustomersWithTag(admin, targetTag, allLimits) {
  // Find customers that have this tag (first 250 for MVP)
  const response = await admin.graphql(`
    query($query: String!) {
      customers(first: 250, query: $query) {
        edges {
          node {
            id
            tags
          }
        }
      }
    }
  `, { variables: { query: `tag:${targetTag}` } });

  const data = await response.json();
  const customers = data.data?.customers?.edges || [];

  for (const { node } of customers) {
    let highestLimit = 1;
    for (const rawTag of node.tags) {
      const t = rawTag.trim().toLowerCase();
      const limitRecord = allLimits.find(l => l.tag.trim().toLowerCase() === t);
      if (limitRecord && limitRecord.limit > highestLimit) {
        highestLimit = limitRecord.limit;
      }
    }

    await admin.graphql(`
      #graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { message }
        }
      }
    `, {
      variables: {
        metafields: [
          {
            ownerId: node.id,
            namespace: "wholesale_engine",
            key: "min_quantity",
            value: highestLimit.toString(),
            type: "number_integer"
          }
        ]
      }
    });
  }
}

function LimitRow({ tag, currentLimit }) {
  const fetcher = useFetcher();
  // Ensure we display an empty string if currentLimit is undefined/null
  const [limit, setLimit] = useState(currentLimit !== undefined ? currentLimit : "");

  const isSubmitting = fetcher.state !== "idle";
  const hasChanged = limit !== (currentLimit !== undefined ? currentLimit : "");

  const handleSave = () => {
    fetcher.submit(
      { tag, limit: limit.toString() },
      { method: "POST" }
    );
  };

  return (
    <tr style={{ borderBottom: "1px solid #ebebeb", background: "#fff", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = '#f4f6f8'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
      <td style={{ padding: "12px 16px", fontWeight: "500", color: "#202223" }}>
        <span style={{ display: "inline-block", background: "#e4e5e7", padding: "4px 10px", borderRadius: "12px", fontSize: "13px" }}>
          {tag}
        </span>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input 
            type="number"
            min="0"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="No limit"
            style={{ width: "120px", padding: "6px 8px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "13px", outline: "none" }}
          />
          <button 
            onClick={handleSave}
            disabled={isSubmitting || !hasChanged}
            style={{ 
              padding: "6px 12px", 
              background: !hasChanged ? "#f4f6f8" : "#005bd3", 
              color: !hasChanged ? "#8c9196" : "#fff", 
              border: !hasChanged ? "1px solid #c9cccf" : "1px solid #005bd3", 
              borderRadius: "4px", 
              cursor: !hasChanged ? "not-allowed" : "pointer", 
              fontWeight: "500", 
              fontSize: "13px",
              minWidth: "70px"
            }}
          >
            {isSubmitting ? "..." : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function QuantityLimitPage() {
  const { tags, limitsMap } = useLoaderData();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const itemsPerPage = 10;
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  const filteredTags = tags.filter(tag => tag.toLowerCase().includes(searchValue.toLowerCase()));
  
  const totalPages = Math.ceil(filteredTags.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTags = filteredTags.slice(startIndex, startIndex + itemsPerPage);

  return (
    <s-page heading="Quantity Limits">
      <div style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 3px 0 rgba(0,0,0,0.15)", overflow: "hidden", margin: "16px 0" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #ebebeb", background: "#fafbfb" }}>
          <p style={{ color: "#6d7175", margin: 0, fontSize: "14px", marginBottom: "16px" }}>Set maximum purchase quantities based on customer tags.</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", border: "1px solid #c9cccf", borderRadius: "4px", padding: "6px 12px" }}>
            <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "#8c9196" }}><path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm6.32-1.094l3.58 3.58a1 1 0 1 1-1.414 1.414l-3.58-3.58a8 8 0 1 1 1.414-1.414z"/></svg>
            <input 
              type="text"
              placeholder="Search tags..." 
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ border: "none", outline: "none", width: "100%", background: "transparent", fontSize: "14px", color: "#202223" }} 
            />
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead style={{ background: "#fafbfb", borderBottom: "1px solid #ebebeb" }}>
              <tr>
                <th style={{ padding: "10px 16px", fontWeight: "600", color: "#6d7175", fontSize: "13px", width: "50%" }}>Customer Tag</th>
                <th style={{ padding: "10px 16px", fontWeight: "600", color: "#6d7175", fontSize: "13px", width: "50%" }}>Quantity Limit</th>
              </tr>
            </thead>
            <tbody>
              {currentTags.length === 0 ? (
                <tr>
                  <td colSpan="2" style={{ padding: "32px", textAlign: "center", color: "#6d7175" }}>No tags found in the system.</td>
                </tr>
              ) : (
                currentTags.map(tag => (
                  <LimitRow key={tag} tag={tag} currentLimit={limitsMap[tag]} />
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: "16px", display: "flex", justifyContent: "center", gap: "12px", borderTop: "1px solid #ebebeb", background: "#fff" }}>
          <button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => p - 1)}
            style={{ padding: "6px 12px", background: "#fff", border: "1px solid #c9cccf", borderRadius: "4px", color: "#202223", fontWeight: "500", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "13px", color: "#6d7175", fontWeight: "500" }}>
            Page {currentPage} of {totalPages}
          </span>
          <button 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(p => p + 1)}
            style={{ padding: "6px 12px", background: "#fff", border: "1px solid #c9cccf", borderRadius: "4px", color: "#202223", fontWeight: "500", cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      </div>
    </s-page>
  );
}
