/* eslint-disable react/prop-types -- File metadata comes from the authenticated loader. */
import { useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import {
  Feedback,
  Status,
  formatDate,
  parseObject,
} from "../components/registration/AdminUI";
export {
  applicationLoader as loader,
  applicationAction as action,
} from "../registration/applications.server";

function DownloadDocument({ file }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      // Use global fetch so App Bridge can attach the embedded session token.
      const response = await fetch(
        `/app/application-files/${encodeURIComponent(file.id)}`,
        { credentials: "same-origin", headers: { Accept: file.mimeType } },
      );
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Your session could not authorize this download. Reload the app and try again."
            : "The document could not be downloaded. Please try again.",
        );
      }
      const mimeType = response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      const expectedMimeType = String(file.mimeType || "").toLowerCase();
      if (
        !["application/pdf", "image/jpeg", "image/png"].includes(mimeType) ||
        mimeType !== expectedMimeType
      ) {
        throw new Error(
          "The download returned an unexpected response. Reload the app and try again.",
        );
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      try {
        anchor.href = objectUrl;
        anchor.download = file.filename;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        // Keep the URL alive briefly so the browser can begin reading the blob.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The document could not be downloaded. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="registration-block">
      <button
        type="button"
        className="registration-button"
        disabled={busy}
        aria-busy={busy}
        onClick={download}
      >
        {busy ? "Downloading…" : `Download ${file.filename}`}
      </button>
      {error && (
        <p className="registration-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function displayValue(value) {
  if (value === undefined || value === null || value === "")
    return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "object")
    return value.filename || value.name || "Document attached";
  return String(value);
}
export default function ApplicationDetail() {
  const {
    application,
    files = [],
    notifications = [],
    emailConfigured,
  } = useLoaderData();
  const data = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const snapshot = parseObject(application.configurationSnapshot);
  const configuration = snapshot.configuration || snapshot;
  const values = parseObject(application.submittedData);
  const settings = parseObject(application.settingsSnapshot);
  const fields = (configuration.sections || []).flatMap((section) =>
    (section.rows || []).flatMap((row) =>
      (row.columns || []).flatMap((column) => column.fields || []),
    ),
  );
  const declaredIds = new Set(fields.map((field) => field.id));
  const extraEntries = Object.entries(values).filter(
    ([key]) => !declaredIds.has(key),
  );
  return (
    <s-page
      heading={
        application.companyName ||
        application.applicantName ||
        "Application details"
      }
    >
      <div className="registration-admin">
        <Link to="/app/applications">← All applications</Link>
        <div className="registration-detail-heading">
          <div>
            <h1>{application.companyName || "Wholesale application"}</h1>
            <p>
              {application.applicantName}
              {application.email && (
                <>
                  {" "}
                  ·{" "}
                  <a href={`mailto:${application.email}`}>
                    {application.email}
                  </a>
                </>
              )}
            </p>
            <p className="registration-muted">
              {application.pageName} · Submitted{" "}
              {formatDate(application.createdAt)} ·{" "}
              {application.country || "Country not provided"}
            </p>
          </div>
          <Status value={application.status} />
        </div>
        <Feedback data={data} />
        {application.integrationError && (
          <div className="registration-error" role="alert">
            <strong>Shopify integration needs attention</strong>
            <p>{application.integrationError}</p>
            <p>
              Check the details below before retrying approval. Any Shopify
              records already created are retained for the next attempt.
            </p>
          </div>
        )}
        <div className="registration-detail-grid">
          <div>
            <section className="registration-panel">
              <div className="registration-panel-heading">
                <h2>Submitted information</h2>
              </div>
              <p className="registration-panel-note">
                These answers use the form as it appeared when the application
                was submitted.
              </p>
              {(configuration.sections || []).map((section) => {
                const sectionFields = (section.rows || [])
                  .flatMap((row) =>
                    (row.columns || []).flatMap(
                      (column) => column.fields || [],
                    ),
                  )
                  .filter(
                    (field) =>
                      ![
                        "heading",
                        "paragraph",
                        "divider",
                        "spacer",
                        "password",
                        "confirmPassword",
                      ].includes(field.type) &&
                      (Object.hasOwn(values, field.id) ||
                        files.some((file) => file.fieldId === field.id)),
                  );
                return sectionFields.length ? (
                  <section
                    className="registration-answer-section"
                    key={section.id}
                  >
                    <h3>{section.title || "Application details"}</h3>
                    <dl className="registration-answers">
                      {sectionFields.map((field) => (
                        <div key={field.id}>
                          <dt>{field.label || field.name}</dt>
                          <dd>
                            {field.type === "file"
                              ? files
                                  .filter((file) => file.fieldId === field.id)
                                  .map((file) => (
                                    <DownloadDocument
                                      key={file.id}
                                      file={file}
                                    />
                                  ))
                              : displayValue(values[field.id])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null;
              })}
              {extraEntries.length > 0 && (
                <section className="registration-answer-section">
                  <h3>Additional submitted information</h3>
                  <dl className="registration-answers">
                    {extraEntries.map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{displayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {!fields.length && !extraEntries.length && (
                <p className="registration-panel-note">
                  No submitted fields are available.
                </p>
              )}
            </section>
            <section className="registration-panel">
              <div className="registration-panel-heading">
                <h2>
                  Documents{" "}
                  <span className="registration-count">{files.length}</span>
                </h2>
              </div>
              {files.length ? (
                <ul className="registration-document-list">
                  {files.map((file) => (
                    <li key={file.id}>
                      <DownloadDocument file={file} />
                      <small>
                        {Math.max(1, Math.ceil(file.size / 1024))} KB ·{" "}
                        {file.mimeType}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="registration-panel-note">
                  No documents were submitted.
                </p>
              )}
            </section>
            <section className="registration-panel">
              <div className="registration-panel-heading">
                <h2>Email activity</h2>
              </div>
              {!emailConfigured && (
                <p className="registration-warning">
                  Email delivery is not configured. Configure SMTP on the server
                  before sending applicant notifications.
                </p>
              )}
              {notifications.length ? (
                <ul className="registration-email-list">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <div className="registration-panel-heading">
                        <strong>{notification.subject}</strong>
                        <Status value={notification.status} />
                      </div>
                      <p>
                        {notification.recipient} · {notification.event} ·{" "}
                        {formatDate(
                          notification.sentAt || notification.createdAt,
                        )}
                      </p>
                      {notification.error && (
                        <p className="registration-error">
                          {notification.error}
                        </p>
                      )}
                      {notification.status !== "sent" && (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="retry_email"
                          />
                          <input
                            type="hidden"
                            name="notificationId"
                            value={notification.id}
                          />
                          <input
                            type="hidden"
                            name="version"
                            value={application.version}
                          />
                          <button
                            className="registration-button"
                            disabled={busy || !emailConfigured}
                          >
                            Retry email
                          </button>
                        </Form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="registration-panel-note">
                  No email notifications have been recorded.
                </p>
              )}
            </section>
          </div>
          <aside>
            <section className="registration-panel">
              <div className="registration-panel-heading">
                <h2>Review application</h2>
              </div>
              <Form method="post" className="registration-review-form">
                <input
                  type="hidden"
                  name="version"
                  value={application.version}
                />
                <label>
                  Review note / applicant message
                  <textarea
                    name="note"
                    rows={5}
                    defaultValue={application.adminNote || ""}
                    placeholder="Add context for your decision or explain the information you need."
                  />
                  <small>
                    This message may be included in the applicant email when its
                    template uses the message variable.
                  </small>
                </label>
                <details>
                  <summary>Shopify approval settings</summary>
                  <p className="registration-muted">
                    Optional existing record IDs. Leave blank to use the page’s
                    approval configuration.
                  </p>
                  {[
                    ["customerId", "Customer ID", application.customerId],
                    ["companyId", "Company ID", application.companyId],
                    [
                      "companyLocationId",
                      "Company location ID",
                      application.companyLocationId,
                    ],
                    ["catalogId", "Catalog ID", settings.approval?.catalogId],
                    [
                      "paymentTermsTemplateId",
                      "Payment terms template ID",
                      settings.approval?.paymentTermsTemplateId,
                    ],
                  ].map(([name, label, value]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={name}
                        defaultValue={value || ""}
                        placeholder="gid://shopify/…"
                      />
                    </label>
                  ))}
                  <p className="registration-muted">
                    B2B company approvals require the relevant Shopify features
                    and API permissions.
                  </p>
                </details>
                <div className="registration-review-actions">
                  <button
                    className="registration-button registration-button--primary"
                    name="intent"
                    value="approve"
                    disabled={busy || application.status === "approved"}
                  >
                    {busy && navigation.formData?.get("intent") === "approve"
                      ? "Approving…"
                      : "Approve application"}
                  </button>
                  <button
                    className="registration-button"
                    name="intent"
                    value="review"
                    disabled={busy}
                  >
                    Mark under review / save note
                  </button>
                  <button
                    className="registration-button"
                    name="intent"
                    value="information"
                    disabled={busy}
                  >
                    Request more information
                  </button>
                  <button
                    className="registration-button"
                    name="intent"
                    value="hold"
                    disabled={busy}
                  >
                    Put on hold
                  </button>
                  <button
                    className="registration-button registration-button--danger"
                    name="intent"
                    value="reject"
                    disabled={busy}
                    onClick={(event) => {
                      if (
                        !window.confirm(
                          "Reject this application? An email will be sent if rejection notifications are enabled.",
                        )
                      )
                        event.preventDefault();
                    }}
                  >
                    Reject application
                  </button>
                </div>
                <p className="registration-muted">
                  Notifications follow the email settings saved with this
                  application. Delivery status is shown in Email activity.
                </p>
              </Form>
            </section>
          </aside>
        </div>
      </div>
    </s-page>
  );
}
