/* eslint-disable react/prop-types -- Route data is validated by the registration server modules. */
import { Link, NavLink } from "react-router";
import "../../styles/registration-admin.css";

export function RegistrationNav() {
  return (
    <nav className="registration-nav" aria-label="Wholesale registration">
      <NavLink to="/app/registration-pages">Registration pages</NavLink>
      <NavLink to="/app/registration-templates">Templates</NavLink>
      <NavLink to="/app/applications">Applications</NavLink>
    </nav>
  );
}
export function Status({ value }) {
  return (
    <span className={`registration-status registration-status--${value}`}>
      {String(value || "pending").replaceAll("_", " ")}
    </span>
  );
}
export function Feedback({ data }) {
  if (!data) return null;
  return (
    <div
      className={data.error ? "registration-error" : "registration-success"}
      role={data.error ? "alert" : "status"}
    >
      {data.error || (data.ok ? "Changes saved." : "")}
      {data.errors?.length > 0 && (
        <ul>
          {data.errors.map((error, i) => (
            <li key={i}>
              {typeof error === "string" ? error : JSON.stringify(error)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function EmptyState({ title, children, href, action }) {
  return (
    <div className="registration-empty">
      <span className="registration-eyebrow">Wholesale Engine AI</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {href && (
        <Link
          className="registration-button registration-button--primary"
          to={href}
        >
          {action}
        </Link>
      )}
    </div>
  );
}
export function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "—";
}
export function parseObject(value, fallback = {}) {
  if (typeof value !== "string") return value || fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
