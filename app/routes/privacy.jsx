import styles from "../styles/privacy.module.css";

export const meta = () => [
  { title: "Privacy policy | Wholesale Engine AI" },
  {
    name: "description",
    content:
      "How Wholesale Engine AI handles information when merchants use the app and shoppers receive wholesale discounts.",
  },
];

const sections = [
  ["information", "Information we handle"],
  ["use", "How we use information"],
  ["sharing", "How information is shared"],
  ["retention", "Storage and retention"],
  ["choices", "Your choices and contact"],
  ["changes", "Changes to this policy"],
];

export default function PrivacyPolicy() {
  return (
    <div className={styles.page} id="top">
      <header className={styles.header}>
        <a className={styles.brand} href="/">Wholesale Engine AI</a>
        <span>Privacy &amp; information</span>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Wholesale Engine AI</p>
          <h1>Privacy policy</h1>
          <p className={styles.lead}>
            This policy explains how Wholesale Engine AI handles information
            when merchants use our Shopify app and shoppers receive wholesale
            discounts configured through it.
          </p>
          <p className={styles.updated}>
            Last updated: <time dateTime="2026-09-17">September 17, 2026</time>
          </p>
        </div>

        <nav className={styles.contents} aria-label="Policy contents">
          <h2>In this policy</h2>
          <ol>
            {sections.map(([id, title]) => (
              <li key={id}><a href={`#${id}`}>{title}</a></li>
            ))}
          </ol>
        </nav>

        <article className={styles.policy} aria-label="Privacy policy details">
          <section id="information">
            <h2>1. Information we handle</h2>
            <p>
              The app accesses information through Shopify permissions granted
              during installation and use. Depending on the feature, this includes:
            </p>
            <ul>
              <li>
                <strong>Shop and session information:</strong> shop identifiers,
                authentication sessions, authorized access tokens, and merchant
                user profile fields supplied by Shopify for those sessions.
              </li>
              <li>
                <strong>Wholesale configuration:</strong> discount rules,
                customer tags, discount settings, and related Shopify metafields.
              </li>
              <li>
                <strong>Product and customer identifiers:</strong> product and
                variant information used to configure rules, and customer IDs
                provided when assigning wholesale tags.
              </li>
              <li>
                <strong>Registration applications:</strong> the business,
                contact, address, tax, consent, and other custom information
                submitted through a merchant&apos;s registration form, along
                with uploaded verification documents and application review
                decisions. The fields collected depend on the merchant&apos;s
                form configuration.
              </li>
              <li>
                <strong>Cart eligibility information:</strong> cart line IDs,
                quantities, variant IDs, relevant customer tag membership
                (such as wholesale, VIP, or distributor), and discount
                configuration used by the Shopify discount function.
              </li>
            </ul>
          </section>

          <section id="use">
            <h2>2. How we use information</h2>
            <p>
              We use this information to connect the app to your Shopify store,
              maintain authorized sessions, save wholesale settings, assign
              customer tags, and create or update discounts and metafields.
              Registration information is used to review wholesale applications
              and, when approved by the merchant, create or link Shopify customer,
              company, and company location records using the configured field
              mappings. When notifications are enabled, we use contact information
              to send application updates.
              At checkout, the discount function evaluates cart information and
              customer eligibility to apply the merchant&apos;s configured rules.
            </p>
          </section>

          <section id="sharing">
            <h2>3. How information is shared</h2>
            <p>
              The app exchanges information with Shopify to operate the features
              merchants request. Information stored by the app is processed
              using the hosting and database infrastructure that runs the service.
              Access to store information through Shopify is limited by the
              permissions granted to the app.
              Configured email providers process recipient addresses and
              notification content to deliver application messages. Uploaded
              application documents are available through authenticated access
              to the merchant&apos;s app, rather than public document links.
            </p>
            <p>
              Shopify also processes information under its own privacy practices.
              A merchant&apos;s store privacy policy applies to the information
              shoppers provide directly to that store.
            </p>
          </section>

          <section id="retention">
            <h2>4. Storage and retention</h2>
            <p>
              The app stores shop and session information and wholesale settings
              to support its operation. Tags, discounts, and metafields managed
              through the app are also stored in Shopify.
            </p>
            <p>
              Uninstalling the app revokes its access to your store. When the app
              receives Shopify&apos;s uninstall notification, it removes the
              store&apos;s app sessions. Wholesale settings may remain in the
              app&apos;s database; uninstalling does not automatically delete all
              stored information. Contact support to ask about deletion of
              information associated with your store.
              Registration configurations, submitted applications, documents,
              and notification records may also remain until they are deleted.
            </p>
          </section>

          <section id="choices">
            <h2>5. Your choices and contact</h2>
            <p>
              <strong>Merchants:</strong> you can manage wholesale rules in the
              app and uninstall it through Shopify. For privacy questions or
              requests to access, correct, or delete information associated with
              your store, use the support contact provided on the Wholesale
              Engine AI listing in the Shopify App Store. Include your shop
              domain so support can identify the relevant store. Do not send
              passwords or access tokens.
            </p>
            <p>
              <strong>Shoppers:</strong> contact the merchant whose store you
              visited for requests about your customer information or orders.
              The merchant manages that store&apos;s customer records and
              wholesale eligibility.
            </p>
          </section>

          <section id="changes">
            <h2>6. Changes to this policy</h2>
            <p>
              We may update this policy as the app and its information handling
              practices change. The latest version will be available on this
              page, with the revision date shown above.
            </p>
          </section>
        </article>
      </main>

      <footer className={styles.footer}>
        <span>Wholesale Engine AI</span>
        <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
      </footer>
    </div>
  );
}
