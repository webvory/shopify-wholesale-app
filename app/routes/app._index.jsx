import { Link } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // 1. Check if we already created the menu
  let settings = await prisma.appSetting.findUnique({
    where: { shop: session.shop },
  });

  if (!settings) {
    settings = await prisma.appSetting.create({
      data: { shop: session.shop }
    });
  }

  // 2. If no wholesaleMenuId is saved, create the menu
  if (!settings.wholesaleMenuId) {
    try {
      const response = await admin.graphql(
        `#graphql
        mutation CreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) {
            menu {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            title: "Wholesale Portal",
            handle: "wholesale-registration",
            items: [
              {
                title: "Wholesale Application",
                url: "#wholesale-register",
                type: "HTTP"
              }
            ]
          }
        }
      );

      const result = await response.json();
      
      if (result.data?.menuCreate?.menu?.id) {
        // Save the ID in the database so we don't create it again
        await prisma.appSetting.update({
          where: { shop: session.shop },
          data: { wholesaleMenuId: result.data.menuCreate.menu.id }
        });
        console.log("Successfully created Wholesale menu:", result.data.menuCreate.menu.id);
      } else {
        console.error("Failed to create menu:", result.data?.menuCreate?.userErrors);
      }
    } catch (error) {
      console.error("Error creating wholesale menu:", error);
    }
  }

  return null;
};
export default function Dashboard() {
  return (
    <s-page heading="Wholesale Engine AI">
      <div className="lx-container">
        <header className="lx-header">
          <h1 className="lx-title">Overview</h1>
          <p className="lx-subtitle">Manage your wholesale pricing, customers, and rules from here.</p>
        </header>

        <div className="lx-grid">
          <Link to="/app/customers" className="lx-card lx-card-hover-border">
            <div className="lx-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h2 className="lx-card-title">Customers</h2>
            <p className="lx-card-desc">Assign customers to wholesale groups.</p>
            <span className="lx-card-link">Manage Customers <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </Link>

          <Link to="/app/applications" className="lx-card lx-card-hover-border">
            <div className="lx-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h2 className="lx-card-title">Applications</h2>
            <p className="lx-card-desc">Review and approve wholesale applications.</p>
            <span className="lx-card-link">View Applications <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </Link>

          <Link to="/app/settings" className="lx-card lx-card-hover-border">
            <div className="lx-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <h2 className="lx-card-title">Settings</h2>
            <p className="lx-card-desc">Configure global discount behavior.</p>
            <span className="lx-card-link">Open Settings <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </Link>

          <Link to="/app/create-discount" className="lx-card lx-card-hover-border">
            <div className="lx-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h2 className="lx-card-title">Shopify Discount</h2>
            <p className="lx-card-desc">Create the Shopify automatic discount required for wholesale pricing.</p>
            <span className="lx-card-link">Create Discount <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </Link>

          <div className="lx-card-disabled">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div className="lx-card-icon" style={{ marginBottom: 0 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <span className="lx-badge" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>Coming Soon</span>
            </div>
            <h2 className="lx-card-title">Wholesale Rules</h2>
            <p className="lx-card-desc">Create and manage pricing tiers.</p>
            <span className="lx-card-link" style={{ color: "#9CA3AF" }}>Manage Rules <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </div>

        </div>
      </div>
    </s-page>
  );
}