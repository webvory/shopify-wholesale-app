/* eslint-disable react/prop-types */
import { memo } from "react";
import {
  defaultStyling,
  visibleFields,
  allFields,
  isVisible,
  FILE_ACCEPT,
  PASSWORD_REASON,
} from "../../registration/schema";
import "./form-renderer.css";

export function formStyle(styling = {}) {
  const s = { ...defaultStyling, ...styling };
  return {
    "--reg-page": s.pageBackground,
    "--reg-form": s.formBackground,
    "--reg-border": s.borderColor,
    "--reg-radius": `${s.borderRadius}px`,
    "--reg-space": `${s.spacing}px`,
    "--reg-heading": `${s.headingSize}px`,
    "--reg-body": `${s.bodySize}px`,
    "--reg-label": `${s.labelSize}px`,
    "--reg-weight": s.fontWeight,
    "--reg-input-height": `${s.inputHeight}px`,
    "--reg-input-radius": `${s.inputRadius}px`,
    "--reg-input-border": s.inputBorderColor,
    "--reg-focus": s.focusColor,
    "--reg-button": s.buttonColor,
    "--reg-button-text": s.buttonTextColor,
    "--reg-button-radius": `${s.buttonRadius}px`,
    fontFamily: s.useThemeFont
      ? "inherit"
      : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: s.shadow ? "0 8px 28px #17291c0b" : "none",
  };
}
export const FieldControl = memo(function FieldControl({
  field,
  value,
  onChange = () => {},
  error,
  disabled = false,
}) {
  const id = `registration-${field.id}`,
    hint = `${id}-hint`,
    errorId = `${id}-error`;
  const change = (event) => onChange(field.id, event.target.value);
  const common = {
    id,
    name: `field_${field.id}`,
    disabled,
    required: field.required,
    "aria-invalid": !!error,
    "aria-describedby":
      [
        field.helpText || field.type === "file" ? hint : "",
        error ? errorId : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  if (field.type === "heading")
    return <h3 className="reg-heading">{field.label}</h3>;
  if (field.type === "paragraph")
    return (
      <p className="reg-paragraph">
        {field.label}
        {field.helpText && (
          <>
            <br />
            {field.helpText}
          </>
        )}
      </p>
    );
  if (field.type === "divider") return <hr className="reg-divider" />;
  if (field.type === "spacer")
    return <div className="reg-spacer" aria-hidden="true" />;
  if (["password", "confirmPassword"].includes(field.type))
    return (
      <div className="reg-unavailable">
        <strong>{field.label}</strong>
        <p>{PASSWORD_REASON}</p>
      </div>
    );
  const label = (
    <>
      {field.label}
      {field.required && (
        <span className="reg-required" aria-label="required">
          {" "}
          *
        </span>
      )}
    </>
  );
  let control;
  if (["radio", "checkboxGroup"].includes(field.type)) {
    return (
      <fieldset
        className={`reg-field reg-choice ${error ? "reg-has-error" : ""}`}
        disabled={disabled}
        aria-describedby={common["aria-describedby"]}
      >
        <legend>{label}</legend>
        {(field.options || []).map((option, index) => (
          <label className="reg-option" key={`${option}-${index}`}>
            <input
              name={common.name}
              type={field.type === "radio" ? "radio" : "checkbox"}
              value={option}
              checked={
                field.type === "radio"
                  ? value === option
                  : (Array.isArray(value) ? value : []).includes(option)
              }
              required={field.type === "radio" && field.required}
              onChange={(event) =>
                onChange(
                  field.id,
                  field.type === "radio"
                    ? option
                    : event.target.checked
                      ? [...(Array.isArray(value) ? value : []), option]
                      : (Array.isArray(value) ? value : []).filter(
                          (item) => item !== option,
                        ),
                )
              }
            />
            <span>{option}</span>
          </label>
        ))}
        {field.helpText && <small id={hint}>{field.helpText}</small>}
        {error && (
          <small id={errorId} className="reg-error" role="alert">
            {error}
          </small>
        )}
      </fieldset>
    );
  }
  if (field.type === "checkbox")
    control = (
      <label className="reg-option" htmlFor={id}>
        <input
          {...common}
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={(event) => onChange(field.id, event.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  else if (["select", "multiselect"].includes(field.type))
    control = (
      <select
        {...common}
        multiple={field.type === "multiselect"}
        value={field.type === "multiselect" ? (Array.isArray(value) ? value : []) : (typeof value === "string" || typeof value === "number" ? value : "")}
        onChange={
          field.type === "multiselect"
            ? (event) =>
                onChange(
                  field.id,
                  Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                )
            : change
        }
      >
        {field.type === "select" && (
          <option value="">{field.placeholder || "Select an option"}</option>
        )}
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  else if (field.type === "textarea")
    control = (
      <textarea
        {...common}
        placeholder={field.placeholder}
        value={value ?? ""}
        maxLength={Number(field.characterLimit) || undefined}
        rows={4}
        onChange={change}
      />
    );
  else if (field.type === "file")
    control = (
      <input
        {...common}
        type="file"
        accept={field.settings?.imagesOnly ? ".jpg,.jpeg,.png" : FILE_ACCEPT}
        multiple={Number(field.settings?.maxFiles) > 1}
        onChange={(event) =>
          onChange(
            field.id,
            Number(field.settings?.maxFiles) > 1
              ? Array.from(event.target.files || [])
              : event.target.files?.[0] || null,
          )
        }
      />
    );
  else
    control = (
      <input
        {...common}
        type={
          {
            phone: "tel",
            email: "email",
            number: "number",
            url: "url",
            date: "date",
          }[field.type] || "text"
        }
        placeholder={field.placeholder}
        value={value ?? ""}
        maxLength={Number(field.characterLimit) || undefined}
        min={field.validation?.min}
        max={field.validation?.max}
        step={field.validation?.integer ? 1 : "any"}
        onChange={change}
      />
    );
  return (
    <div className={`reg-field ${error ? "reg-has-error" : ""}`}>
      {field.type !== "checkbox" && <label htmlFor={id}>{label}</label>}
      {control}
      {(field.helpText || field.type === "file") && (
        <small id={hint}>
          {field.helpText}
          {field.type === "file" && (
            <span className="reg-file-help">
              {field.settings?.imagesOnly ? "JPG or PNG" : "PDF, JPG or PNG"} ·
              Up to {field.settings?.maxFiles || 1} file(s),{" "}
              {field.settings?.maxFileSizeMB || 5} MB each. Documents are
              private.
            </span>
          )}
        </small>
      )}
      {error && (
        <small id={errorId} className="reg-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
});

export default function FormRenderer({
  configuration,
  styling = {},
  values = {},
  onChange,
  errors = {},
  disabled = false,
}) {
  const withDefaults = Object.fromEntries(
    allFields(configuration).map((field) => {
      const value = Object.prototype.hasOwnProperty.call(values, field.id)
        ? values[field.id]
        : field.defaultValue;
      return [
        field.id,
        field.type === "checkbox"
          ? value === true || value === "true" || value === "on"
          : value,
      ];
    }),
  );
  const visible = new Set(
    visibleFields(configuration, withDefaults).map((field) => field.id),
  );
  const visibleValues = Object.fromEntries(
    Object.entries(withDefaults).filter(([id]) => visible.has(id)),
  );
  return (
    <div
      className={`reg-form reg-label-${styling.labelPosition || "above"}`}
      style={formStyle(styling)}
    >
      <header className="reg-form-header">
        <h2>{configuration.title}</h2>
        {configuration.description && <p>{configuration.description}</p>}
      </header>
      {(configuration.sections || []).map((section) => {
        if (!isVisible(section.conditions, visibleValues)) return null;
        const fields = section.rows.flatMap((row) =>
          row.columns.flatMap((column) => column.fields),
        );
        if (fields.length && !fields.some((field) => visible.has(field.id)))
          return null;
        return (
          <section
            className="reg-section"
            key={section.id}
            style={{
              background: section.style?.background || undefined,
              padding: section.style?.background
                ? `${section.style?.spacing ?? 24}px`
                : undefined,
              gap: `${section.style?.spacing ?? 24}px`,
              border: section.style?.border
                ? "1px solid var(--reg-border)"
                : undefined,
            }}
            aria-label={section.title || "Form section"}
          >
            {section.title && (
              <div className="reg-section-header">
                <h3>{section.title}</h3>
                {section.description && <p>{section.description}</p>}
              </div>
            )}
            {section.rows.map((row) => (
              <div
                key={row.id}
                className="reg-row"
                style={{ "--reg-columns": row.columns.length }}
              >
                {row.columns.map((column) => (
                  <div className="reg-column" key={column.id}>
                    {column.fields
                      .filter((field) => visible.has(field.id))
                      .map((field) => (
                        <div
                          className="reg-field-width"
                          key={field.id}
                          style={{ width: `${Number(field.width) || 100}%` }}
                        >
                          <FieldControl
                            field={field}
                            value={withDefaults[field.id]}
                            onChange={onChange}
                            error={errors[field.id]}
                            disabled={disabled}
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
