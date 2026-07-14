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
    <tr>
      <td>
        <span className="lx-tag" style={{ display: "inline-flex", width: "fit-content" }}>
          {tag}
        </span>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <input 
            type="number"
            min="0"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="No limit"
            className="lx-input"
            style={{ width: "140px", padding: "8px 12px", height: "36px", fontSize: "0.85rem" }}
          />
          <button 
            onClick={handleSave}
            disabled={isSubmitting || !hasChanged}
            className="lx-button"
            style={{ 
              padding: "0 16px",
              height: "36px",
              fontSize: "0.85rem",
              background: !hasChanged ? "#E5E7EB" : "#000000",
              borderColor: !hasChanged ? "#E5E7EB" : "#000000",
              color: !hasChanged ? "#9CA3AF" : "#FFFFFF",
              transform: "none",
              boxShadow: "none"
            }}
          >
            {isSubmitting ? "Saving..." : "Save"}
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
      <div className="lx-container">
        <header className="lx-header">
          <h1 className="lx-title">Quantity Limits</h1>
          <p className="lx-subtitle">Set maximum purchase quantities based on customer tags.</p>
        </header>

        <div className="lx-table-container">
          <div className="lx-search-bar">
            <div style={{ fontWeight: "600", color: "var(--lx-text-primary)", whiteSpace: "nowrap" }}>
              Customer Tags
            </div>
            <div style={{ width: "1px", height: "24px", background: "var(--lx-border)", margin: "0 8px" }}></div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
              <svg viewBox="0 0 20 20" style={{ width: "18px", height: "18px", fill: "#9CA3AF" }}><path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm6.32-1.094l3.58 3.58a1 1 0 1 1-1.414 1.414l-3.58-3.58a8 8 0 1 1 1.414-1.414z"/></svg>
              <input 
                type="text"
                placeholder="Search tags..." 
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="lx-search-input"
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="lx-table">
              <thead>
                <tr>
                  <th style={{ width: "50%" }}>Customer Tag</th>
                  <th style={{ width: "50%" }}>Quantity Limit</th>
                </tr>
              </thead>
              <tbody>
                {currentTags.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: "48px", textAlign: "center", color: "#6B7280" }}>
                      <div style={{ fontSize: "1rem", fontWeight: "500", marginBottom: "8px" }}>No tags found in the system.</div>
                    </td>
                  </tr>
                ) : (
                  currentTags.map(tag => (
                    <LimitRow key={tag} tag={tag} currentLimit={limitsMap[tag]} />
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--lx-border)", background: "#fff" }}>
            <span style={{ fontSize: "0.85rem", color: "#6B7280", fontWeight: "500" }}>
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
                className="lx-btn-outline"
              >
                Previous
              </button>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
                className="lx-btn-outline"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </s-page>
  );
}
