/* eslint-disable react/prop-types */
// Browser-only test fixtures. No real authentication, data, email, or Shopify API.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
  useLoaderData,
  redirect,
} from "react-router";
import RegistrationBuilder from "../../app/components/registration/RegistrationBuilder";
import FormRenderer, {
  formStyle,
} from "../../app/components/registration/FormRenderer";
import {
  createTemplate,
  createField,
  createRow,
  defaultStyling,
  defaultSettings,
  validateConfiguration,
  validateSubmission,
} from "../../app/registration/schema";
import "./harness.css";

const STORAGE_KEY = "registration-development-fixture-v1";
const copy = (value) => JSON.parse(JSON.stringify(value));
function fixture(kind = "blank") {
  const configuration = createTemplate(
    ["standard", "boutique", "distributor"].includes(kind) ? kind : "blank",
  );
  if (kind === "two-column") {
    configuration.title = "Wholesale application";
    const section = configuration.sections[0];
    section.title = "Business details";
    const row = createRow(2);
    row.columns[0].fields = [
      { ...createField("company_name"), required: true },
    ];
    row.columns[1].fields = [
      { ...createField("contact_email"), required: true },
    ];
    section.rows = [row, createRow(2)];
  }
  const now = new Date().toISOString();
  return {
    id: "browser-fixture",
    shop: "fixture.myshopify.com",
    name: "Development registration",
    handle: "development-registration",
    status: "draft",
    configuration,
    styling: copy(defaultStyling),
    settings: copy(defaultSettings),
    revision: 1,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
function readPage() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value?.configuration) return value;
  } catch {
    /* Reset an obsolete local fixture. */
  }
  const page = fixture();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(page));
  return page;
}
function load() {
  return {
    page: readPage(),
    shop: "fixture.myshopify.com",
    emailConfigured: false,
  };
}
async function action({ request }) {
  const form = await request.formData();
  const current = readPage();
  let payload;
  try {
    payload = JSON.parse(form.get("payload"));
  } catch {
    return { error: "Invalid test payload." };
  }
  if (Number(payload?.revision) !== current.revision)
    return {
      error: "This fixture changed in another tab. Reload to continue.",
      conflict: true,
    };
  const intent = form.get("intent");
  if (!["save", "publish", "unpublish"].includes(intent))
    return { error: "Unsupported test intent." };
  if (intent === "publish") {
    const errors = validateConfiguration(payload.configuration);
    if (errors.length)
      return { error: "Resolve form validation before publishing.", errors };
  }
  const next = {
    ...current,
    ...payload,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  if (intent === "publish") {
    next.status = "published";
    next.publishedAt = next.updatedAt;
    next.publishedSnapshot = copy({
      configuration: next.configuration,
      styling: next.styling,
      settings: next.settings,
    });
  } else if (intent === "unpublish") {
    next.status = "draft";
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { ok: true, page: next };
}
function Shell() {
  return (
    <>
      <header className="harness-header">
        <strong>Development test harness</strong>
        <span>Local fixtures only · No Shopify connection</span>
        <nav>
          <Link to="/builder">Builder</Link>
          <Link to="/form">Form</Link>
          <Link to="/form?published=1">Published form</Link>
        </nav>
      </header>
      <div className="harness-fixtures">
        <span>Reset fixture:</span>
        {["blank", "two-column", "standard", "boutique", "distributor"].map(
          (kind) => (
            <a key={kind} href={`/fixture/${kind}`}>
              {kind}
            </a>
          ),
        )}
      </div>
      <main className="harness-main">
        <Outlet />
      </main>
    </>
  );
}
function Builder() {
  return <RegistrationBuilder {...useLoaderData()} />;
}
function PublicForm() {
  const { page, published } = useLoaderData();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);
  const snapshot = published ? page.publishedSnapshot : page;
  if (!snapshot)
    return (
      <p role="status">
        No published fixture exists. Publish the builder first.
      </p>
    );
  return (
    <div className="harness-public" style={formStyle(snapshot.styling)}>
      <p className="harness-fixture-label">
        {published ? "Published snapshot" : "Saved draft"} · Test submissions
        stay in this browser
      </p>
      {submitted ? (
        <section className="reg-form">
          <h1>{snapshot.settings.successHeading}</h1>
          <p>{snapshot.settings.successDescription}</p>
          <p role="status">
            Test validation passed. No data was sent to Shopify.
          </p>
          <button onClick={() => setSubmitted(null)}>
            Test another submission
          </button>
          <details>
            <summary>Validated test values</summary>
            <pre>{JSON.stringify(submitted, null, 2)}</pre>
          </details>
        </section>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const result = validateSubmission(snapshot.configuration, values);
            setErrors(result.errors);
            if (Object.keys(result.errors).length === 0)
              setSubmitted(result.values);
          }}
        >
          <FormRenderer
            configuration={snapshot.configuration}
            styling={snapshot.styling}
            values={values}
            errors={errors}
            onChange={(id, value) =>
              setValues((old) => ({ ...old, [id]: value }))
            }
          />
          {Object.keys(errors).length > 0 && (
            <p role="alert">Please correct the highlighted fields.</p>
          )}
          <button className="harness-submit" type="submit">
            {snapshot.styling.buttonText}
          </button>
        </form>
      )}
    </div>
  );
}
const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: "/", loader: () => redirect("/builder") },
      { path: "/builder", loader: load, action, element: <Builder /> },
      {
        path: "/app/registration-pages/browser-fixture",
        loader: load,
        action,
        element: <Builder />,
      },
      { path: "/app/registration-pages", loader: () => redirect("/builder") },
      {
        path: "/form",
        loader: ({ request }) => ({
          page: readPage(),
          published: new URL(request.url).searchParams.get("published") === "1",
        }),
        element: <PublicForm />,
      },
      {
        path: "/fixture/:kind",
        loader: ({ params }) => {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(fixture(params.kind)),
          );
          return redirect("/builder");
        },
      },
    ],
  },
]);
createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />,
);
