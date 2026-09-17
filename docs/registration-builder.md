# Wholesale registration page builder

## Merchant workflow

Open **Registration Pages** in the app navigation. Create a blank page or choose Standard Wholesale, Boutique, or Distributor. Drag library fields onto an insertion target; use the grip to move fields between columns or move a section. Click a field's Edit button to configure it. Sections, rows, columns and fields can be duplicated or deleted; Undo and Redo recover local edits.

Fields support custom names/labels, choices, validation, required status, conditional AND/OR rules, Shopify mapping and an **Application summary** role. Assign Company, Applicant first/last name, Email or Country roles to custom fields when those values should appear in the application list. The roles survive renaming internal field names. File uploads remain application-only private documents.

The Styling, Settings and Emails tabs configure the form, success screen, approval workflow and notifications. Preview uses the same renderer as the published form and supports Desktop, Tablet and Mobile. Drafts autosave after a pause; explicit Save draft is also available. Conflicting edits in another tab require reload instead of overwriting data. Publish validates the complete configuration. Saving a published page keeps its previous snapshot and URL live until the next Publish; Unpublish removes public access.

In **Applications**, filter submissions by page, status or search text. Open an application to review its answers and download documents through an authenticated request. Mark it Under review, Hold, Request information, Reject or Approve. Approval uses the workflow selected on the form at submission time:

- **Customer + wholesale tag** creates or links the applicant's customer, applies mapped data and optional tags.
- **Shopify B2B company** creates or links a company, location and customer/contact, assigns a location role, maps company/location metafields, and optionally assigns an existing company-location catalog and payment terms template. Shopify applies that catalog's configured pricing. This feature does not create a new price list or payment terms template.

Existing Shopify IDs can be entered in the review panel before approval. APIs use the authenticated store, and location/contact relationships are verified. Confirmed remote IDs are saved between steps. A failed step leaves the application unapproved with an error and can be retried. If a create request has an uncertain result, reconcile the record in Shopify and enter its ID rather than creating a second record. A processing lease expires after ten minutes if the process crashes.

## Storefront and deployment

The configured storefront path is `https://YOUR-STORE/apps/wholesale/PAGE-HANDLE`. Shopify forwards it to `/proxy/registration/:handle`. The signed proxy authenticates the store and serves a responsive iframe inside the theme. That iframe uses the same React renderer as Preview. No merchant Liquid changes are required. Shopify lets merchants customize their app-proxy prefix/subpath; if customized, use that path instead of the default link shown by the app.

Deploy the Node web application to the host configured by `SHOPIFY_APP_URL`; a Shopify extension deployment alone does not upload the web server. Use a permanent HTTPS app URL in the production Shopify configuration. The current checked-in TOML still uses the pre-existing development tunnel URL.

1. Install dependencies with `npm ci`.
2. Generate Prisma and apply migrations with `npm run setup`. Local migrations have already been applied in this workspace; fresh environments apply the included migrations.
3. Build with `npm run build` and start with `npm start` (or the existing container workflow).
4. Release the intended **production** Shopify app configuration with its `[app_proxy]` section and `write_app_proxy` scope. Installed stores must grant the updated access. Do not deploy the development tunnel configuration as production.
5. Verify `/apps/wholesale/<handle>` on an installed test store, submit an application, then approve it in the embedded admin.

The database remains SQLite to preserve the existing architecture. Application documents are stored as private database bytes; the SQLite file must be on persistent storage with backups. Do not run multiple independent server instances with separate SQLite files. No files are written under `public/`.

Shopify company access depends on store capabilities and granted customer/company permissions. The app continues using its existing Admin API version **2025-10** and customer/product scopes. The existing discount Function remains **2026-01**. Account password fields are visibly unavailable because Shopify B2B uses passwordless customer accounts; passwords are never accepted or stored.

## Email configuration

Set server-only environment variables:

```dotenv
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-provider-username
SMTP_PASSWORD=your-provider-password
SMTP_FROM=Wholesale Applications <applications@your-domain.example>
# Optional: use a separate random secret; otherwise SHOPIFY_API_SECRET signs forms.
REGISTRATION_SIGNING_SECRET=replace-with-a-long-random-secret
```

Enable the desired email events and recipients in the form's Emails tab. Set the admin recipient under Settings. Templates support `{{company}}`, `{{applicant}}`, `{{email}}`, `{{page}}`, and `{{message}}`. Notification records are written with the application/status transaction. Delivery is attempted immediately; failures remain visible in application details and can be retried. A process failure while SMTP is accepting a message can leave a `sending` record; investigate provider logs before resending to avoid duplicate mail. There is no external background mail worker configured.

## Security and limits

Admin reads, writes and private downloads are scoped to the authenticated shop. Public forms require an expiring signed token derived from the Shopify-authenticated proxy; submissions also require a one-time database nonce and same-origin POST. Unpublished/stale snapshots cannot accept submissions. Hidden/unknown fields and passwords are excluded or rejected server-side. Required/type/choice/length/file validation uses the shared configuration. Raw request bodies are capped before multipart parsing.

Uploads support PDF, JPG/JPEG and PNG. Extension, MIME and leading file signatures must agree. Merchants configure 1–5 files per upload field, up to 10 MB each, with a total submission cap of 20 MB. Downloads are authenticated attachments with no-store/nosniff headers. This implementation does not include a malware scanning service.

Honeypot and persistent rate limits apply: 600 form loads and 100 submission attempts per store per 10 minutes, plus 5 attempts per applicant email per hour after valid field validation. Shared store caps avoid trusting spoofable forwarded IP headers. Tune `enforceRate` call limits if legitimate volume requires it.

## Validation performed

```powershell
npm run test:registration
npm run typecheck
npm run build
npm run test:registration:browser
```

The automated suite covers templates, tree moves/duplication, conditional dependencies/cycles, malformed values, draft/publish rules, persistence and optimistic conflicts, published snapshots and handles, private file signatures/download ownership, separate stores, one-time submission nonces, rate limits, application transitions, visible email failures, and mocked Shopify B2B creation/retries. Integration tests create their own temporary SQLite database and mock Shopify authentication/API; no real store data is changed.

Browser harness checks confirmed library dragging, moving fields between columns, autosave/reload, 375px preview and storefront-style layout without overflow, and successful form submission. See `tests/browser/README.md` and screenshots there. The harness is a separate loopback-only test server and is excluded from production routes.

Live Shopify proxy installation, B2B approval against an actual store, authenticated downloads inside Shopify and SMTP delivery require deployment/configuration and have not been verified in this environment.

## API references

- [Shopify React Router app proxy authentication](https://shopify.dev/docs/api/shopify-app-react-router/v0/authenticate/public/app-proxy)
- [App proxies and dynamic data](https://shopify.dev/docs/apps/build/online-store/app-proxies)
- [Company contact role assignment, API 2025-10](https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/companyContactAssignRole)
- [Catalog context assignment, API 2025-10](https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/catalogContextUpdate)
