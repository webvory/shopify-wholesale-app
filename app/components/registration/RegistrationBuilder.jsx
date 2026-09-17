/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBeforeUnload, useBlocker, useFetcher } from "react-router";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import {
  FIELD_LIBRARY,
  allFields,
  createField,
  createSection,
  createRow,
} from "../../registration/schema";
import {
  clone,
  locate,
  moveField,
  duplicateNode,
  removeNode,
  newId,
} from "../../registration/tree";
import FormRenderer, { FieldControl, formStyle } from "./FormRenderer";
import "./registration-builder.css";

function Control({ label, value, onChange, type = "text", options, ...props }) {
  return (
    <label className="rb-control">
      <span>{label}</span>
      {type === "checkbox" ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange(event.target.checked)}
          {...props}
        />
      ) : options ? (
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        >
          {options.map((option) => (
            <option
              key={typeof option === "string" ? option : option.value}
              value={typeof option === "string" ? option : option.value}
            >
              {typeof option === "string" ? option : option.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              type === "number" && event.target.value !== ""
                ? Number(event.target.value)
                : event.target.value,
            )
          }
          {...props}
        />
      )}
    </label>
  );
}
function Drag({ id, data, children, label, disabled = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
    disabled,
  });
  return (
    <div ref={setNodeRef} className={isDragging ? "rb-dragging" : ""}>
      <button
        type="button"
        className="rb-drag"
        aria-label={label}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        &#x283f;
      </button>
      {children}
    </div>
  );
}
function Drop({ id, data, children, className = "" }) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "rb-over" : ""}`}>
      {children}
    </div>
  );
}
function Conditions({ node, fields, onChange }) {
  const conditions = node.conditions || { match: "all", rules: [] };
  const update = (index, patch) =>
    onChange({
      ...conditions,
      rules: conditions.rules.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule,
      ),
    });
  return (
    <fieldset>
      <legend>Show when</legend>
      <Control
        label="Match conditions"
        value={conditions.match}
        options={[
          { value: "all", label: "All rules (AND)" },
          { value: "any", label: "Any rule (OR)" },
        ]}
        onChange={(match) => onChange({ ...conditions, match })}
      />
      {conditions.rules.map((rule, index) => (
        <div className="rb-rule" key={index}>
          <Control
            label="Field"
            value={rule.fieldId}
            options={[
              { value: "", label: "Choose a field" },
              ...fields
                .filter((field) => field.id !== node.id)
                .map((field) => ({ value: field.id, label: field.label })),
            ]}
            onChange={(fieldId) => update(index, { fieldId })}
          />
          <Control
            label="Operator"
            value={rule.operator}
            options={[
              "equals",
              "not_equals",
              "contains",
              "not_contains",
              "greater_than",
              "less_than",
              "is_empty",
              "is_not_empty",
            ]}
            onChange={(operator) => update(index, { operator })}
          />
          {!["is_empty", "is_not_empty"].includes(rule.operator) && (
            <Control
              label="Value"
              value={rule.value}
              onChange={(value) => update(index, { value })}
            />
          )}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...conditions,
                rules: conditions.rules.filter((_, i) => i !== index),
              })
            }
          >
            Remove rule
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...conditions,
            rules: [
              ...conditions.rules,
              { fieldId: "", operator: "equals", value: "" },
            ],
          })
        }
      >
        + Add condition
      </button>
    </fieldset>
  );
}

export default function RegistrationBuilder({
  page,
  shop,
  emailConfigured,
  initialPreview = false,
}) {
  const [draft, setDraft] = useState(() => clone(page));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("Fields");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(initialPreview);
  const [viewport, setViewport] = useState("desktop");
  const [values, setValues] = useState({});
  const [dragLabel, setDragLabel] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [saved, setSaved] = useState(() => JSON.stringify(page));
  const [problem, setProblem] = useState(null);
  const pending = useRef(null);
  const handled = useRef(null);
  const revision = useRef(page.revision);
  const fetcher = useFetcher();
  const dirty = JSON.stringify(draft) !== saved;
  const busy = fetcher.state !== "idle" || !!pending.current;
  const blocker = useBlocker(dirty);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [dirty],
    ),
  );
  const edit = (change) => {
    setProblem((previous) => (previous?.conflict ? previous : null));
    setHistory((old) => ({
      past: [...old.past.slice(-49), clone(draftRef.current)],
      future: [],
    }));
    setDraft((old) => {
      const next = clone(old);
      return change(next) || next;
    });
  };
  const send = useCallback(
    (intent = "save") => {
      if (pending.current || fetcher.state !== "idle") return;
      const snapshot = clone(draftRef.current);
      snapshot.revision = revision.current;
      pending.current = { snapshot, intent };
      setProblem(null);
      fetcher.submit(
        { intent, payload: JSON.stringify(snapshot) },
        { method: "post" },
      );
    },
    [fetcher],
  );
  useEffect(() => {
    if (
      fetcher.state !== "idle" ||
      !fetcher.data ||
      handled.current === fetcher.data ||
      !pending.current
    )
      return;
    handled.current = fetcher.data;
    const request = pending.current;
    pending.current = null;
    if (fetcher.data.ok) {
      const result = fetcher.data.page;
      revision.current = result.revision;
      const metadata = {
        revision: result.revision,
        status: result.status,
        publishedAt: result.publishedAt,
        publishedHandle: result.publishedHandle,
        updatedAt: result.updatedAt,
      };
      setSaved(JSON.stringify({ ...request.snapshot, ...metadata }));
      setDraft((current) => ({ ...current, ...metadata }));
    } else setProblem(fetcher.data);
  }, [fetcher.state, fetcher.data]);
  useEffect(() => {
    if (!dirty || busy || problem) return;
    const timeout = setTimeout(() => send("save"), 1100);
    return () => clearTimeout(timeout);
  }, [dirty, busy, problem, draft, send]);
  const changeConfig = (callback) =>
    edit((next) => {
      next.configuration = callback(next.configuration) || next.configuration;
    });
  const current = locate(draft.configuration, selected)?.node;
  const fields = allFields(draft.configuration);
  const updateNode = (patch) =>
    changeConfig((config) => {
      const found = locate(config, selected);
      if (found) Object.assign(found.node, patch);
    });
  const sectionForSelection = locate(draft.configuration, selected)?.section;
  const addField = (key, columnId, index) => {
    const entry = FIELD_LIBRARY.find((item) => item.key === key);
    if (entry?.disabledReason) return;
    changeConfig((config) => {
      if (entry?.type === "section") {
        config.sections.push(createSection());
        return;
      }
      if (!config.sections.length) config.sections.push(createSection());
      const section =
        config.sections.find((item) => item.id === sectionForSelection?.id) ||
        config.sections[config.sections.length - 1];
      if (["row2", "row3"].includes(entry?.type)) {
        section.rows.push(createRow(entry.type === "row2" ? 2 : 3));
        return;
      }
      if (!section.rows.length) section.rows.push(createRow(1));
      if (!section.rows[section.rows.length - 1].columns.length)
        section.rows[section.rows.length - 1].columns.push({
          id: newId(),
          fields: [],
        });
      const column =
        locate(config, columnId || selected)?.column ||
        section.rows[section.rows.length - 1].columns[0];
      const field = createField(key);
      const names = new Set(allFields(config).map((item) => item.name));
      let suffix = 2;
      while (names.has(field.name)) field.name = key + "_" + suffix++;
      column.fields.splice(index ?? column.fields.length, 0, field);
      setSelected(field.id);
    });
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const onDragEnd = ({ active, over }) => {
    setDragLabel(null);
    if (!over) return;
    const source = active.data.current;
    const target = over.data.current;
    if (source.kind === "section" && target.kind === "section") {
      changeConfig((config) => {
        const from = config.sections.findIndex((item) => item.id === source.id);
        const to = config.sections.findIndex((item) => item.id === target.id);
        config.sections.splice(to, 0, config.sections.splice(from, 1)[0]);
      });
    } else if (source.kind === "library" && target.columnId)
      addField(source.key, target.columnId, target.index);
    else if (source.kind === "field" && target.columnId)
      changeConfig((config) =>
        moveField(config, source.id, target.columnId, target.index),
      );
  };
  const travel = (direction) => {
    const from = direction === "undo" ? history.past : history.future;
    if (!from.length) return;
    const next = clone(from[from.length - 1]);
    next.revision = revision.current;
    next.status = draft.status;
    next.updatedAt = draft.updatedAt;
    next.publishedAt = draft.publishedAt;
    next.publishedHandle = draft.publishedHandle;
    setHistory(
      direction === "undo"
        ? { past: from.slice(0, -1), future: [...history.future, clone(draft)] }
        : { past: [...history.past, clone(draft)], future: from.slice(0, -1) },
    );
    setDraft(next);
  };
  const actions = (node) => (
    <span className="rb-node-actions">
      <button
        type="button"
        aria-label="Duplicate item"
        disabled={
          !!node.fields && locate(draft.configuration, node.id).list.length >= 3
        }
        onClick={() => changeConfig((config) => duplicateNode(config, node.id))}
      >
        Duplicate
      </button>
      <button
        type="button"
        aria-label="Delete item"
        disabled={
          !!node.fields && locate(draft.configuration, node.id).list.length <= 1
        }
        onClick={() => {
          changeConfig((config) => removeNode(config, node.id));
          if (selected === node.id) setSelected(null);
        }}
      >
        Delete
      </button>
    </span>
  );
  const changeStyle = (key, value) =>
    edit((next) => {
      next.styling[key] = value;
    });
  const changeSetting = (key, value) =>
    edit((next) => {
      next.settings[key] = value;
    });

  return (
    <div className="rb">
      <header className="rb-header">
        <div>
          <Link to="/app/registration-pages">- Registration pages</Link>
          <h1>
            {draft.name || "Untitled registration page"}{" "}
            <span className="rb-status">{draft.status}</span>
          </h1>
          <p role="status">
            {busy
              ? "Saving changes…"
              : problem
                ? "Changes need attention"
                : dirty
                  ? "Unsaved changes"
                  : "All changes saved"}{" "}
            - Draft changes only go live when published.
          </p>
        </div>
        <div className="rb-toolbar">
          <button
            type="button"
            disabled={!history.past.length}
            onClick={() => travel("undo")}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!history.future.length}
            onClick={() => travel("redo")}
          >
            Redo
          </button>
          <button type="button" onClick={() => setPreview(!preview)}>
            {preview ? "Edit form" : "Preview"}
          </button>
          <button type="button" disabled={busy} onClick={() => send("save")}>
            Save draft
          </button>
          {draft.status === "published" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => send("unpublish")}
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            className="rb-primary"
            disabled={busy}
            onClick={() => send("publish")}
          >
            Publish
          </button>
        </div>
      </header>
      {problem && (
        <div className="rb-error" role="alert">
          <strong>{problem.error || "Unable to save"}</strong>
          {problem.errors?.map((error, index) => (
            <p key={index}>
              {typeof error === "string" ? error : JSON.stringify(error)}
            </p>
          ))}
          {problem.conflict && (
            <p>
              A newer version exists. Copy any important changes before
              reloading.{" "}
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Discard local edits and load the latest saved version?",
                    )
                  )
                    window.location.reload();
                }}
              >
                Load latest version
              </button>
            </p>
          )}
        </div>
      )}
      {blocker.state === "blocked" && (
        <div className="rb-error" role="alert">
          You have unsaved changes.{" "}
          <button type="button" onClick={() => blocker.reset()}>
            Keep editing
          </button>
          <button type="button" onClick={() => blocker.proceed()}>
            Leave without saving
          </button>
        </div>
      )}
      <nav className="rb-tabs" aria-label="Builder settings">
        {["Fields", "Styling", "Settings", "Emails"].map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
        <span className="rb-devices">
          {["desktop", "tablet", "mobile"].map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={viewport === item}
              onClick={() => {
                setViewport(item);
                setPreview(true);
              }}
            >
              {item}
            </button>
          ))}
        </span>
      </nav>
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const section = args.active.data.current?.kind === "section";
          const filtered = {
            ...args,
            droppableContainers: args.droppableContainers.filter((container) =>
              section
                ? container.data.current?.kind === "section"
                : !!container.data.current?.columnId,
            ),
          };
          const hits = pointerWithin(filtered);
          return hits.length ? hits : rectIntersection(filtered);
        }}
        onDragStart={({ active }) =>
          setDragLabel(active.data.current?.label || "Move item")
        }
        onDragCancel={() => setDragLabel(null)}
        onDragEnd={onDragEnd}
      >
        <div className="rb-workspace">
          <aside className="rb-library">
            <h2>{tab === "Fields" ? "Build your form" : tab}</h2>
            {tab === "Fields" ? (
              <>
                <Control
                  label="Search fields"
                  value={query}
                  onChange={setQuery}
                  type="search"
                />
                <p className="rb-hint">
                  Drag a field into any column, or click to add it. Select an
                  item to edit.
                </p>
                {[
                  ...new Set(
                    FIELD_LIBRARY.filter((entry) =>
                      `${entry.label} ${entry.key} ${entry.category} ${entry.category === "Address" ? "business" : ""}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ).map((entry) => entry.category),
                  ),
                ].map((category) => (
                  <section key={category}>
                    <h3>{category}</h3>
                    {FIELD_LIBRARY.filter(
                      (entry) =>
                        entry.category === category &&
                        `${entry.label} ${entry.key} ${entry.category} ${entry.category === "Address" ? "business" : ""}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    ).map((entry) => (
                      <div
                        className="rb-library-item"
                        key={entry.key}
                        title={entry.disabledReason || entry.label}
                      >
                        <Drag
                          id={`library:${entry.key}`}
                          data={{
                            kind: "library",
                            key: entry.key,
                            label: entry.label,
                          }}
                          label={`Drag ${entry.label}`}
                          disabled={!!entry.disabledReason}
                        >
                          <button
                            type="button"
                            disabled={!!entry.disabledReason}
                            onClick={() => addField(entry.key)}
                          >
                            {entry.label}
                          </button>
                        </Drag>
                        {entry.disabledReason && (
                          <small>{entry.disabledReason}</small>
                        )}
                      </div>
                    ))}
                  </section>
                ))}
              </>
            ) : tab === "Styling" ? (
              <>
                {[
                  "pageBackground",
                  "formBackground",
                  "borderColor",
                  "buttonColor",
                  "buttonTextColor",
                  "inputBorderColor",
                  "focusColor",
                ].map((key) => (
                  <Control
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1")}
                    type="color"
                    value={draft.styling[key]}
                    onChange={(value) => changeStyle(key, value)}
                  />
                ))}
                {[
                  "borderRadius",
                  "spacing",
                  "headingSize",
                  "bodySize",
                  "labelSize",
                  "fontWeight",
                  "buttonRadius",
                  "inputHeight",
                  "inputRadius",
                ].map((key) => (
                  <Control
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1")}
                    type="number"
                    min={0}
                    max={key === "fontWeight" ? 900 : 120}
                    value={draft.styling[key]}
                    onChange={(value) => changeStyle(key, value)}
                  />
                ))}
                <Control
                  label="Button text"
                  value={draft.styling.buttonText}
                  onChange={(value) => changeStyle("buttonText", value)}
                />
                <Control
                  label="Button width"
                  value={draft.styling.buttonWidth}
                  options={["auto", "full"]}
                  onChange={(value) => changeStyle("buttonWidth", value)}
                />
                <Control
                  label="Button alignment"
                  value={draft.styling.buttonAlignment}
                  options={["left", "center", "right"]}
                  onChange={(value) => changeStyle("buttonAlignment", value)}
                />
                <Control
                  label="Label position"
                  value={draft.styling.labelPosition}
                  options={["above", "left"]}
                  onChange={(value) => changeStyle("labelPosition", value)}
                />
                <Control
                  label="Form shadow"
                  type="checkbox"
                  value={draft.styling.shadow}
                  onChange={(value) => changeStyle("shadow", value)}
                />
                <Control
                  label="Use theme font"
                  type="checkbox"
                  value={draft.styling.useThemeFont}
                  onChange={(value) => changeStyle("useThemeFont", value)}
                />
              </>
            ) : tab === "Settings" ? (
              <>
                <Control
                  label="Page name"
                  value={draft.name}
                  onChange={(value) =>
                    edit((next) => {
                      next.name = value;
                    })
                  }
                />
                <Control
                  label="URL handle"
                  value={draft.handle}
                  onChange={(value) =>
                    edit((next) => {
                      next.handle = value;
                    })
                  }
                />
                <p className="rb-hint">
                  {draft.status === "published" ? (
                    <a
                      href={`https://${shop}/apps/wholesale/${draft.publishedHandle || draft.handle}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open live registration page
                    </a>
                  ) : (
                    <>
                      Storefront URL (available after publishing): https://
                      {shop}/apps/wholesale/{draft.handle}
                    </>
                  )}
                </p>
                {draft.publishedHandle &&
                  draft.publishedHandle !== draft.handle && (
                    <p className="rb-hint">
                      Draft URL after publishing: https://{shop}/apps/wholesale/
                      {draft.handle}. The live page currently uses /
                      {draft.publishedHandle}.
                    </p>
                  )}
                {[
                  "successHeading",
                  "successDescription",
                  "successButtonText",
                  "successRedirectUrl",
                  "adminEmail",
                ].map((key) => (
                  <Control
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1")}
                    type={key === "successDescription" ? "textarea" : "text"}
                    value={draft.settings[key]}
                    onChange={(value) => changeSetting(key, value)}
                  />
                ))}
                <h3>Approval behavior</h3>
                <Control
                  label="Account type"
                  value={draft.settings.approval.mode}
                  options={[
                    { value: "customer", label: "Customer + wholesale tag" },
                    { value: "b2b", label: "Shopify B2B company" },
                  ]}
                  onChange={(mode) =>
                    changeSetting("approval", {
                      ...draft.settings.approval,
                      mode,
                    })
                  }
                />
                {["customerTag", "catalogId", "paymentTermsTemplateId"].map(
                  (key) => (
                    <Control
                      key={key}
                      label={key.replace(/([A-Z])/g, " $1")}
                      value={draft.settings.approval[key]}
                      onChange={(value) =>
                        changeSetting("approval", {
                          ...draft.settings.approval,
                          [key]: value,
                        })
                      }
                    />
                  ),
                )}
                <p className="rb-hint">
                  B2B approval requires a store plan and permissions that
                  support Shopify companies. Use Shopify GIDs for catalog and
                  payment terms.
                </p>
              </>
            ) : (
              <>
                <p className={emailConfigured ? "rb-hint" : "rb-error"}>
                  {emailConfigured
                    ? "Email delivery is configured."
                    : "SMTP is not configured. Notifications cannot be delivered until the server email settings are added."}
                </p>
                <p className="rb-hint">
                  Variables:{" "}
                  {
                    "{{company}}, {{applicant}}, {{email}}, {{page}}, {{message}}"
                  }
                </p>
                {Object.entries(draft.settings.emails).map(([event, email]) => (
                  <fieldset key={event}>
                    <legend>{event}</legend>
                    <Control
                      label="Enabled"
                      type="checkbox"
                      value={email.enabled}
                      onChange={(enabled) =>
                        changeSetting("emails", {
                          ...draft.settings.emails,
                          [event]: { ...email, enabled },
                        })
                      }
                    />
                    {[
                      ["to", "Recipient"],
                      ["subject", "Subject"],
                      ["body", "Message"],
                    ].map(([key, label]) => (
                      <Control
                        key={key}
                        label={label}
                        type={key === "body" ? "textarea" : "text"}
                        options={
                          key === "to"
                            ? ["applicant", "admin", "both"]
                            : undefined
                        }
                        value={email[key]}
                        onChange={(value) =>
                          changeSetting("emails", {
                            ...draft.settings.emails,
                            [event]: { ...email, [key]: value },
                          })
                        }
                      />
                    ))}
                  </fieldset>
                ))}
              </>
            )}
          </aside>
          <main
            className="rb-canvas"
            style={{ background: draft.styling.pageBackground }}
          >
            <div className="rb-canvas-caption">
              <span>
                {preview
                  ? "Interactive preview - submissions disabled"
                  : "Form canvas"}
              </span>
              <span>{fields.length} fields</span>
            </div>
            <div
              className={`rb-paper rb-${viewport} reg-label-${draft.styling.labelPosition}`}
              style={{
                ...formStyle(draft.styling),
                background: draft.styling.formBackground,
                borderColor: draft.styling.borderColor,
                borderRadius: draft.styling.borderRadius,
                padding: draft.styling.spacing,
                fontSize: draft.styling.bodySize,
              }}
            >
              {preview ? (
                <>
                  <FormRenderer
                    configuration={draft.configuration}
                    styling={draft.styling}
                    values={values}
                    onChange={(id, value) =>
                      setValues((old) => ({ ...old, [id]: value }))
                    }
                  />
                  <div style={{ textAlign: draft.styling.buttonAlignment }}>
                    <button
                      type="button"
                      style={{
                        background: draft.styling.buttonColor,
                        color: draft.styling.buttonTextColor,
                        borderRadius: draft.styling.buttonRadius,
                        width:
                          draft.styling.buttonWidth === "full"
                            ? "100%"
                            : "auto",
                      }}
                      onClick={() =>
                        window.alert(
                          "Preview only. Publish this page to accept applications.",
                        )
                      }
                    >
                      {draft.styling.buttonText}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Control
                    label="Form title"
                    value={draft.configuration.title}
                    onChange={(title) =>
                      changeConfig((config) => {
                        config.title = title;
                      })
                    }
                  />
                  <Control
                    label="Introduction"
                    value={draft.configuration.description}
                    type="textarea"
                    onChange={(description) =>
                      changeConfig((config) => {
                        config.description = description;
                      })
                    }
                  />
                  {draft.configuration.sections.map((section, sectionIndex) => (
                    <Drop
                      key={section.id}
                      id={`section-target:${section.id}`}
                      data={{ kind: "section", id: section.id }}
                      className={`rb-section ${selected === section.id ? "rb-selected" : ""}`}
                    >
                      <header className="rb-section-header">
                        <Drag
                          id={`section:${section.id}`}
                          data={{
                            kind: "section",
                            id: section.id,
                            label: section.title,
                          }}
                          label={`Move section ${section.title}`}
                        >
                          <button
                            type="button"
                            className="rb-title"
                            onClick={() => setSelected(section.id)}
                          >
                            {section.title || `Section ${sectionIndex + 1}`}
                          </button>
                        </Drag>
                        {actions(section)}
                      </header>
                      {section.rows.map((row) => (
                        <div className="rb-row" key={row.id}>
                          <div className="rb-row-toolbar">
                            <button
                              type="button"
                              onClick={() => setSelected(row.id)}
                            >
                              Row - {row.columns.length} columns
                            </button>
                            <button
                              type="button"
                              disabled={row.columns.length >= 3}
                              onClick={() =>
                                changeConfig(
                                  (config) =>
                                    locate(config, row.id).node.columns.push({
                                      id: newId(),
                                      fields: [],
                                    }) && undefined,
                                )
                              }
                            >
                              + Column
                            </button>
                            {actions(row)}
                          </div>
                          <div
                            className="rb-columns"
                            style={{
                              gridTemplateColumns: `repeat(${Math.max(1, row.columns.length)}, minmax(0, 1fr))`,
                            }}
                          >
                            {row.columns.map((column) => (
                              <div className="rb-column" key={column.id}>
                                <div className="rb-column-toolbar">
                                  <button
                                    type="button"
                                    onClick={() => setSelected(column.id)}
                                  >
                                    Column
                                  </button>
                                  {actions(column)}
                                </div>
                                {column.fields.map((field, index) => (
                                  <div key={field.id}>
                                    <Drop
                                      id={`insert:${column.id}:${index}`}
                                      data={{ columnId: column.id, index }}
                                      className="rb-insert"
                                    >
                                      Drop here
                                    </Drop>
                                    <div
                                      className={`rb-field ${selected === field.id ? "rb-selected" : ""}`}
                                    >
                                      <Drag
                                        id={`field:${field.id}`}
                                        data={{
                                          kind: "field",
                                          id: field.id,
                                          label: field.label,
                                        }}
                                        label={`Move ${field.label}`}
                                      >
                                        <div className="rb-field-display">
                                          <button
                                            type="button"
                                            className="rb-field-label"
                                            aria-label={`Edit ${field.label}`}
                                            onClick={() =>
                                              setSelected(field.id)
                                            }
                                          >
                                            <small>
                                              Edit {field.type}
                                              {field.conditions?.rules?.length
                                                ? " - Conditional"
                                                : ""}
                                            </small>
                                          </button>
                                          <div
                                            className="rb-field-control"
                                            style={{
                                              width: `${Number(field.width) || 100}%`,
                                              pointerEvents: "none",
                                            }}
                                          >
                                            <FieldControl
                                              field={field}
                                              value={
                                                values[field.id] ??
                                                field.defaultValue
                                              }
                                              disabled
                                            />
                                          </div>
                                        </div>
                                      </Drag>
                                    </div>
                                  </div>
                                ))}
                                <Drop
                                  id={`insert:${column.id}:end`}
                                  data={{
                                    columnId: column.id,
                                    index: column.fields.length,
                                  }}
                                  className="rb-insert rb-insert-end"
                                >
                                  {column.fields.length
                                    ? "+ Drop field"
                                    : "Drag a field here"}
                                </Drop>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="rb-row-add">
                        {[1, 2, 3].map((count) => (
                          <button
                            type="button"
                            key={count}
                            onClick={() =>
                              changeConfig((config) => {
                                locate(config, section.id).node.rows.push(
                                  createRow(count),
                                );
                              })
                            }
                          >
                            + {count} column row
                          </button>
                        ))}
                      </div>
                    </Drop>
                  ))}
                  <button
                    type="button"
                    className="rb-add-section"
                    onClick={() =>
                      changeConfig((config) => {
                        config.sections.push(createSection());
                      })
                    }
                  >
                    + Add section
                  </button>
                </>
              )}
            </div>
          </main>
          <aside className="rb-inspector">
            <h2>{current ? "Item settings" : "Make it yours"}</h2>
            {!current ? (
              <p className="rb-hint">
                Select a field, section, row, or column on the canvas to
                configure it. Your form saves automatically.
              </p>
            ) : (
              <>
                {actions(current)}
                {current.type ? (
                  <>
                    <Control
                      label="Label"
                      value={current.label}
                      onChange={(label) => updateNode({ label })}
                    />
                    <Control
                      label="Internal field name"
                      value={current.name}
                      onChange={(name) => updateNode({ name })}
                    />
                    <Control
                      label="Application summary"
                      value={current.summaryRole || ""}
                      options={[
                        { value: "", label: "None" },
                        { value: "company", label: "Company name" },
                        { value: "firstName", label: "Applicant first name" },
                        { value: "lastName", label: "Applicant last name" },
                        { value: "email", label: "Applicant email" },
                        { value: "country", label: "Country" },
                      ]}
                      onChange={(summaryRole) => updateNode({ summaryRole })}
                    />
                    <Control
                      label="Required"
                      type="checkbox"
                      value={current.required}
                      onChange={(required) => updateNode({ required })}
                    />
                    {[
                      "placeholder",
                      "helpText",
                      "defaultValue",
                      "errorMessage",
                    ].map((key) => (
                      <Control
                        key={key}
                        label={key.replace(/([A-Z])/g, " $1")}
                        value={
                          Array.isArray(current[key])
                            ? current[key].join(", ")
                            : current[key]
                        }
                        onChange={(value) =>
                          updateNode({
                            [key]:
                              ["checkboxGroup", "multiselect"].includes(
                                current.type,
                              ) && key === "defaultValue"
                                ? value.split(",").map((part) => part.trim())
                                : value,
                          })
                        }
                      />
                    ))}
                    <Control
                      label="Field width (%)"
                      options={["25", "33", "50", "66", "75", "100"]}
                      value={current.width}
                      onChange={(width) => updateNode({ width })}
                    />
                    <Control
                      label="Character limit"
                      type="number"
                      min={1}
                      value={current.characterLimit}
                      onChange={(characterLimit) =>
                        updateNode({ characterLimit })
                      }
                    />
                    <fieldset>
                      <legend>Validation</legend>
                      <p className="rb-hint">
                        Email, phone, URL and date fields validate their format
                        automatically.
                      </p>
                      {(current.type === "number"
                        ? ["min", "max"]
                        : ["minLength", "maxLength"]
                      ).map((key) => (
                        <Control
                          key={key}
                          label={key.replace(/([A-Z])/g, " $1")}
                          type="number"
                          value={current.validation?.[key] ?? ""}
                          onChange={(value) =>
                            updateNode({
                              validation: {
                                ...current.validation,
                                [key]: value,
                              },
                            })
                          }
                        />
                      ))}
                      {current.type === "number" && (
                        <Control
                          label="Whole numbers only"
                          type="checkbox"
                          value={current.validation?.integer}
                          onChange={(integer) =>
                            updateNode({
                              validation: { ...current.validation, integer },
                            })
                          }
                        />
                      )}
                    </fieldset>
                    {[
                      "select",
                      "radio",
                      "checkboxGroup",
                      "multiselect",
                    ].includes(current.type) && (
                      <Control
                        label="Options (one per line)"
                        type="textarea"
                        value={current.options.join("\n")}
                        onChange={(value) =>
                          updateNode({ options: value.split("\n") })
                        }
                      />
                    )}
                    {current.type === "file" && (
                      <>
                        {["maxFiles", "maxFileSizeMB"].map((key) => (
                          <Control
                            key={key}
                            label={
                              key === "maxFiles"
                                ? "Maximum files"
                                : "Maximum file size (MB)"
                            }
                            type="number"
                            min={1}
                            max={key === "maxFiles" ? 5 : 10}
                            value={current.settings[key]}
                            onChange={(value) =>
                              updateNode({
                                settings: { ...current.settings, [key]: value },
                              })
                            }
                          />
                        ))}
                      </>
                    )}
                    <fieldset>
                      <legend>Data destination</legend>
                      <Control
                        label="Save to"
                        value={current.dataDestination?.type || "application"}
                        options={
                          current.type === "file"
                            ? ["application"]
                            : [
                                "application",
                                "customer",
                                "customer_tag",
                                "customer_metafield",
                                "company_metafield",
                                "company_location_metafield",
                                "address",
                              ]
                        }
                        onChange={(type) =>
                          updateNode({
                            dataDestination: {
                              ...current.dataDestination,
                              type,
                              key: "",
                              ...(type.endsWith("metafield")
                                ? {
                                    namespace:
                                      current.dataDestination?.namespace ||
                                      "custom",
                                    metafieldType:
                                      current.dataDestination?.metafieldType ||
                                      "single_line_text_field",
                                  }
                                : {}),
                            },
                          })
                        }
                      />
                      {current.dataDestination?.type !== "application" && (
                        <Control
                          label="Destination key"
                          value={current.dataDestination?.key}
                          options={
                            current.dataDestination?.type === "customer"
                              ? ["", "email", "firstName", "lastName", "phone"]
                              : current.dataDestination?.type === "address"
                                ? [
                                    "",
                                    "address1",
                                    "address2",
                                    "city",
                                    "province",
                                    "zip",
                                    "countryCode",
                                  ]
                                : undefined
                          }
                          onChange={(key) =>
                            updateNode({
                              dataDestination: {
                                ...current.dataDestination,
                                key,
                              },
                            })
                          }
                        />
                      )}
                      {current.dataDestination?.type?.endsWith("metafield") && (
                        <>
                          <Control
                            label="Namespace"
                            value={current.dataDestination.namespace}
                            onChange={(namespace) =>
                              updateNode({
                                dataDestination: {
                                  ...current.dataDestination,
                                  namespace,
                                },
                              })
                            }
                          />
                          <Control
                            label="Metafield type"
                            value={current.dataDestination.metafieldType}
                            options={[
                              "single_line_text_field",
                              "multi_line_text_field",
                              "number_integer",
                              "number_decimal",
                              "boolean",
                              "date",
                              "url",
                              "list.single_line_text_field",
                            ]}
                            onChange={(metafieldType) =>
                              updateNode({
                                dataDestination: {
                                  ...current.dataDestination,
                                  metafieldType,
                                },
                              })
                            }
                          />
                        </>
                      )}
                    </fieldset>
                    <Conditions
                      node={current}
                      fields={fields}
                      onChange={(conditions) => updateNode({ conditions })}
                    />
                    <Control
                      label="Move to column"
                      value={locate(draft.configuration, selected)?.column?.id}
                      options={draft.configuration.sections.flatMap(
                        (section, si) =>
                          section.rows.flatMap((row, ri) =>
                            row.columns.map((column, ci) => ({
                              value: column.id,
                              label: `${section.title || `Section ${si + 1}`} / row ${ri + 1} / col ${ci + 1}`,
                            })),
                          ),
                      )}
                      onChange={(columnId) =>
                        changeConfig((config) =>
                          moveField(config, selected, columnId),
                        )
                      }
                    />
                  </>
                ) : current.rows ? (
                  <>
                    <Control
                      label="Section title"
                      value={current.title}
                      onChange={(title) => updateNode({ title })}
                    />
                    <Control
                      label="Description"
                      type="textarea"
                      value={current.description}
                      onChange={(description) => updateNode({ description })}
                    />
                    <Control
                      label="Section background"
                      type="color"
                      value={current.style?.background || "#ffffff"}
                      onChange={(background) =>
                        updateNode({ style: { ...current.style, background } })
                      }
                    />
                    <Control
                      label="Section spacing"
                      type="number"
                      min={0}
                      max={80}
                      value={current.style?.spacing}
                      onChange={(spacing) =>
                        updateNode({ style: { ...current.style, spacing } })
                      }
                    />
                    <Control
                      label="Section border"
                      type="checkbox"
                      value={current.style?.border}
                      onChange={(border) =>
                        updateNode({ style: { ...current.style, border } })
                      }
                    />
                    <Conditions
                      node={current}
                      fields={fields}
                      onChange={(conditions) => updateNode({ conditions })}
                    />
                    <Control
                      label="Section position"
                      type="number"
                      min={1}
                      max={draft.configuration.sections.length}
                      value={
                        draft.configuration.sections.findIndex(
                          (section) => section.id === current.id,
                        ) + 1
                      }
                      onChange={(position) =>
                        changeConfig((config) => {
                          const index = config.sections.findIndex(
                            (section) => section.id === current.id,
                          );
                          config.sections.splice(
                            Math.max(0, position - 1),
                            0,
                            config.sections.splice(index, 1)[0],
                          );
                        })
                      }
                    />
                  </>
                ) : (
                  <p className="rb-hint">
                    Use the canvas controls to add, duplicate, or remove this{" "}
                    {current.columns ? "row" : "column"}. Drag fields between
                    columns to arrange your layout.
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
        <DragOverlay>
          {dragLabel && (
            <div className="rb-drag-overlay">&#x283f; {dragLabel}</div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
