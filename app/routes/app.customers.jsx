import { useLoaderData, useNavigate, Form, useSubmit, useNavigation, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";

/*
LOADER
*/
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const query = url.searchParams.get("query");

  const searchQuery = query ? `*${query}*` : undefined;

  let variables = {};
  if (before) {
    variables = { last: 50, before, query: searchQuery };
  } else if (after) {
    variables = { first: 50, after, query: searchQuery };
  } else {
    variables = { first: 50, query: searchQuery };
  }

  const response = await admin.graphql(`
    #graphql
    query getCustomers($first: Int, $last: Int, $after: String, $before: String, $query: String) {
      customers(first: $first, last: $last, after: $after, before: $before, query: $query) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          node {
            id
            firstName
            lastName
            email
            tags
            numberOfOrders
          }
        }
      }
    }
  `, { variables });

  const json = await response.json();
  const customers = json.data.customers.edges.map(edge => edge.node);
  const pageInfo = json.data.customers.pageInfo;

  return { customers, pageInfo, currentQuery: query || "" };
};

/*
ACTION
*/
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const customerId = formData.get("customerId");
  const tag = formData.get("tag");

  if (intent === "add_tag") {
    const response = await admin.graphql(`
      mutation tagsAdd($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          node { id }
          userErrors { field message }
        }
      }
    `, { variables: { id: customerId, tags: [tag] } });
    return await response.json();
  }

  if (intent === "remove_tag") {
    const response = await admin.graphql(`
      mutation tagsRemove($id: ID!, $tags: [String!]!) {
        tagsRemove(id: $id, tags: $tags) {
          node { id }
          userErrors { field message }
        }
      }
    `, { variables: { id: customerId, tags: [tag] } });
    return await response.json();
  }

  return null;
};



/*
COMPONENT
*/
function CustomerTagsEditor({ customer }) {
  const fetcher = useFetcher();
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tags = customer.tags || [];
  const isSubmitting = fetcher.state !== "idle";

  const handleAddTag = (tag) => {
    if (!tag.trim() || tags.includes(tag.trim())) return;
    fetcher.submit(
      { intent: "add_tag", customerId: customer.id, tag: tag.trim() },
      { method: "POST" }
    );
    setInputValue("");
    setIsFocused(false);
    setExpanded(true);
  };

  const handleRemoveTag = (tag) => {
    fetcher.submit(
      { intent: "remove_tag", customerId: customer.id, tag },
      { method: "POST" }
    );
  };

  const visibleTags = expanded ? tags : tags.slice(0, 3);
  const hiddenCount = tags.length - 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", opacity: isSubmitting ? 0.7 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {visibleTags.map(tag => (
          <div key={tag} className="lx-tag">
            <span>{tag}</span>
            <button 
              onClick={() => handleRemoveTag(tag)}
              disabled={isSubmitting}
              className="lx-tag-remove"
            >
              <svg viewBox="0 0 20 20" style={{ width: "12px", height: "12px", fill: "currentColor" }}><path d="M11.414 10l4.293-4.293a.999.999 0 1 0-1.414-1.414L10 8.586 5.707 4.293a.999.999 0 1 0-1.414 1.414L8.586 10l-4.293 4.293a.999.999 0 1 0 1.414 1.414L10 11.414l4.293 4.293a.999.999 0 1 0 1.414-1.414L11.414 10z"/></svg>
            </button>
          </div>
        ))}
        {!expanded && hiddenCount > 0 && (
          <span 
            onClick={() => setExpanded(true)}
            style={{ display: "flex", alignItems: "center", background: "#FFFFFF", color: "#374151", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer", border: "1px solid #D1D5DB" }}
          >
            +{hiddenCount} more
          </span>
        )}
        {expanded && hiddenCount > 0 && (
          <span 
            onClick={() => setExpanded(false)}
            style={{ display: "flex", alignItems: "center", background: "#FFFFFF", color: "#374151", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer", border: "1px solid #D1D5DB" }}
          >
            View less
          </span>
        )}
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: "250px" }}>
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddTag(inputValue);
            }
          }}
          placeholder="Add tags..."
          disabled={isSubmitting}
          className="lx-input"
          style={{ padding: "8px 12px", fontSize: "0.85rem", height: "36px" }}
        />
        {isSubmitting && (
          <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
            <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "none", stroke: "#9CA3AF", strokeWidth: "2", animation: "spin 1s linear infinite" }}><circle cx="10" cy="10" r="8" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="round" /></svg>
          </div>
        )}
        {isFocused && inputValue.trim() && !tags.includes(inputValue.trim()) && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--lx-border)", borderRadius: "8px", zIndex: 10, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
            <div 
              onClick={() => handleAddTag(inputValue)}
              style={{ padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--lx-text-primary)", fontWeight: "500", transition: "background 0.2s", borderRadius: "8px" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
            >
              <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "#6B7280" }}><path d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1z"/></svg>
              Add "{inputValue}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomersPage() {

  const { customers, pageInfo, currentQuery } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" || navigation.state === "submitting";
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [searchValue, setSearchValue] = useState(currentQuery);

  useEffect(() => {
    setSearchValue(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    if (searchValue === currentQuery) return;
    const timeoutId = setTimeout(() => {
      submit({ query: searchValue }, { method: "GET" });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchValue, submit, currentQuery]);

  const handleNext = () => {
    navigate(`?after=${pageInfo.endCursor}${currentQuery ? `&query=${encodeURIComponent(currentQuery)}` : ''}`);
  };

  const handlePrevious = () => {
    navigate(`?before=${pageInfo.startCursor}${currentQuery ? `&query=${encodeURIComponent(currentQuery)}` : ''}`);
  };

  return (
    <s-page heading="Wholesale Customers">
      <style>
        {`@keyframes spin { 100% { transform: rotate(360deg); } }`}
      </style>

      <div className="lx-container">
        <header className="lx-header">
          <h1 className="lx-title">Wholesale Customers</h1>
          <p className="lx-subtitle">Manage customer groups and apply wholesale tags.</p>
        </header>

        <div className="lx-table-container" style={{ marginTop: "1rem" }}>
          {/* Filter Bar */}
          <div className="lx-search-bar">
            <div style={{ fontWeight: "600", color: "var(--lx-text-primary)", whiteSpace: "nowrap" }}>
              All Customers
            </div>
            <div style={{ width: "1px", height: "24px", background: "var(--lx-border)", margin: "0 8px" }}></div>
            <Form 
              method="GET"
              style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}
            >
              <button type="submit" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: "#9CA3AF" }}>
                <svg viewBox="0 0 20 20" style={{ width: "18px", height: "18px", fill: "currentColor" }}><path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm6.32-1.094l3.58 3.58a1 1 0 1 1-1.414 1.414l-3.58-3.58a8 8 0 1 1 1.414-1.414z"/></svg>
              </button>
              <input 
                name="query"
                placeholder="Search customers by name or email..." 
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="lx-search-input"
              />
            </Form>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", pointerEvents: isLoading ? "none" : "auto" }}>
            <table className="lx-table">
              <thead>
                <tr>
                  <th style={{ width: "48px", textAlign: "center" }}>
                    <input 
                      type="checkbox" 
                      className="lx-checkbox"
                      checked={customers.length > 0 && selectedCustomers.length === customers.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCustomers(customers.map(c => c.id));
                        } else {
                          setSelectedCustomers([]);
                        }
                      }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Tags (Wholesale Groups)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" style={{ padding: "64px", textAlign: "center", color: "#9CA3AF" }}>
                      <svg viewBox="0 0 20 20" style={{ width: "32px", height: "32px", fill: "none", stroke: "currentColor", strokeWidth: "2", animation: "spin 1s linear infinite", margin: "0 auto", display: "block" }}><circle cx="10" cy="10" r="8" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="round" /></svg>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: "48px", textAlign: "center", color: "#6B7280" }}>
                      <div style={{ fontSize: "1rem", fontWeight: "500", marginBottom: "8px" }}>No customers found</div>
                      <div style={{ fontSize: "0.85rem" }}>Try changing your search query.</div>
                    </td>
                  </tr>
                ) : (
                  customers.map(customer => {
                    const isSelected = selectedCustomers.includes(customer.id);
                    return (
                      <tr key={customer.id} data-selected={isSelected}>
                        <td style={{ textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            className="lx-checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCustomers([...selectedCustomers, customer.id]);
                              } else {
                                setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id));
                              }
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: "600" }}>{customer.firstName} {customer.lastName}</td>
                        <td style={{ color: "#4B5563" }}>{customer.email}</td>
                        <td style={{ color: "#4B5563", fontWeight: "600" }}>{customer.numberOfOrders || 0}</td>
                        <td style={{ minWidth: "250px" }}>
                          <CustomerTagsEditor customer={customer} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--lx-border)", background: "#fff" }}>
              <span style={{ fontSize: "0.85rem", color: "#6B7280", fontWeight: "500" }}>
                Showing {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
              </span>
              <div style={{ display: "flex", gap: "12px" }}>
                <button 
                  disabled={!pageInfo.hasPreviousPage} 
                  onClick={handlePrevious}
                  className="lx-btn-outline"
                >
                  Previous
                </button>
                <button 
                  disabled={!pageInfo.hasNextPage} 
                  onClick={handleNext}
                  className="lx-btn-outline"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </s-page>
  );
}