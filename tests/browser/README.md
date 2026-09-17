# Isolated registration browser harness

Launch from the repository root:

```powershell
node scripts/registration-browser.mjs
```

Open `http://127.0.0.1:4317/builder`. This standalone Vite server uses only local browser fixtures; it does not import app authentication/server modules and is not part of the production routes. It listens only on loopback. Nothing is sent to Shopify or an email provider.

- `/builder`: real registration editor with localStorage-backed saves and revision conflict checks. Initial fixture is blank.
- `/fixture/two-column`: resets to a small fixture with required Company Name and Email in separate columns plus an empty two-column row for dragging.
- `/fixture/standard`, `/fixture/boutique`, `/fixture/distributor`: reset to the actual schema templates.
- `/fixture/blank`: start again from an empty section.
- `/form`: shared responsive renderer showing the saved draft, with real schema submission validation and browser-only success state.
- `/form?published=1`: last published snapshot; autosaved draft changes do not replace it.

Fixture reset links deliberately reload the browser and discard unsaved edits. localStorage key: `registration-development-fixture-v1`. For conflict testing open two tabs before changing and saving one. Data and file previews are development fixtures; this harness does not test private downloads, Shopify authorization, server submission security, SMTP, or approval integrations.

Suggested checks: drag a field from the library into each column; move existing fields between columns; configure options and visibility; preview mobile/tablet/desktop; verify autosave survives refresh; publish, change draft, and compare the published form; submit invalid and valid values in `/form`.

## Recorded manual browser verification

The following checks passed against local development fixtures:

- Dragged Tax ID from the library into an empty column.
- Moved Company Name between columns.
- Confirmed autosaved changes persisted after reload.
- Confirmed the 375 px mobile preview stacks columns without horizontal overflow.
- Submitted valid values through the published fixture form and reached its success state.

These results cover the isolated harness only. They do not verify live Shopify APIs, App Bridge authenticated document downloads, SMTP delivery, or production deployment.
