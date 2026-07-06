import { useState, useRef, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/* ======================
   LOADER - GET RULES
====================== */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const rules = await db.wholesaleRule.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return { rules };
};

/* ======================
   ACTION - CREATE / DELETE
====================== */
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");

  if (intent === "create") {
    await db.wholesaleRule.create({
      data: {
        shop: session.shop,
        name: formData.get("name"),
        discountType: formData.get("discountType"),
        discountValue: parseFloat(formData.get("discountValue")),
        minQuantity: formData.get("minQuantity")
          ? parseInt(formData.get("minQuantity"))
          : null,
      },
    });
  }

  if (intent === "delete") {
    await db.wholesaleRule.delete({
      where: { id: formData.get("id") },
    });
  }

  return null;
};

/* ======================
   CUSTOM COMPONENTS
====================== */
function CustomSelect({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="lx-custom-select" data-open={isOpen} ref={dropdownRef}>
      <div 
        className="lx-custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        tabIndex="0"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <span>{selectedOption ? selectedOption.label : "Select..."}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <div className="lx-custom-select-dropdown">
          {options.map((opt) => (
            <div 
              key={opt.value} 
              className="lx-custom-select-option" 
              data-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======================
   COMPONENT
====================== */
export default function WholesaleRules() {
  const { rules } = useLoaderData();
  const fetcher = useFetcher();

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minQuantity, setMinQuantity] = useState("");

  const handleCreate = () => {
    fetcher.submit(
      {
        intent: "create",
        name,
        discountType,
        discountValue,
        minQuantity,
      },
      { method: "POST" }
    );

    setName("");
    setDiscountValue("");
    setMinQuantity("");
  };

  const handleDelete = (id) => {
    fetcher.submit(
      { intent: "delete", id },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Wholesale Rules">
      <div className="lx-container">
        <header className="lx-header">
          <h1 className="lx-title">Wholesale Rules</h1>
          <p className="lx-subtitle">Create and manage your pricing tiers efficiently.</p>
        </header>

        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr' }}>
          
          {/* Create Rule Form */}
          <div className="lx-card" style={{ padding: '2.5rem' }}>
            <h2 className="lx-card-title" style={{ marginBottom: '2rem', fontSize: '1.5rem' }}>Create New Rule</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div className="lx-form-group">
                <label className="lx-label">Rule Name</label>
                <input 
                  type="text" 
                  className="lx-input" 
                  placeholder="e.g. VIP Customers 20% Off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="lx-form-group">
                <label className="lx-label">Discount Type</label>
                <CustomSelect
                  value={discountType}
                  onChange={(val) => setDiscountType(val)}
                  options={[
                    { value: "percentage", label: "Percentage (%)" },
                    { value: "fixed", label: "Fixed Amount ($)" }
                  ]}
                />
              </div>

              <div className="lx-form-group">
                <label className="lx-label">Discount Value</label>
                <input 
                  type="number" 
                  className="lx-input" 
                  placeholder="e.g. 20"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>

              <div className="lx-form-group">
                <label className="lx-label">Minimum Quantity (optional)</label>
                <input 
                  type="number" 
                  className="lx-input" 
                  placeholder="e.g. 10"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="lx-button" onClick={handleCreate}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Create Rule
              </button>
            </div>
          </div>

          {/* Existing Rules List */}
          <div>
            <h2 className="lx-card-title" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>Existing Rules</h2>
            
            {rules.length === 0 && (
              <div className="lx-card" style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'transparent', borderStyle: 'dashed' }}>
                <p className="lx-subtitle">No wholesale rules created yet.</p>
              </div>
            )}

            {rules.map((rule) => (
              <div key={rule.id} className="lx-rule-card">
                <div className="lx-rule-info">
                  <h3 className="lx-rule-name">{rule.name}</h3>
                  <span className="lx-badge lx-badge-info">
                    {rule.discountType === "percentage"
                      ? `${rule.discountValue}% Off`
                      : `$${rule.discountValue} Off`}
                  </span>
                  {rule.minQuantity && (
                    <span className="lx-badge lx-badge-success">
                      Min Qty: {rule.minQuantity}
                    </span>
                  )}
                </div>
                
                <button 
                  className="lx-button lx-button-danger" 
                  onClick={() => handleDelete(rule.id)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>
    </s-page>
  );
}