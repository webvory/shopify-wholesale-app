import test from "node:test";
import assert from "node:assert/strict";
import {
  createTemplate,
  createField,
  allFields,
  validateConfiguration,
  validateDraftConfiguration,
  validateSubmission,
  visibleFields,
} from "../app/registration/schema.js";

function form(...fields) {
  const config = createTemplate();
  config.sections[0].rows[0].columns[0].fields = fields;
  return config;
}

test("application summary roles survive renaming built-in fields", () => {
  const company = createField("company_name");
  company.name = "legal_trading_identity";
  company.label = "Your trading identity";
  assert.equal(company.summaryRole, "company");
  assert.deepEqual(validateConfiguration(form(company)), []);
  const email = createField("text");
  email.summaryRole = "email";
  assert.ok(
    validateSubmission(form(email), { [email.id]: "not-an-email" }).errors[
      email.id
    ],
  );
  email.summaryRole = "unknown_role";
  assert.ok(validateConfiguration(form(email)).length);
});
test("every template is a complete, independent valid configuration", () => {
  for (const name of ["blank", "standard", "boutique", "distributor"]) {
    const config = createTemplate(name);
    assert.deepEqual(validateConfiguration(config), []);
    assert.notEqual(config.sections[0].id, createTemplate(name).sections[0].id);
    if (name !== "blank") assert.ok(allFields(config).length >= 20);
  }
});
test("required and hidden data use the same dependency evaluation, independent of order", () => {
  const gate = createField("checkbox"),
    dependent = createField("text"),
    nested = createField("email");
  gate.name = "gate";
  dependent.name = "dependent";
  nested.name = "nested";
  dependent.conditions = {
    match: "all",
    rules: [{ fieldId: gate.id, operator: "equals", value: "true" }],
  };
  nested.conditions = {
    match: "all",
    rules: [{ fieldId: dependent.id, operator: "is_not_empty" }],
  };
  nested.required = true;
  const config = form(nested, dependent, gate);
  assert.deepEqual(
    visibleFields(config, { [gate.id]: false, [dependent.id]: "stale" }).map(
      (field) => field.id,
    ),
    [gate.id],
  );
  assert.deepEqual(
    validateSubmission(config, {
      [gate.id]: false,
      [dependent.id]: "stale",
      [nested.id]: "secret",
      unknown: "bad",
    }),
    { values: { [gate.id]: false }, errors: {} },
  );
  assert.ok(
    validateSubmission(config, { [gate.id]: true, [dependent.id]: "visible" })
      .errors[nested.id],
  );
});
test("section dependencies hide values and reject self-reference and multi-field cycles", () => {
  const a = createField("text"),
    b = createField("email");
  a.conditions = {
    match: "all",
    rules: [{ fieldId: b.id, operator: "is_not_empty" }],
  };
  b.conditions = {
    match: "all",
    rules: [{ fieldId: a.id, operator: "is_not_empty" }],
  };
  assert.match(validateConfiguration(form(a, b)).join(" "), /cycle/);
  const config = form(createField("text"));
  config.sections[0].conditions = {
    match: "all",
    rules: [
      { fieldId: allFields(config)[0].id, operator: "equals", value: "yes" },
    ],
  };
  assert.match(validateConfiguration(config).join(" "), /cycle/);
});
test("reject invalid field structures and malformed rules without throwing", () => {
  for (const bad of [
    null,
    [],
    {},
    { version: 1, title: "x", sections: [null] },
    { version: 1, title: "x", sections: [{ id: "s", rows: "bad" }] },
  ])
    assert.ok(validateConfiguration(bad).length);
  const field = createField("text");
  field.conditions = { rules: { foo: true } };
  assert.ok(validateConfiguration(form(field)).length);
  assert.ok(validateSubmission(null, {}).errors._form);
  assert.ok(validateSubmission(createTemplate(), []).errors._form);
});
test("passwords, unsafe mappings, dangling conditions and regex rules cannot publish", () => {
  assert.match(
    validateConfiguration(form(createField("password"))).join(" "),
    /passwordless/,
  );
  const field = createField("file");
  field.dataDestination = { type: "customer", key: "email" };
  assert.match(validateConfiguration(form(field)).join(" "), /private files/);
  const field2 = createField("text");
  field2.conditions = {
    match: "all",
    rules: [{ fieldId: "missing", operator: "equals", value: "yes" }],
  };
  field2.validation = { pattern: "(a+)+$" };
  assert.equal(validateConfiguration(form(field2)).length, 2);
});
test("validation rejects forged choice values, malformed emails, schemes, dates, ranges and length", () => {
  const cases = [
    ["email", "a@b"],
    ["url", "javascript:alert(1)"],
    ["date", "2026-02-30"],
    ["number", "Infinity"],
    ["select", "forged"],
    ["checkboxGroup", ["forged"]],
    ["phone", "letters"],
  ];
  for (const [type, value] of cases) {
    const field = createField(type);
    assert.ok(
      validateSubmission(form(field), { [field.id]: value }).errors[field.id],
      type,
    );
  }
  const number = createField("number");
  number.validation = { min: 2, max: 5, integer: true };
  for (const value of [1, 6, 2.5])
    assert.ok(
      validateSubmission(form(number), { [number.id]: value }).errors[
        number.id
      ],
    );
  const text = createField("text");
  text.characterLimit = 3;
  assert.ok(
    validateSubmission(form(text), { [text.id]: "long" }).errors[text.id],
  );
});
test("optional omitted fields remain absent while checkbox consent is enforced", () => {
  const email = createField("email"),
    consent = createField("terms");
  assert.ok(
    validateSubmission(form(email, consent), { [consent.id]: false }).errors[
      consent.id
    ],
  );
  assert.deepEqual(
    validateSubmission(form(email, consent), { [consent.id]: "on" }),
    { values: { [consent.id]: true }, errors: {} },
  );
});
test("files enforce MIME, extension, positive byte length, max size and count", () => {
  const field = createField("file"),
    configuration = form(field);
  const file = {
    name: "certificate.pdf",
    type: "application/pdf",
    size: 42,
    arrayBuffer: async () => new ArrayBuffer(42),
  };
  assert.deepEqual(
    validateSubmission(configuration, { [field.id]: file }).errors,
    {},
  );
  for (const bad of [
    { ...file, name: "evil.html" },
    { ...file, type: "text/html" },
    { ...file, size: 0 },
    { ...file, size: 6 * 1024 * 1024 },
    { ...file, arrayBuffer: undefined },
  ])
    assert.ok(
      validateSubmission(configuration, { [field.id]: bad }).errors[field.id],
    );
  assert.ok(
    validateSubmission(configuration, { [field.id]: [file, file] }).errors[
      field.id
    ],
  );
});

test("drafts preserve incomplete edits while publication requires valid names, options and mappings", () => {
  const field = createField("select");
  field.name = "";
  field.options = [];
  field.dataDestination = { type: "company_metafield", namespace: "", key: "" };
  const configuration = form(field);
  assert.deepEqual(validateDraftConfiguration(configuration), []);
  assert.ok(validateConfiguration(configuration).length >= 3);
  field.conditions = {
    match: "all",
    rules: [{ fieldId: "", operator: "equals", value: "" }],
  };
  assert.deepEqual(validateDraftConfiguration(configuration), []);
  field.conditions.rules = {};
  assert.ok(validateDraftConfiguration(configuration).length);
});

test("checkbox coercion is explicit and scalar/choice shapes cannot be forged", () => {
  const checkbox = createField("checkbox"),
    text = createField("text"),
    multi = createField("multiselect");
  for (const value of [true, "true", "on"])
    assert.equal(
      validateSubmission(form(checkbox), { [checkbox.id]: value }).values[
        checkbox.id
      ],
      true,
    );
  for (const value of [false, "false", "", undefined])
    assert.equal(
      validateSubmission(form(checkbox), { [checkbox.id]: value }).values[
        checkbox.id
      ],
      false,
    );
  for (const value of ["yes", 1, [], {}, ["on"]])
    assert.ok(
      validateSubmission(form(checkbox), { [checkbox.id]: value }).errors[
        checkbox.id
      ],
    );
  for (const value of [[], ["a", "b"], {}, true])
    assert.ok(
      validateSubmission(form(text), { [text.id]: value }).errors[text.id],
    );
  assert.ok(
    validateSubmission(form(multi), { [multi.id]: "Option 1" }).errors[
      multi.id
    ],
  );
});

test("hidden section values cannot activate dependent fields or be persisted", () => {
  const gate = createField("checkbox"),
    child = createField("text"),
    dependent = createField("email");
  child.defaultValue = "secret";
  const config = form(gate);
  const hidden = createTemplate().sections[0];
  hidden.conditions = {
    match: "all",
    rules: [{ fieldId: gate.id, operator: "equals", value: "true" }],
  };
  hidden.rows[0].columns[0].fields = [child];
  config.sections.push(hidden);
  dependent.conditions = {
    match: "all",
    rules: [{ fieldId: child.id, operator: "equals", value: "secret" }],
  };
  dependent.required = true;
  config.sections[0].rows[0].columns[0].fields.push(dependent);
  const result = validateSubmission(config, {
    [gate.id]: false,
    [child.id]: "secret",
    [dependent.id]: { malformed: true },
  });
  assert.deepEqual(result, { values: { [gate.id]: false }, errors: {} });
});

test("prototype identifiers, malicious MIME names and stored passwords are rejected", () => {
  const text = createField("text");
  text.id = "__proto__";
  assert.ok(validateConfiguration(form(text)).length);
  const password = createField("password");
  password.defaultValue = "do-not-store";
  assert.ok(validateDraftConfiguration(form(password)).length);
  const file = createField("file");
  assert.ok(
    validateSubmission(form(file), {
      [file.id]: {
        name: "test.pdf",
        type: "constructor",
        size: 1,
        arrayBuffer: async () => new ArrayBuffer(1),
      },
    }).errors[file.id],
  );
});

test("Shopify mappings require supported fields and validate mapped email/country values", () => {
  const text = createField("text");
  text.dataDestination = { type: "customer", key: "password" };
  assert.ok(validateConfiguration(form(text)).length);
  text.dataDestination = { type: "customer", key: "email" };
  assert.ok(
    validateSubmission(form(text), { [text.id]: "not-email" }).errors[text.id],
  );
  text.dataDestination = { type: "address", key: "countryCode" };
  assert.ok(
    validateSubmission(form(text), { [text.id]: "United States" }).errors[
      text.id
    ],
  );
  assert.equal(
    validateSubmission(form(text), { [text.id]: "us" }).values[text.id],
    "US",
  );
  text.dataDestination = {
    type: "customer_metafield",
    namespace: "wholesale",
    key: "business_type",
    metafieldType: "single_line_text_field",
  };
  assert.deepEqual(validateConfiguration(form(text)), []);
  text.dataDestination.namespace = "x";
  assert.ok(validateConfiguration(form(text)).length);
  const checkbox = createField("checkbox");
  checkbox.dataDestination = { type: "customer", key: "email" };
  assert.ok(validateConfiguration(form(checkbox)).length);
});
