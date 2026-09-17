/* global globalThis */
// Shared by the editor, public renderer and server. No Shopify credentials here.
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) =>
  `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
export const PASSWORD_REASON =
  "Shopify customer accounts use passwordless sign-in. Remove password fields before publishing.";
export const LAYOUT_TYPES = ["heading", "paragraph", "divider", "spacer"];
export const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png";
export const SUMMARY_ROLES = [
  "",
  "company",
  "firstName",
  "lastName",
  "email",
  "country",
];
export const defaultStyling = {
  pageBackground: "#f4f5f3",
  formBackground: "#ffffff",
  borderColor: "#dfe3df",
  borderRadius: 12,
  shadow: true,
  spacing: 24,
  headingSize: 30,
  bodySize: 15,
  labelSize: 14,
  fontWeight: 500,
  buttonText: "Submit wholesale application",
  buttonColor: "#166346",
  buttonTextColor: "#ffffff",
  buttonRadius: 6,
  buttonWidth: "full",
  buttonAlignment: "left",
  inputHeight: 44,
  inputRadius: 6,
  inputBorderColor: "#aeb8b1",
  focusColor: "#166346",
  labelPosition: "above",
  useThemeFont: true,
};
export const defaultSettings = {
  successHeading: "Thank you for applying",
  successDescription:
    "We've received your wholesale application. Our team will review it and contact you.",
  successButtonText: "Continue shopping",
  successRedirectUrl: "",
  adminEmail: "",
  approval: {
    mode: "customer",
    customerTag: "wholesale",
    catalogId: "",
    paymentTermsTemplateId: "",
  },
  emails: Object.fromEntries(
    ["received", "approved", "rejected", "information"].map((event) => [
      event,
      {
        enabled: false,
        to: event === "received" ? "both" : "applicant",
        subject: {
          received: "We received your wholesale application",
          approved: "Your wholesale application is approved",
          rejected: "Update on your wholesale application",
          information: "More information needed for your application",
        }[event],
        body: `Hello {{applicant}},\n\n${{ received: "Thank you for applying to {{page}}. We will review your application.", approved: "Your application has been approved.", rejected: "We are unable to approve your application at this time.", information: "Please reply with the additional information requested below." }[event]}\n\n{{message}}`,
      },
    ]),
  ),
};
const lib = (category, key, label, type = "text", defaults = {}) => ({
  key,
  category,
  label,
  type,
  ...defaults,
});
const customer = (key) => ({ type: "customer", key });
const address = (key) => ({ type: "address", key });
const choices = ["Option 1", "Option 2", "Option 3"];
export const FIELD_LIBRARY = [
  ...[
    ["text", "Single Line Text"],
    ["textarea", "Long Text"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["number", "Number"],
    ["url", "URL"],
    ["date", "Date"],
  ].map(([key, label]) => lib("Basic", key, label, key)),
  lib("Business Information", "company_name", "Company Name", "text", {
    required: true,
  }),
  lib("Business Information", "business_type", "Business Type", "select", {
    options: [
      "Boutique",
      "Department Store",
      "Online Store",
      "Stylist",
      "Distributor",
      "Other",
    ],
  }),
  lib("Business Information", "business_website", "Business Website", "url"),
  lib("Business Information", "business_email", "Business Email", "email"),
  lib("Business Information", "business_phone", "Business Phone", "phone"),
  ...[
    ["years_in_business", "Years in Business"],
    ["number_of_locations", "Number of Locations"],
    ["number_of_employees", "Number of Employees"],
  ].map(([key, label]) =>
    lib("Business Information", key, label, "number", {
      validation: { min: 0, integer: true },
    }),
  ),
  lib("Contact", "first_name", "First Name", "text", {
    required: true,
    dataDestination: customer("firstName"),
  }),
  lib("Contact", "last_name", "Last Name", "text", {
    required: true,
    dataDestination: customer("lastName"),
  }),
  lib("Contact", "job_title", "Job Title"),
  lib("Contact", "contact_email", "Email", "email", {
    required: true,
    dataDestination: customer("email"),
  }),
  lib("Contact", "contact_phone", "Phone", "phone", {
    dataDestination: customer("phone"),
  }),
  ...[
    ["address", "Address", "address1"],
    ["address_line_2", "Address Line 2", "address2"],
    ["city", "City", "city"],
    ["state", "State/Province", "province"],
    ["zip", "ZIP/Postal Code", "zip"],
    ["country", "Country", "countryCode"],
  ].map(([key, label, dest]) =>
    lib("Address", key, label, "text", {
      dataDestination: address(dest),
      ...(key === "country"
        ? {
            placeholder: "Two-letter country code (e.g. US)",
            characterLimit: 2,
            validation: { countryCode: true },
          }
        : {}),
    }),
  ),
  lib(
    "Wholesale",
    "product_categories",
    "Product Categories",
    "checkboxGroup",
    { options: ["Apparel", "Accessories", "Home & Living", "Beauty", "Other"] },
  ),
  lib("Wholesale", "monthly_purchase", "Estimated Monthly Purchase", "select", {
    options: ["Under 1,000", "1,000–5,000", "5,000–10,000", "10,000+"],
  }),
  lib(
    "Wholesale",
    "first_order_value",
    "Expected First Order Value",
    "number",
    { validation: { min: 0 } },
  ),
  lib("Wholesale", "current_brands", "Current Brands", "textarea"),
  lib("Wholesale", "sales_channels", "Sales Channels", "checkboxGroup", {
    options: ["Physical store", "Online store", "Marketplace", "Distribution"],
  }),
  lib("Wholesale", "physical_store", "Physical Store", "radio", {
    options: ["Yes", "No"],
  }),
  lib("Wholesale", "online_store", "Online Store", "radio", {
    options: ["Yes", "No"],
  }),
  lib(
    "Wholesale",
    "marketplace_information",
    "Marketplace Information",
    "textarea",
  ),
  ...[
    ["tax_id", "Tax ID / EIN"],
    ["vat_number", "VAT Number"],
    ["resale_certificate_number", "Resale Certificate Number"],
    ["business_registration_number", "Business Registration Number"],
  ].map(([key, label]) => lib("Tax / Verification", key, label)),
  lib("Tax / Verification", "tax_exempt", "Tax Exempt Status", "checkbox"),
  lib("Tax / Verification", "file", "File Upload", "file"),
  lib("Tax / Verification", "multiple_files", "Multiple File Upload", "file", {
    settings: { maxFiles: 5, maxFileSizeMB: 5 },
  }),
  lib("Tax / Verification", "storefront_image", "Storefront Image", "file", {
    settings: { maxFiles: 1, maxFileSizeMB: 5, imagesOnly: true },
  }),
  ...[
    ["select", "Dropdown"],
    ["radio", "Radio Buttons"],
    ["checkbox", "Checkbox"],
    ["checkboxGroup", "Checkbox Group"],
    ["multiselect", "Multi Select"],
  ].map(([key, label]) =>
    lib("Choice", key, label, key, {
      options: key === "checkbox" ? [] : choices,
    }),
  ),
  lib("Account", "account_email", "Email", "email", {
    dataDestination: customer("email"),
  }),
  lib("Account", "password", "Password", "password", {
    disabledReason: PASSWORD_REASON,
  }),
  lib("Account", "confirm_password", "Confirm Password", "confirmPassword", {
    disabledReason: PASSWORD_REASON,
  }),
  lib("Legal", "terms", "I agree to the terms and conditions", "checkbox", {
    required: true,
  }),
  lib("Legal", "privacy", "I agree to the privacy policy", "checkbox", {
    required: true,
  }),
  lib("Legal", "consent", "Custom Consent Checkbox", "checkbox"),
  ...[
    ["heading", "Heading"],
    ["paragraph", "Paragraph"],
    ["divider", "Divider"],
    ["spacer", "Spacer"],
    ["section", "Section"],
    ["row2", "Two Column Row"],
    ["row3", "Three Column Row"],
  ].map(([key, label]) => lib("Layout", key, label, key)),
];
export function createField(key = "text") {
  const entry =
    FIELD_LIBRARY.find((item) => item.key === key) || FIELD_LIBRARY[0];
  return {
    id: uid("field"),
    type: entry.type,
    label: entry.label,
    name: entry.key,
    summaryRole:
      {
        company_name: "company",
        first_name: "firstName",
        last_name: "lastName",
        contact_email: "email",
        account_email: "email",
        country: "country",
      }[entry.key] || "",
    placeholder: "",
    helpText: "",
    required: false,
    defaultValue: ["checkboxGroup", "multiselect"].includes(entry.type)
      ? []
      : entry.type === "checkbox"
        ? false
        : "",
    width: "100",
    errorMessage: "",
    characterLimit: 1000,
    validation: {},
    options: [],
    settings: { maxFiles: 1, maxFileSizeMB: 5 },
    dataDestination: { type: "application", key: entry.key },
    conditions: { match: "all", rules: [] },
    ...clone(
      Object.fromEntries(
        Object.entries(entry).filter(
          ([key]) => !["key", "category", "disabledReason"].includes(key),
        ),
      ),
    ),
  };
}
export function createRow(columnCount = 1) {
  return {
    id: uid("row"),
    columns: Array.from(
      { length: Math.max(1, Math.min(3, Number(columnCount) || 1)) },
      () => ({ id: uid("column"), fields: [] }),
    ),
  };
}
export function createSection(title = "New section") {
  return {
    id: uid("section"),
    title,
    description: "",
    conditions: { match: "all", rules: [] },
    style: { background: "", spacing: 24, border: false },
    rows: [createRow()],
  };
}
export const TEMPLATES = [
  {
    id: "blank",
    name: "Blank form",
    description: "Start with an empty canvas.",
  },
  {
    id: "standard",
    name: "Standard Wholesale Registration",
    description: "Business, contact, address, purchasing and verification.",
  },
  {
    id: "boutique",
    name: "Boutique Application",
    description: "Store profile, brands, buying plans and resale documents.",
  },
  {
    id: "distributor",
    name: "Distributor Application",
    description:
      "Distribution territory, retailers, volume and business verification.",
  },
];
export function createTemplate(id = "blank") {
  const configuration = {
    version: 1,
    title:
      TEMPLATES.find((item) => item.id === id)?.name ||
      "Wholesale Registration",
    description:
      "Tell us about your business to apply for a wholesale account.",
    sections: [],
  };
  const add = (title, rows) => {
    const section = createSection(title);
    section.rows = rows.map((keys) => {
      const row = createRow(keys.length);
      keys.forEach((key, index) => {
        row.columns[index].fields = [
          typeof key === "string"
            ? createField(key)
            : { ...createField(key.key || "text"), ...key },
        ];
      });
      return row;
    });
    configuration.sections.push(section);
  };
  if (id === "blank") {
    configuration.sections = [createSection("")];
    return configuration;
  }
  add(id === "boutique" ? "Store profile" : "Business information", [
    [
      id === "boutique"
        ? { key: "company_name", label: "Store Name" }
        : "company_name",
    ],
    ["business_type"],
    ["business_website", "business_phone"],
    ...(id === "boutique" ? [["number_of_locations"]] : []),
  ]);
  add("Primary contact", [
    ["first_name", "last_name"],
    ["contact_email", "contact_phone"],
  ]);
  add("Business address", [["address"], ["city", "state", "zip"], ["country"]]);
  if (id === "distributor")
    add("Distribution profile", [
      [{ name: "distribution_territory", label: "Distribution Territory" }],
      [
        {
          key: "number",
          name: "number_of_retailers",
          label: "Number of Retailers",
          validation: { min: 0, integer: true },
        },
      ],
      ["current_brands"],
      [
        {
          key: "number",
          name: "annual_purchase",
          label: "Estimated Annual Purchase",
          validation: { min: 0 },
        },
      ],
    ]);
  else
    add("Wholesale information", [
      ["product_categories"],
      ["first_order_value", "monthly_purchase"],
      [id === "boutique" ? "current_brands" : "sales_channels"],
      ...(id === "boutique"
        ? [[{ key: "url", name: "social_media", label: "Social Media" }]]
        : []),
    ]);
  add("Tax & verification", [
    ["tax_id"],
    [
      {
        key: "file",
        name: id === "distributor" ? "business_license" : "resale_certificate",
        label: id === "distributor" ? "Business License" : "Resale Certificate",
      },
    ],
    ...(id === "distributor" ? [["multiple_files"]] : []),
  ]);
  add("Agreements", [["terms"], ["privacy"]]);
  return configuration;
}
export function allFields(configuration) {
  return (configuration?.sections || []).flatMap((section) =>
    (section.rows || []).flatMap((row) =>
      (row.columns || []).flatMap((column) => column.fields || []),
    ),
  );
}
const empty = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  value === false ||
  (Array.isArray(value) && value.length === 0);
export function isVisible(conditions, values = {}) {
  if (!conditions?.rules?.length) return true;
  const results = conditions.rules.map((rule) => {
    const actual = values[rule.fieldId];
    const expected = rule.value;
    switch (rule.operator) {
      case "equals":
        return String(actual ?? "") === String(expected ?? "");
      case "not_equals":
        return String(actual ?? "") !== String(expected ?? "");
      case "contains":
        return Array.isArray(actual)
          ? actual.includes(expected)
          : String(actual ?? "").includes(String(expected ?? ""));
      case "not_contains":
        return Array.isArray(actual)
          ? !actual.includes(expected)
          : !String(actual ?? "").includes(String(expected ?? ""));
      case "greater_than":
        return (
          !empty(actual) &&
          Number.isFinite(Number(actual)) &&
          Number(actual) > Number(expected)
        );
      case "less_than":
        return (
          !empty(actual) &&
          Number.isFinite(Number(actual)) &&
          Number(actual) < Number(expected)
        );
      case "is_empty":
        return empty(actual);
      case "is_not_empty":
        return !empty(actual);
      default:
        return false;
    }
  });
  return conditions.match === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}
export function visibleFields(configuration, values = {}) {
  const fields = allFields(configuration);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const sectionFor = new Map();
  for (const section of configuration?.sections || [])
    for (const field of allFields({ sections: [section] }))
      sectionFor.set(field.id, section);
  const memo = new Map(),
    visiting = new Set();
  function check(field) {
    if (memo.has(field.id)) return memo.get(field.id);
    if (visiting.has(field.id)) return false;
    visiting.add(field.id);
    const conditions = [sectionFor.get(field.id)?.conditions, field.conditions];
    const effective = {};
    for (const condition of conditions)
      for (const rule of condition?.rules || []) {
        const dependency = byId.get(rule.fieldId);
        if (dependency && check(dependency))
          effective[rule.fieldId] = values[rule.fieldId];
      }
    const result = conditions.every((condition) =>
      isVisible(condition, effective),
    );
    visiting.delete(field.id);
    memo.set(field.id, result);
    return result;
  }
  return fields.filter(check);
}
const TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "url",
  "date",
  "select",
  "radio",
  "checkbox",
  "checkboxGroup",
  "multiselect",
  "file",
  ...LAYOUT_TYPES,
  "password",
  "confirmPassword",
];
const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "is_empty",
  "is_not_empty",
];
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const reservedKey = (value) =>
  ["__proto__", "constructor", "prototype"].includes(value);
// Drafts may contain incomplete labels, choices, rules and mappings. Preserve
// editing progress while still ensuring the stored tree can be rendered safely.
export function validateDraftConfiguration(configuration) {
  const errors = [];
  if (
    !object(configuration) ||
    configuration.version !== 1 ||
    !Array.isArray(configuration.sections) ||
    configuration.sections.length > 50
  )
    return ["Invalid form configuration."];
  const text = (value, maximum = 20000) =>
    value === undefined ||
    (typeof value === "string" && value.length <= maximum);
  if (!text(configuration.title, 200) || !text(configuration.description))
    errors.push("Invalid form title or description.");
  const ids = new Set();
  let count = 0;
  const identity = (node) => {
    if (
      !object(node) ||
      typeof node.id !== "string" ||
      !/^[-\w]{1,100}$/.test(node.id) ||
      reservedKey(node.id) ||
      ids.has(node.id)
    ) {
      errors.push("Invalid or duplicate form element ID.");
      return false;
    }
    ids.add(node.id);
    return true;
  };
  const conditions = (value) => {
    if (value === undefined) return;
    if (
      !object(value) ||
      !["all", "any"].includes(value.match) ||
      !Array.isArray(value.rules) ||
      value.rules.length > 30 ||
      value.rules.some(
        (rule) =>
          !object(rule) ||
          typeof rule.fieldId !== "string" ||
          !OPERATORS.includes(rule.operator) ||
          !["string", "number", "boolean", "undefined"].includes(
            typeof rule.value,
          ),
      )
    )
      errors.push("Invalid visibility condition structure.");
  };
  for (const section of configuration.sections) {
    if (!identity(section)) continue;
    if (!text(section.title, 500) || !text(section.description))
      errors.push("Invalid section title or description.");
    conditions(section.conditions);
    if (!Array.isArray(section.rows) || section.rows.length > 100) {
      errors.push("Invalid section rows.");
      continue;
    }
    for (const row of section.rows) {
      if (!identity(row)) continue;
      if (
        !Array.isArray(row.columns) ||
        row.columns.length < 1 ||
        row.columns.length > 3
      ) {
        errors.push("Rows must have one to three columns.");
        continue;
      }
      for (const column of row.columns) {
        if (!identity(column)) continue;
        if (!Array.isArray(column.fields) || column.fields.length > 100) {
          errors.push("Invalid column fields.");
          continue;
        }
        for (const field of column.fields) {
          if (!identity(field)) continue;
          count++;
          if (!TYPES.includes(field.type))
            errors.push("Unsupported field type.");
          if (
            ["label", "name", "placeholder", "helpText", "errorMessage"].some(
              (key) => !text(field[key]),
            )
          )
            errors.push("Invalid field text.");
          if (
            field.required !== undefined &&
            typeof field.required !== "boolean"
          )
            errors.push("Invalid required setting.");
          if (
            !Array.isArray(field.options) ||
            field.options.length > 200 ||
            field.options.some(
              (option) => typeof option !== "string" || option.length > 500,
            )
          )
            errors.push("Invalid field choices.");
          if (
            field.defaultValue !== undefined &&
            !(
              typeof field.defaultValue === "string" ||
              typeof field.defaultValue === "boolean" ||
              (typeof field.defaultValue === "number" &&
                Number.isFinite(field.defaultValue)) ||
              (Array.isArray(field.defaultValue) &&
                field.defaultValue.every((value) => typeof value === "string"))
            )
          )
            errors.push("Invalid field default value.");
          if (
            ["password", "confirmPassword"].includes(field.type) &&
            !empty(field.defaultValue)
          )
            errors.push("Password values cannot be stored.");
          if (
            field.dataDestination !== undefined &&
            !object(field.dataDestination)
          )
            errors.push("Invalid data destination.");
          if (field.settings !== undefined && !object(field.settings))
            errors.push("Invalid field settings.");
          conditions(field.conditions);
        }
      }
    }
  }
  if (count > 300) errors.push("Use at most 300 fields per page.");
  return [...new Set(errors)];
}
export function validateConfiguration(configuration) {
  try {
    return checkConfiguration(configuration);
  } catch {
    return ["Invalid form configuration structure."];
  }
}
function checkConfiguration(configuration) {
  const structuralErrors = validateDraftConfiguration(configuration);
  if (structuralErrors.length) return structuralErrors;
  const errors = [];
  if (
    !object(configuration) ||
    configuration.version !== 1 ||
    !Array.isArray(configuration.sections)
  )
    return ["Invalid form configuration."];
  if (
    typeof configuration.title !== "string" ||
    configuration.title.length > 200
  )
    errors.push("Form title must be at most 200 characters.");
  if (configuration.sections.length > 50)
    return ["Use at most 50 sections per page."];
  const ids = new Set(),
    names = new Set(),
    fields = [],
    dependencies = new Map();
  const identify = (node) => {
    if (
      !object(node) ||
      typeof node.id !== "string" ||
      !/^[-\w]{1,100}$/.test(node.id) ||
      reservedKey(node.id) ||
      ids.has(node.id)
    ) {
      errors.push(
        "Every section, row, column and field must have a unique valid ID.",
      );
      return false;
    }
    ids.add(node.id);
    return true;
  };
  for (const section of configuration.sections) {
    if (!identify(section)) continue;
    if (!Array.isArray(section.rows) || section.rows.length > 100) {
      errors.push("Invalid section rows.");
      continue;
    }
    for (const row of section.rows) {
      if (!identify(row)) continue;
      if (
        !Array.isArray(row.columns) ||
        row.columns.length < 1 ||
        row.columns.length > 3
      ) {
        errors.push("Rows must have one to three columns.");
        continue;
      }
      for (const column of row.columns) {
        if (!identify(column)) continue;
        if (!Array.isArray(column.fields) || column.fields.length > 100) {
          errors.push("Invalid column fields.");
          continue;
        }
        for (const field of column.fields) {
          if (!identify(field)) continue;
          fields.push(field);
          dependencies.set(
            field.id,
            [
              ...(field.conditions?.rules || []),
              ...(section.conditions?.rules || []),
            ].map((rule) => rule.fieldId),
          );
        }
      }
    }
  }
  if (fields.length > 300) errors.push("Use at most 300 fields per page.");
  const fieldIds = new Set(fields.map((field) => field.id));
  const conditionCheck = (conditions) => {
    if (!conditions) return;
    if (
      !object(conditions) ||
      !["all", "any"].includes(conditions.match) ||
      !Array.isArray(conditions.rules) ||
      conditions.rules.length > 30
    ) {
      errors.push("Invalid visibility conditions.");
      return;
    }
    for (const rule of conditions.rules)
      if (
        !object(rule) ||
        !fieldIds.has(rule.fieldId) ||
        !OPERATORS.includes(rule.operator) ||
        !["string", "number", "boolean", "undefined"].includes(
          typeof rule.value,
        )
      )
        errors.push(
          "Visibility rules must reference existing fields and supported operators.",
        );
  };
  for (const section of configuration.sections)
    conditionCheck(section?.conditions);
  for (const field of fields) {
    conditionCheck(field.conditions);
    if (!TYPES.includes(field.type))
      errors.push(`Unsupported field type: ${field.type}.`);
    if (["password", "confirmPassword"].includes(field.type))
      errors.push(PASSWORD_REASON);
    if (typeof field.label !== "string" || field.label.length > 500)
      errors.push("Field labels must be at most 500 characters.");
    if (
      typeof field.name !== "string" ||
      !/^\w{1,80}$/.test(field.name) ||
      reservedKey(field.name) ||
      names.has(field.name)
    )
      errors.push(
        `Field name must be unique and use letters, numbers or underscores: ${field.name}.`,
      );
    names.add(field.name);
    if (
      field.summaryRole !== undefined &&
      !SUMMARY_ROLES.includes(field.summaryRole)
    )
      errors.push(`${field.label}: invalid application summary role.`);
    if (
      field.summaryRole &&
      [
        "file",
        "checkbox",
        "checkboxGroup",
        "multiselect",
        ...LAYOUT_TYPES,
      ].includes(field.type)
    )
      errors.push(
        `${field.label}: application summary fields must contain a single text value.`,
      );
    if (!empty(field.defaultValue)) {
      if (["checkboxGroup", "multiselect"].includes(field.type)) {
        if (
          !Array.isArray(field.defaultValue) ||
          field.defaultValue.some((value) => !field.options.includes(value))
        )
          errors.push(
            `${field.label}: default choices must match the available options.`,
          );
      } else if (field.type === "checkbox") {
        if (![true, false, "true", "false", "on"].includes(field.defaultValue))
          errors.push(
            `${field.label}: checkbox default must be true or false.`,
          );
      } else if (
        ["file", "password", "confirmPassword"].includes(field.type) ||
        !["string", "number"].includes(typeof field.defaultValue)
      )
        errors.push(`${field.label}: invalid default value.`);
      else if (
        ["radio", "select"].includes(field.type) &&
        !field.options.includes(field.defaultValue)
      )
        errors.push(
          `${field.label}: default choice must match an available option.`,
        );
    }
    for (const key of ["placeholder", "helpText", "errorMessage"]) {
      if (
        field[key] !== undefined &&
        (typeof field[key] !== "string" || field[key].length > 20000)
      )
        errors.push(`${field.label}: invalid ${key}.`);
    }
    if (field.required !== undefined && typeof field.required !== "boolean")
      errors.push(`${field.label}: required must be true or false.`);
    if (
      field.characterLimit !== undefined &&
      (!Number.isInteger(Number(field.characterLimit)) ||
        Number(field.characterLimit) < 1 ||
        Number(field.characterLimit) > 20000)
    )
      errors.push(
        `${field.label}: character limit must be between 1 and 20,000.`,
      );
    if (!["100", "75", "66", "50", "33", "25"].includes(String(field.width)))
      errors.push(`${field.label}: choose a supported field width.`);
    if (
      ["select", "radio", "checkboxGroup", "multiselect"].includes(
        field.type,
      ) &&
      (!Array.isArray(field.options) ||
        !field.options.length ||
        field.options.length > 200 ||
        field.options.some(
          (option) =>
            typeof option !== "string" || !option.trim() || option.length > 500,
        ) ||
        new Set(field.options).size !== field.options.length)
    )
      errors.push(`${field.label}: provide unique, non-empty choices.`);
    const validation = field.validation;
    if (
      validation !== undefined &&
      !object(validation) &&
      validation !== "none"
    )
      errors.push(`${field.label}: invalid validation settings.`);
    if (object(validation)) {
      for (const key of ["min", "max", "minLength", "maxLength"])
        if (
          validation[key] !== undefined &&
          validation[key] !== "" &&
          !Number.isFinite(Number(validation[key]))
        )
          errors.push(`${field.label}: invalid ${key}.`);
      if (
        validation.min !== undefined &&
        validation.max !== undefined &&
        Number(validation.min) > Number(validation.max)
      )
        errors.push(`${field.label}: minimum exceeds maximum.`);
      if (validation.pattern)
        errors.push(
          `${field.label}: custom regular expressions are not supported. Use the built-in validation rules.`,
        );
    }
    const dest = field.dataDestination || { type: "application" };
    if (
      ["customer", "address"].includes(dest.type) &&
      ["checkbox", "checkboxGroup", "multiselect", ...LAYOUT_TYPES].includes(
        field.type,
      )
    )
      errors.push(
        `${field.label}: this destination requires a single text value.`,
      );
    if (
      ![
        "application",
        "customer",
        "customer_tag",
        "customer_metafield",
        "company_metafield",
        "company_location_metafield",
        "address",
      ].includes(dest.type)
    )
      errors.push(`${field.label}: invalid data destination.`);
    if (
      dest.type === "customer" &&
      !["email", "firstName", "lastName", "phone"].includes(dest.key)
    )
      errors.push(`${field.label}: invalid customer field.`);
    if (
      dest.type === "address" &&
      ![
        "address1",
        "address2",
        "city",
        "province",
        "zip",
        "countryCode",
      ].includes(dest.key)
    )
      errors.push(`${field.label}: invalid address field.`);
    if (
      dest.type?.endsWith("_metafield") &&
      (!/^[-\w]{3,255}$/.test(dest.namespace || "") ||
        !/^[-\w]{3,64}$/.test(dest.key || "") ||
        ![
          "single_line_text_field",
          "multi_line_text_field",
          "number_integer",
          "number_decimal",
          "boolean",
          "date",
          "url",
          "list.single_line_text_field",
        ].includes(dest.metafieldType))
    )
      errors.push(
        `${field.label}: provide a valid metafield namespace, key and type.`,
      );
    if (field.type === "file") {
      if (dest.type !== "application")
        errors.push(
          `${field.label}: private files must be stored in the application only.`,
        );
      if (
        !Number.isInteger(Number(field.settings?.maxFiles)) ||
        Number(field.settings.maxFiles) < 1 ||
        Number(field.settings.maxFiles) > 5 ||
        !Number.isFinite(Number(field.settings?.maxFileSizeMB)) ||
        Number(field.settings.maxFileSizeMB) <= 0 ||
        Number(field.settings.maxFileSizeMB) > 10
      )
        errors.push(`${field.label}: allow 1–5 files, up to 10 MB each.`);
    }
  }
  const visited = new Set(),
    active = new Set();
  function visit(id) {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    active.add(id);
    for (const dependency of dependencies.get(id) || [])
      if (visit(dependency)) return true;
    active.delete(id);
    visited.add(id);
    return false;
  }
  if (fields.some((field) => visit(field.id)))
    errors.push(
      "Conditional visibility contains a cycle. A section cannot depend on one of its own fields.",
    );
  return [...new Set(errors)];
}
export function validateSubmission(configuration, input = {}) {
  const values = {},
    errors = {};
  if (!object(input))
    return { values, errors: { _form: "Invalid submission." } };
  const configErrors = validateConfiguration(configuration);
  if (configErrors.length)
    return { values, errors: { _form: configErrors.join(" ") } };
  // Normalize only known scalar/choice values before evaluating dependency conditions.
  const normalized = {};
  for (const field of allFields(configuration)) {
    const raw = input[field.id];
    normalized[field.id] =
      field.type === "checkbox"
        ? raw === true || raw === "true" || raw === "on"
        : typeof raw === "string"
          ? raw.trim()
          : raw;
  }
  for (const field of visibleFields(configuration, normalized)) {
    if (LAYOUT_TYPES.includes(field.type)) continue;
    let value = normalized[field.id];
    const fail = (message) => {
      errors[field.id] = field.errorMessage || message;
    };
    const raw = input[field.id];
    if (
      field.type === "checkbox" &&
      ![undefined, null, "", true, false, "true", "false", "on"].includes(raw)
    ) {
      fail("Choose a valid checkbox value.");
      continue;
    }
    if (
      !["file", "checkboxGroup", "multiselect", "checkbox"].includes(
        field.type,
      ) &&
      raw !== undefined &&
      raw !== null &&
      !["string", "number"].includes(typeof raw)
    ) {
      fail("Enter a single valid value.");
      continue;
    }
    if (
      ["checkboxGroup", "multiselect"].includes(field.type) &&
      raw !== undefined &&
      raw !== null &&
      !Array.isArray(raw)
    ) {
      fail("Choose valid options.");
      continue;
    }
    if (empty(value)) {
      if (field.required) fail(`${field.label} is required.`);
      else if (field.type === "checkbox") values[field.id] = false;
      continue;
    }
    if (field.type === "file") {
      const files = Array.isArray(value) ? value : [value];
      const allowed = field.settings?.imagesOnly
        ? { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"] }
        : {
            "application/pdf": ["pdf"],
            "image/jpeg": ["jpg", "jpeg"],
            "image/png": ["png"],
          };
      if (files.length > Number(field.settings.maxFiles))
        fail(`Upload at most ${field.settings.maxFiles} files.`);
      else if (
        files.some(
          (file) =>
            !file ||
            typeof file.name !== "string" ||
            !Number.isFinite(file.size) ||
            file.size <= 0 ||
            file.size > Number(field.settings.maxFileSizeMB) * 1024 * 1024 ||
            !Array.isArray(allowed[file.type]) ||
            !allowed[file.type]?.includes(
              file.name.split(".").pop()?.toLowerCase(),
            ) ||
            typeof file.arrayBuffer !== "function",
        )
      )
        fail(
          `Upload valid PDF, JPG or PNG files up to ${field.settings.maxFileSizeMB} MB each.`,
        );
      else values[field.id] = files;
      continue;
    }
    if (["checkboxGroup", "multiselect"].includes(field.type)) {
      if (
        !Array.isArray(value) ||
        value.some(
          (item) => typeof item !== "string" || !field.options.includes(item),
        )
      )
        fail("Choose valid options.");
      else values[field.id] = [...new Set(value)];
      continue;
    }
    if (field.type === "checkbox") {
      values[field.id] = value;
      continue;
    }
    if (
      !["string", "number"].includes(typeof value) ||
      String(value).length > Number(field.characterLimit || 1000)
    ) {
      fail(`Enter at most ${field.characterLimit || 1000} characters.`);
      continue;
    }
    value = String(value);
    const rules = object(field.validation) ? field.validation : {};
    if (
      (field.type === "email" ||
        field.summaryRole === "email" ||
        (field.dataDestination?.type === "customer" &&
          field.dataDestination.key === "email")) &&
      (value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))
    )
      fail("Enter a valid email address.");
    if (field.type === "url") {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
          fail("Enter a full http or https URL.");
      } catch {
        fail("Enter a full http or https URL.");
      }
    }
    if (
      field.type === "phone" &&
      (!/^[+()\d\s.-]{5,30}$/.test(value) ||
        value.replace(/\D/g, "").length < 5)
    )
      fail("Enter a valid phone number.");
    if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      fail("Enter a valid date.");
    if (
      ["select", "radio"].includes(field.type) &&
      !field.options.includes(value)
    )
      fail("Choose a valid option.");
    if (field.type === "number") {
      if (
        !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value) ||
        !Number.isFinite(Number(value))
      )
        fail("Enter a valid number.");
      else {
        value = Number(value);
        if (rules.integer && !Number.isInteger(value))
          fail("Enter a whole number.");
        if (
          rules.min !== undefined &&
          rules.min !== "" &&
          value < Number(rules.min)
        )
          fail(`Enter a value of at least ${rules.min}.`);
        if (
          rules.max !== undefined &&
          rules.max !== "" &&
          value > Number(rules.max)
        )
          fail(`Enter a value no greater than ${rules.max}.`);
      }
    }
    if (rules.minLength && String(value).length < Number(rules.minLength))
      fail(`Enter at least ${rules.minLength} characters.`);
    if (rules.maxLength && String(value).length > Number(rules.maxLength))
      fail(`Enter at most ${rules.maxLength} characters.`);
    const countryCode =
      rules.countryCode ||
      field.summaryRole === "country" ||
      (field.dataDestination?.type === "address" &&
        field.dataDestination.key === "countryCode");
    if (countryCode && !/^[A-Za-z]{2}$/.test(value))
      fail("Enter a two-letter country code.");
    if (!errors[field.id])
      values[field.id] = countryCode ? String(value).toUpperCase() : value;
  }
  return { values, errors };
}
