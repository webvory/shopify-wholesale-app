import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import {
  EmptyState,
  Status,
  formatDate,
} from "../components/registration/AdminUI";
export { applicationsLoader as loader } from "../registration/applications.server";
const statuses = [
  "pending",
  "under_review",
  "information_required",
  "approved",
  "rejected",
  "on_hold",
];
export default function Applications() {
  const {
    applications = [],
    pages = [],
    hasMore = false,
    page = 1,
  } = useLoaderData();
  const [params] = useSearchParams();
  const busy = useNavigation().state !== "idle";
  function pageHref(value) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    return `?${next}`;
  }
  return (
    <s-page heading="Wholesale applications">
      <div className="registration-admin">
        <p className="registration-lede">
          Review your prospective wholesale customers and keep every decision
          connected to their application.
        </p>
        <Form
          method="get"
          className="registration-panel registration-filters"
          role="search"
        >
          <label className="registration-search">
            Search applications
            <input
              type="search"
              name="search"
              defaultValue={params.get("search") || ""}
              placeholder="Company, applicant, or email"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={params.get("status") || ""}>
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Registration page
            <select
              name="registrationPageId"
              defaultValue={params.get("registrationPageId") || ""}
            >
              <option value="">All pages</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button className="registration-button" disabled={busy}>
            {busy ? "Loading…" : "Apply filters"}
          </button>
          <Link to="/app/applications">Reset</Link>
        </Form>
        <section
          className="registration-panel"
          aria-label="Applications"
          aria-busy={busy}
        >
          {applications.length ? (
            <div className="registration-table-wrap">
              <table className="registration-table">
                <thead>
                  <tr>
                    <th>Company / applicant</th>
                    <th>Country</th>
                    <th>Page</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <Link
                          className="registration-title-link"
                          to={`/app/applications/${application.id}`}
                        >
                          {application.companyName ||
                            application.applicantName ||
                            "Application"}
                        </Link>
                        <span className="registration-block">
                          {application.applicantName}
                        </span>
                        <small>{application.email}</small>
                      </td>
                      <td>{application.country || "—"}</td>
                      <td>{application.pageName}</td>
                      <td>{formatDate(application.createdAt)}</td>
                      <td>
                        <Status value={application.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                params.get("search") ||
                params.get("status") ||
                params.get("registrationPageId")
                  ? "No matching applications"
                  : "Applications will appear here"
              }
              href="/app/registration-pages"
              action="Manage registration pages"
            >
              {params.get("search") ||
              params.get("status") ||
              params.get("registrationPageId")
                ? "Try a different search or reset the filters."
                : "Publish a registration page and share its storefront link to start receiving applications."}
            </EmptyState>
          )}
        </section>
        {(Number(page) > 1 || hasMore) && (
          <nav
            className="registration-pagination"
            aria-label="Application pages"
          >
            {Number(page) > 1 && (
              <Link to={pageHref(Number(page) - 1)}>← Previous</Link>
            )}
            <span>Page {page}</span>
            {hasMore && <Link to={pageHref(Number(page) + 1)}>Next →</Link>}
          </nav>
        )}
      </div>
    </s-page>
  );
}
