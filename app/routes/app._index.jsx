export default function Dashboard() {
  return (
    <s-page heading="Wholesale Engine AI">
      <s-section>
        <s-heading>Overview</s-heading>
        <s-paragraph>
          Manage your wholesale pricing, customers, and rules from here.
        </s-paragraph>
      </s-section>

      <s-section>
        <s-grid columns="4" gap="base">

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>Wholesale Rules</s-heading>
            <s-paragraph>Create and manage pricing tiers.</s-paragraph>
            <s-link href="/app/wholesale">Manage Rules</s-link>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>Customers</s-heading>
            <s-paragraph>Assign customers to wholesale groups.</s-paragraph>
            <s-link href="/app/customers">Manage Customers</s-link>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>Settings</s-heading>
            <s-paragraph>Configure global discount behavior.</s-paragraph>
            <s-link href="/app/settings">Open Settings</s-link>
          </s-box>

          {/* NEW SECTION */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>Shopify Discount</s-heading>
            <s-paragraph>
              Create the Shopify automatic discount required for wholesale pricing.
            </s-paragraph>
            <s-link href="/app/create-discount">Create Discount</s-link>
          </s-box>

        </s-grid>
      </s-section>
    </s-page>
  );
}