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
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", opacity: isSubmitting ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {visibleTags.map(tag => {
          return (
            <div key={tag} style={{ display: "flex", alignItems: "center", background: "#aee9d1", color: "#005d3e", padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", gap: "4px" }}>
              <span>{tag}</span>
              <button 
                onClick={() => handleRemoveTag(tag)}
                disabled={isSubmitting}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", color: "inherit", opacity: 0.6 }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
              >
                <svg viewBox="0 0 20 20" style={{ width: "10px", height: "10px", fill: "currentColor" }}><path d="M11.414 10l4.293-4.293a.999.999 0 1 0-1.414-1.414L10 8.586 5.707 4.293a.999.999 0 1 0-1.414 1.414L8.586 10l-4.293 4.293a.999.999 0 1 0 1.414 1.414L10 11.414l4.293 4.293a.999.999 0 1 0 1.414-1.414L11.414 10z"/></svg>
              </button>
            </div>
          )
        })}
        {!expanded && hiddenCount > 0 && (
          <span 
            onClick={() => setExpanded(true)}
            style={{ display: "flex", alignItems: "center", background: "#f4f6f8", color: "#5c5f62", padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", cursor: "pointer", border: "1px solid #c9cccf" }}
          >
            +{hiddenCount} more
          </span>
        )}
        {expanded && hiddenCount > 0 && (
          <span 
            onClick={() => setExpanded(false)}
            style={{ display: "flex", alignItems: "center", background: "#f4f6f8", color: "#5c5f62", padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", cursor: "pointer", border: "1px solid #c9cccf" }}
          >
            View less
          </span>
        )}
      </div>
      <div style={{ position: "relative", width: "200px" }}>
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
          style={{ width: "100%", padding: "6px 8px", border: "1px solid #c9cccf", borderRadius: "4px", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
        />
        {isSubmitting && (
          <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}>
            <svg viewBox="0 0 20 20" style={{ width: "14px", height: "14px", fill: "none", stroke: "#8c9196", strokeWidth: "2", animation: "spin 1s linear infinite" }}><circle cx="10" cy="10" r="8" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="round" /></svg>
          </div>
        )}
        {isFocused && inputValue.trim() && !tags.includes(inputValue.trim()) && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #c9cccf", borderRadius: "4px", marginTop: "4px", zIndex: 10, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <div 
              onClick={() => handleAddTag(inputValue)}
              style={{ padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#202223" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f4f6f8"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
            >
              <svg viewBox="0 0 20 20" style={{ width: "14px", height: "14px", fill: "#5c5f62" }}><path d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1z"/></svg>
              Add {inputValue}
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



      <div style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 3px 0 rgba(0,0,0,0.15)", overflow: "hidden", margin: "16px 0" }}>
        {/* Filter Bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #ebebeb", gap: "16px", fontSize: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", color: "#202223" }}>
            All
          </div>
          <Form 
            method="GET"
            style={{ display: "flex", alignItems: "center", gap: "8px", color: "#8c9196", flex: 1 }}
          >
            <button type="submit" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: "#8c9196" }}>
              <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "currentColor" }}><path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm6.32-1.094l3.58 3.58a1 1 0 1 1-1.414 1.414l-3.58-3.58a8 8 0 1 1 1.414-1.414z"/></svg>
            </button>
            <input 
              name="query"
              placeholder="Search and filter" 
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ border: "none", outline: "none", width: "100%", background: "transparent", fontSize: "14px", color: "#202223" }} 
            />
          </Form>

        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", pointerEvents: isLoading ? "none" : "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead style={{ background: "#fafbfb", borderBottom: "1px solid #ebebeb" }}>
              <tr>
                <th style={{ padding: "10px 16px", width: "40px" }}>
                  <input 
                    type="checkbox" 
                    checked={customers.length > 0 && selectedCustomers.length === customers.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCustomers(customers.map(c => c.id));
                      } else {
                        setSelectedCustomers([]);
                      }
                    }}
                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#005bd3", border: "1px solid #8c9196", borderRadius: "4px" }} 
                  />
                </th>
                <th style={{ padding: "10px 16px", fontWeight: "600", color: "#6d7175", fontSize: "13px" }}>Name</th>
                <th style={{ padding: "10px 16px", fontWeight: "600", color: "#6d7175", fontSize: "13px" }}>Email</th>

                <th style={{ padding: "10px 16px", fontWeight: "600", color: "#6d7175", fontSize: "13px" }}>Orders</th>
                <th style={{ padding: "10px 16px", fontWeight: "600", color: "#6d7175", fontSize: "13px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: "64px", textAlign: "center", color: "#8c9196" }}>
                    <svg viewBox="0 0 20 20" style={{ width: "32px", height: "32px", fill: "none", stroke: "currentColor", strokeWidth: "2", animation: "spin 1s linear infinite", margin: "0 auto", display: "block" }}><circle cx="10" cy="10" r="8" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="round" /></svg>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "32px", textAlign: "center", color: "#6d7175" }}>No customers found.</td>
                </tr>
              ) : (
                customers.map(customer => {
                  const isSelected = selectedCustomers.includes(customer.id);
                  return (
                    <tr key={customer.id} style={{ borderBottom: "1px solid #ebebeb", background: isSelected ? "#f4f6f8" : "#fff", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = '#f4f6f8'} onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#f4f6f8' : '#fff'}>
                      <td style={{ padding: "10px 16px" }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCustomers([...selectedCustomers, customer.id]);
                            } else {
                              setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id));
                            }
                          }}
                          style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#005bd3", border: "1px solid #8c9196", borderRadius: "4px" }} 
                        />
                      </td>
                      <td style={{ padding: "10px 16px", color: "#202223", fontWeight: "500" }}>{customer.firstName} {customer.lastName}</td>
                      <td style={{ padding: "10px 16px", color: "#202223" }}>{customer.email}</td>

                      <td style={{ padding: "10px 16px", color: "#202223" }}>{customer.numberOfOrders || 0}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <CustomerTagsEditor customer={customer} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div style={{ padding: "16px", display: "flex", justifyContent: "center", gap: "12px", borderTop: "1px solid #ebebeb", background: "#fff" }}>
            <button 
              disabled={!pageInfo.hasPreviousPage} 
              onClick={handlePrevious}
              style={{ padding: "6px 12px", background: "#fff", border: "1px solid #c9cccf", borderRadius: "4px", color: "#202223", fontWeight: "500", cursor: pageInfo.hasPreviousPage ? "pointer" : "not-allowed", opacity: pageInfo.hasPreviousPage ? 1 : 0.5, boxShadow: "0 1px 0 0 rgba(22, 29, 37, 0.05)" }}
            >
              Previous
            </button>
            <button 
              disabled={!pageInfo.hasNextPage} 
              onClick={handleNext}
              style={{ padding: "6px 12px", background: "#fff", border: "1px solid #c9cccf", borderRadius: "4px", color: "#202223", fontWeight: "500", cursor: pageInfo.hasNextPage ? "pointer" : "not-allowed", opacity: pageInfo.hasNextPage ? 1 : 0.5, boxShadow: "0 1px 0 0 rgba(22, 29, 37, 0.05)" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

    </s-page>

  );
}