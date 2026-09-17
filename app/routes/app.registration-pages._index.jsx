import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import {
  EmptyState,
  Feedback,
  Status,
  formatDate,
} from "../components/registration/AdminUI";
import { TEMPLATES } from "../registration/schema";
export {
  listLoader as loader,
  listAction as action,
} from "../registration/pages.server";

export default function RegistrationPages() {
  const { pages = [], shop } = useLoaderData();
  const data = useActionData();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const busy = navigation.state !== "idle";
  return (
    <s-page heading="Registration pages">
      <div className="registration-admin">
        <p className="registration-lede">
          Create a welcoming first step for your wholesale customers. Publish a
          form, share its link, and review every application in one place.
        </p>
        <Feedback data={data} />
        <section
          className="registration-panel"
          aria-labelledby="create-page-heading"
        >
          <div className="registration-panel-heading">
            <h2 id="create-page-heading">Create a registration page</h2>
            <Link to="/app/registration-templates">Explore templates →</Link>
          </div>
          <Form method="post" className="registration-create-form">
            <input type="hidden" name="intent" value="create" />
            <label>
              Page name
              <input
                name="name"
                required
                maxLength={120}
                placeholder="Wholesale application"
              />
            </label>
            <label>
              URL handle
              <input
                name="handle"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={80}
                placeholder="wholesale-application"
              />
              <small>Lowercase letters, numbers, and hyphens</small>
            </label>
            <label>
              Starting point
              <select
                name="templateId"
                defaultValue={params.get("template") || "blank"}
              >
                <option value="blank">Blank page</option>
                {TEMPLATES.filter((t) => t.id !== "blank").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="registration-button registration-button--primary"
              disabled={busy}
            >
              {busy && navigation.formData?.get("intent") === "create"
                ? "Creating…"
                : "Create page"}
            </button>
          </Form>
        </section>
        <section className="registration-panel" aria-labelledby="pages-heading">
          <div className="registration-panel-heading">
            <h2 id="pages-heading">
              Your pages{" "}
              <span className="registration-count">{pages.length}</span>
            </h2>
            <span className="registration-muted">
              Draft changes stay private until published
            </span>
          </div>
          {!pages.length ? (
            <EmptyState title="Your next wholesale customer starts here">
              Create your first registration page using the form above, or
              choose a template to get started.
            </EmptyState>
          ) : (
            <div className="registration-table-wrap">
              <table className="registration-table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id}>
                      <td>
                        <Link
                          className="registration-title-link"
                          to={`/app/registration-pages/${page.id}`}
                        >
                          {page.name}
                        </Link>
                        <small className="registration-block">
                          /apps/wholesale/{page.publishedHandle || page.handle}
                        </small>
                      </td>
                      <td>
                        <Status value={page.status} />
                      </td>
                      <td>{formatDate(page.updatedAt)}</td>
                      <td>
                        <div className="registration-actions">
                          <Link to={`/app/registration-pages/${page.id}`}>
                            Edit
                          </Link>
                          <Link
                            to={`/app/registration-pages/${page.id}?preview=1`}
                          >
                            Preview
                          </Link>
                          {page.status === "published" && (
                            <a
                              href={`https://${shop}/apps/wholesale/${encodeURIComponent(page.publishedHandle || page.handle)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Live page ↗
                            </a>
                          )}
                          <Form method="post">
                            <input type="hidden" name="id" value={page.id} />
                            <button
                              name="intent"
                              value="duplicate"
                              disabled={busy}
                            >
                              Duplicate
                            </button>
                          </Form>
                          <Form method="post">
                            <input type="hidden" name="id" value={page.id} />
                            <button
                              name="intent"
                              value={
                                page.status === "published"
                                  ? "unpublish"
                                  : "publish"
                              }
                              disabled={busy}
                            >
                              {page.status === "published"
                                ? "Unpublish"
                                : "Publish"}
                            </button>
                          </Form>
                          <Form
                            method="post"
                            onSubmit={(event) => {
                              if (
                                !window.confirm(
                                  `Delete “${page.name}”? Its registration link will stop working. Existing applications will be kept.`,
                                )
                              )
                                event.preventDefault();
                            }}
                          >
                            <input type="hidden" name="id" value={page.id} />
                            <button
                              className="registration-danger-link"
                              name="intent"
                              value="delete"
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </s-page>
  );
}
