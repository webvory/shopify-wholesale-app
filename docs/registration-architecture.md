# Registration builder implementation contract

Existing app: React 18 / React Router 7 flat routes, Shopify embedded AppProvider and Polaris web components, Prisma 6 SQLite. Admin authentication is `authenticate.admin(request)`, shop ownership from `session.shop`. Admin GraphQL is 2025-10. Existing tag/discount Function remains unchanged.

## Integration

- `/app/registration-pages`: list, create blank/template, duplicate, publish, unpublish, delete.
- `/app/registration-pages/:id`: editor; loader returns `{page, shop, emailConfigured}`. Page has parsed `configuration`, `styling`, `settings` JSON, `revision`, `status`.
- `/app/registration-templates`: templates linking to creation.
- `/app/applications`: application list; `/app/applications/:id`: review.
- `/apps/wholesale/:handle` on storefront: signed Shopify app proxy forwards to `/proxy/registration/:handle`, returns theme-wrapped responsive iframe.
- `/registration/:handle?token=...`: short-lived signed public form, shared React renderer. Submission requires one-time server-issued nonce and validation against published snapshot.
- `/app/application-files/:id`: authenticated shop-scoped private download, never public files.

## Shared model (`app/registration/schema.js`)

Exports `FIELD_LIBRARY` (array `{key,category,label,type,...defaults}`), `TEMPLATES` (array `{id,name,description}`), `createField(key)`, `createSection(title?)`, `createRow(columnCount?)`, `createTemplate(id)`, `defaultStyling`, `defaultSettings`, `allFields(configuration)`, `isVisible(conditions,values)`, `visibleFields(configuration,values)`, `validateConfiguration(configuration)`, `validateSubmission(configuration,values)` (returns `{values,errors}`; values keyed by field IDs, hidden and unknown fields excluded). Validation functions throw no generic exceptions for invalid customer input. `validateConfiguration` returns error string array.

Configuration: `{version:1,title,description,sections:[{id,title,description,conditions,style:{background,spacing,border},rows:[{id,columns:[{id,fields:[field]}]}]}]}`.

Field: `{id,type,label,name,placeholder,helpText,required,defaultValue,width,errorMessage,characterLimit,validation,options:string[],settings:{maxFiles,maxFileSizeMB},dataDestination:{type,key,namespace,metafieldType},conditions}`. Field types: text, textarea, email, phone, number, url, date, select, radio, checkbox, checkboxGroup, multiselect, file, heading, paragraph, divider, spacer, password, confirmPassword. Password fields may appear in library but publication/submission rejects them: Shopify B2B uses passwordless accounts; do not persist passwords.

Conditions: `{match:'all'|'any',rules:[{fieldId,operator,value}]}`. Operators `equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`. No rules means visible. Visibility must respect hidden dependency values and section conditions; reject circular dependencies during configuration validation.

Data destinations: `application`, `customer` (key email/firstName/lastName/phone), `customer_tag`, `customer_metafield`, `company_metafield`, `company_location_metafield`, `address` (key address1/address2/city/province/zip/countryCode). Use field names in human exports, IDs in submission records. File references only in application. No passwords persisted.

Styling: `pageBackground,formBackground,borderColor,borderRadius,shadow,spacing,headingSize,bodySize,labelSize,fontWeight,buttonText,buttonColor,buttonTextColor,buttonRadius,buttonWidth,buttonAlignment,inputHeight,inputRadius,inputBorderColor,focusColor,labelPosition,useThemeFont`.

Settings: `{successHeading,successDescription,successButtonText,successRedirectUrl,adminEmail,approval:{mode:'customer'|'b2b',customerTag,catalogId,paymentTermsTemplateId},emails:{received:{enabled,to:'applicant'|'admin'|'both',subject,body},approved:{enabled,to,subject,body},rejected:{enabled,to,subject,body},information:{enabled,to,subject,body}}}`. Template variables `{{company}}`, `{{applicant}}`, `{{email}}`, `{{page}}`, `{{message}}`. Email transport configured by SMTP environment variables.

## Shared renderer (`app/components/registration/FormRenderer.jsx`)

Default export `FormRenderer({configuration,styling,values,onChange,errors,disabled=false})`; renders fields only, no outer form or submit button; builder preview and public form add same styled button. Names `field_<id>`; file onChange receives File or File[]. Conditional logic same helpers server/client. Renderer is responsive by container size, not only viewport, for mobile preview. Avoid server-only imports.

## Editor save/action interface

Editor fetcher submits `intent=save|publish|unpublish`, `payload=JSON.stringify({name,handle,configuration,styling,settings,revision})`; server returns `{ok:true,page}` or `{error,errors?,conflict?}`. Revision check prevents lost writes; draft autosave is debounced and serialized, do not overwrite edits while save pending. Published snapshot separate; save does not change currently published version. List action accepts `intent=create|duplicate|publish|unpublish|delete`, `name`, `handle`, `templateId`, `id`; create/duplicate redirect editor. Delete requires in-UI confirmation, preserves submitted application snapshot with nullable page relation.

## Database (parent owns Prisma and backend)

RegistrationPage: id, shop, name, handle, status, configuration JSON, styling JSON, settings JSON, publishedSnapshot JSON?, revision, createdAt, updatedAt, publishedAt; unique shop+handle.
WholesaleApplication: id, shop, registrationPageId?, pageName, status, submittedData JSON, configurationSnapshot JSON, settingsSnapshot JSON, companyName, applicantName, email, country, customerId?, companyId?, companyLocationId?, companyContactId?, adminNote, integrationError?, integrationState JSON, version, createdAt, updatedAt. Status values pending, under_review, information_required, approved, rejected, on_hold.
ApplicationFile: id, shop, applicationId, fieldId, filename, mimeType, size, data Bytes; private authorized access.
SubmissionNonce: id, shop, pageId, expiresAt (single-use transaction).
SubmissionRate: id (hash), shop, windowStart, count.
EmailNotification: id, shop, applicationId, event, recipient, subject, body, status, error?, createdAt, sentAt?. SMTP outbox, explicit errors and retries.

Application detail loader `{application, files, notifications, emailConfigured}`. Action fields intent `approve|reject|information|hold|review|retry_email`, note, version, optional customerId/companyId/companyLocationId/catalogId/paymentTermsTemplateId. Error prevents false approved status; persist remote IDs immediately for retries, use processing lock to prevent double approval. Successful response `{ok:true}`; errors `{error}`. List loader `{applications,pages}` search/status query filters, bounded pagination.

## Verification and deployment

Use meaningful unit tests for tree movement, validation, hidden conditions, mapping and shop boundaries; database integration tests on isolated SQLite DB; browser tests for drag between columns and shared responsive renderer. Do not change production data or push/deploy without task authorization. Live verification requires configured Shopify installation, proxy, customer/company access and SMTP provider. No frontend auth bypass in app routes.
