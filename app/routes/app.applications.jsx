import { useLoaderData,  useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect, useRef } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  const applications = await prisma.wholesaleApplication.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: 'desc' }
  });

  return { applications };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionType = formData.get("actionType");
  const applicationId = formData.get("applicationId");
  
  if (!applicationId) return { error: "Missing application ID" };

  const application = await prisma.wholesaleApplication.findUnique({
    where: { id: applicationId, shop: session.shop }
  });

  if (!application) return { error: "Application not found" };

  if (actionType === "approve") {
    try {
      let customerId = null;
      const searchRes = await admin.graphql(
        `#graphql
        query findCustomer($query: String!) {
          customers(first: 1, query: $query) {
            edges {
              node {
                id
                tags
              }
            }
          }
        }`,
        { variables: { query: `email:${application.email}` } }
      );
      
      const searchData = await searchRes.json();
      const existingCustomer = searchData.data?.customers?.edges?.[0]?.node;
      
      const tag = `wholesale-${application.businessType.toLowerCase()}`;
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
        const currentTags = existingCustomer.tags || [];
        if (!currentTags.includes(tag)) {
          await admin.graphql(
            `#graphql
            mutation tagsAdd($id: ID!, $tags: [String!]!) {
              tagsAdd(id: $id, tags: $tags) {
                userErrors { message }
              }
            }`,
            { variables: { id: customerId, tags: [tag] } }
          );
        }
      } else {
        const nameParts = application.contactName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        let addresses = [];
        const parseAddress = (addrStr) => {
          if (!addrStr) return null;
          try {
            const data = JSON.parse(addrStr);
            return {
              address1: data.address1 || "",
              address2: data.address2 || "",
              city: data.city || "",
              province: data.province || "",
              zip: data.zip || "",
              country: data.country || "",
              firstName: firstName,
              lastName: lastName,
              company: application.businessName,
              phone: application.phone
            };
          } catch(e) {
            return null;
          }
        };

        const bAddr = parseAddress(application.billingAddress);
        if (bAddr) addresses.push(bAddr);
        
        const sAddr = parseAddress(application.shippingAddress);
        if (sAddr && (!bAddr || application.billingAddress !== application.shippingAddress)) {
           addresses.push(sAddr);
        }

        const createRes = await admin.graphql(
          `#graphql
          mutation customerCreate($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer { id }
              userErrors { message }
            }
          }`,
          {
            variables: {
              input: {
                firstName,
                lastName,
                email: application.email,
                phone: application.phone,
                tags: [tag, "wholesale"],
                note: "Wholesale Customer",
                addresses: addresses.length > 0 ? addresses : undefined
              }
            }
          }
        );
        const createData = await createRes.json();
        
        if (createData.data?.customerCreate?.userErrors?.length > 0) {
          const errMsg = createData.data.customerCreate.userErrors.map(e => e.message).join(', ');
          console.error("GraphQL customerCreate errors:", createData.data.customerCreate.userErrors);
          return { error: errMsg };
        }
      }

      await prisma.wholesaleApplication.update({
        where: { id: applicationId },
        data: { status: "Approved" }
      });
      
      return { success: true, message: "Application approved and customer tagged." };

    } catch (error) {
      console.error("API Error during approval:", error);
      return { error: `API Error: ${error.message || 'Unknown error'}` };
    }
  } 
  else if (actionType === "reject") {
    await prisma.wholesaleApplication.update({
      where: { id: applicationId },
      data: { status: "Rejected" }
    });
    return { success: true, message: "Application rejected." };
  }
  else if (actionType === "review") {
    await prisma.wholesaleApplication.update({
      where: { id: applicationId },
      data: { status: "Under Review" }
    });
    return { success: true, message: "Application marked as Under Review." };
  }
  else if (actionType === "edit") {
    const contactName = formData.get("contactName");
    const email = formData.get("email");
    const phone = formData.get("phone");
    
    if (!contactName || !email || !phone) {
      return { error: "Name, Email, and Phone are required for editing." };
    }
    
    await prisma.wholesaleApplication.update({
      where: { id: applicationId },
      data: { contactName, email, phone }
    });
    return { success: true, message: "Application details updated successfully." };
  }

  return { error: "Invalid action" };
};

export default function Applications() {
  const { applications } = useLoaderData();
  const fetcher = useFetcher();
  const [activeApp, setActiveApp] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({ contactName: "", email: "", phone: "" });
  
  const isSubmitting = fetcher.state !== "idle";
  const submittingAction = isSubmitting ? fetcher.formData?.get('actionType') : null;

  const rejectRef = useRef(null);
  const reviewRef = useRef(null);
  const approveRef = useRef(null);

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        shopify.toast.show(fetcher.data.message || "Action successful");
        shopify.modal.hide('app-details-modal');
        setActiveApp(null);
      } else if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [fetcher.data]);

  const handleAction = (id, type) => {
    if (!id || isSubmitting) return;
    fetcher.submit({ actionType: type, applicationId: id }, { method: "POST" });
  };

  useEffect(() => {
    const rejectBtn = rejectRef.current;
    const reviewBtn = reviewRef.current;
    const approveBtn = approveRef.current;

    const onReject = () => handleAction(activeApp?.id, 'reject');
    const onReview = () => handleAction(activeApp?.id, 'review');
    const onApprove = () => handleAction(activeApp?.id, 'approve');

    if (rejectBtn) rejectBtn.addEventListener('click', onReject);
    if (reviewBtn) reviewBtn.addEventListener('click', onReview);
    if (approveBtn) approveBtn.addEventListener('click', onApprove);

    return () => {
      if (rejectBtn) rejectBtn.removeEventListener('click', onReject);
      if (reviewBtn) reviewBtn.removeEventListener('click', onReview);
      if (approveBtn) approveBtn.removeEventListener('click', onApprove);
    };
  }, [activeApp, isSubmitting]);

  const openModal = (app) => {
    setActiveApp(app);
    setIsEditMode(false);
    setEditData({ contactName: app.contactName || "", email: app.email || "", phone: app.phone || "" });
    shopify.modal.show('app-details-modal');
  };

  const handleSaveEdit = () => {
    fetcher.submit(
      { actionType: 'edit', applicationId: activeApp.id, ...editData },
      { method: "POST" }
    );
    // Note: We don't close the modal or switch off edit mode here; 
    // the useEffect handles it when fetcher succeeds, or we can just let it re-render.
    // For better UX, we'll just wait for the loader to update.
    setIsEditMode(false);
    setActiveApp({ ...activeApp, ...editData }); // Optimistic update
  };

  return (
    <s-page heading="Wholesale Applications">
      <div className="lx-container">
        <header className="lx-header">
          <h1 className="lx-title">Wholesale Applications</h1>
          <p className="lx-subtitle">Review and approve incoming B2B registrations.</p>
        </header>

        <div className="lx-table-container" style={{ marginTop: "1rem" }}>
          <div style={{ overflowX: "auto", pointerEvents: isSubmitting ? "none" : "auto", opacity: isSubmitting ? 0.7 : 1 }}>
            <table className="lx-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: "48px", textAlign: "center", color: "#6B7280" }}>
                      <div style={{ fontSize: "1rem", fontWeight: "500", marginBottom: "8px" }}>No applications found</div>
                    </td>
                  </tr>
                ) : (
                  applications.map(app => (
                    <tr key={app.id}>
                      <td style={{ fontWeight: "600" }}>{app.businessName}</td>
                      <td style={{ color: "#4B5563" }}>{app.contactName}</td>
                      <td style={{ color: "#4B5563" }}>{app.email}</td>
                      <td>
                        <span className="lx-badge" style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>{app.businessType}</span>
                      </td>
                      <td>
                        <span className="lx-badge" style={{
                          backgroundColor: app.status === 'Approved' ? '#DEF7EC' : app.status === 'Rejected' ? '#FDE8E8' : app.status === 'Under Review' ? '#E1EFFE' : '#FEF3C7',
                          color: app.status === 'Approved' ? '#03543F' : app.status === 'Rejected' ? '#9B1C1C' : app.status === 'Under Review' ? '#1E429F' : '#92400E'
                        }}>
                          {app.status}
                        </span>
                      </td>
                      <td style={{ color: "#4B5563", fontSize: "0.9rem" }}>
                        {new Date(app.createdAt).toISOString().split('T')[0]}
                      </td>
                      <td>
                        <button 
                          className="lx-btn-outline" 
                          onClick={() => openModal(app)} 
                          style={{ padding: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", border: "1px solid #D1D5DB", backgroundColor: "white", cursor: "pointer", transition: "all 0.2s" }}
                          title="View Details"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "18px", height: "18px", color: "#4B5563" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* App Bridge Modal Web Component */}
      <ui-modal id="app-details-modal">
        <div style={{ padding: "20px" }}>
          {activeApp && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>{activeApp.businessName}</h2>
                <button 
                  className="lx-btn-outline" 
                  onClick={() => setIsEditMode(!isEditMode)} 
                  style={{ padding: "4px 10px", fontSize: "0.85rem", borderRadius: "4px" }}
                >
                  {isEditMode ? "Cancel Edit" : "✏️ Edit Details"}
                </button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px", fontSize: "0.95rem" }}>
                <div style={{ fontWeight: "600", color: "#4B5563" }}>Contact Name:</div>
                <div>
                  {isEditMode ? (
                    <input 
                      type="text" 
                      value={editData.contactName} 
                      onChange={(e) => setEditData({...editData, contactName: e.target.value})}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #D1D5DB" }}
                    />
                  ) : activeApp.contactName}
                </div>
                
                <div style={{ fontWeight: "600", color: "#4B5563" }}>Email:</div>
                <div>
                  {isEditMode ? (
                    <input 
                      type="email" 
                      value={editData.email} 
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #D1D5DB" }}
                    />
                  ) : activeApp.email}
                </div>
                
                <div style={{ fontWeight: "600", color: "#4B5563" }}>Phone:</div>
                <div>
                  {isEditMode ? (
                    <input 
                      type="tel" 
                      value={editData.phone} 
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #D1D5DB" }}
                    />
                  ) : activeApp.phone}
                </div>
                
                <div style={{ fontWeight: "600", color: "#4B5563" }}>Business Type:</div>
                <div>{activeApp.businessType}</div>
                
                <div style={{ fontWeight: "600", color: "#4B5563" }}>Tax ID:</div>
                <div>{activeApp.taxId || 'N/A'}</div>
                
                <div style={{ fontWeight: "600", color: "#4B5563" }}>Website:</div>
                <div>{activeApp.website || 'N/A'}</div>
              </div>

              <div style={{ borderTop: "1px solid #E5E7EB", margin: "10px 0" }}></div>

              <div>
                <div style={{ fontWeight: "600", color: "#4B5563", marginBottom: "4px" }}>Billing Address:</div>
                <div style={{ fontSize: "0.95rem", whiteSpace: "pre-line" }}>
                  {(() => {
                    if (!activeApp.billingAddress) return 'N/A';
                    try {
                      const data = JSON.parse(activeApp.billingAddress);
                      return `${data.address1}\n${data.address2 ? data.address2 + '\n' : ''}${data.city}, ${data.province} ${data.zip}\n${data.country}`;
                    } catch {
                      return activeApp.billingAddress;
                    }
                  })()}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: "600", color: "#4B5563", marginBottom: "4px" }}>Shipping Address:</div>
                <div style={{ fontSize: "0.95rem", whiteSpace: "pre-line" }}>
                  {(() => {
                    if (!activeApp.shippingAddress) return 'N/A';
                    try {
                      const data = JSON.parse(activeApp.shippingAddress);
                      return `${data.address1}\n${data.address2 ? data.address2 + '\n' : ''}${data.city}, ${data.province} ${data.zip}\n${data.country}`;
                    } catch {
                      return activeApp.shippingAddress;
                    }
                  })()}
                </div>
              </div>
              
              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                {isEditMode ? (
                  <button 
                    className="lx-btn-primary" 
                    onClick={handleSaveEdit} 
                    disabled={isSubmitting}
                    style={{ padding: "8px 16px", borderRadius: "6px", backgroundColor: "#0E9F6E", color: "white", border: "none", cursor: "pointer", fontWeight: "500" }}
                  >
                    {submittingAction === 'edit' ? "Saving..." : "Save Changes"}
                  </button>
                ) : (
                  <>
                    <button 
                      ref={rejectRef}
                      className="lx-btn-outline" 
                      disabled={isSubmitting || activeApp?.status === 'Rejected'}
                      style={{ padding: "8px 16px", borderRadius: "6px" }}
                    >
                      {submittingAction === 'reject' ? "Processing..." : "Reject"}
                    </button>
                    <button 
                      ref={reviewRef}
                      className="lx-btn-outline" 
                      disabled={isSubmitting || activeApp?.status === 'Under Review'}
                      style={{ padding: "8px 16px", borderRadius: "6px" }}
                    >
                      {submittingAction === 'review' ? "Processing..." : "Mark as Under Review"}
                    </button>
                    <button 
                      ref={approveRef}
                      className="lx-btn-primary" 
                      disabled={isSubmitting || activeApp?.status === 'Approved'}
                      style={{ padding: "8px 16px", borderRadius: "6px", backgroundColor: "#1C2126", color: "white", border: "none", cursor: "pointer", fontWeight: "500" }}
                    >
                      {submittingAction === 'approve' ? "Processing..." : "Approve & Create Customer"}
                    </button>
                  </>
                )}
              </div>

            </div>
          )}
        </div>

        <ui-title-bar title="Application Details"></ui-title-bar>
      </ui-modal>

    </s-page>
  );
}
