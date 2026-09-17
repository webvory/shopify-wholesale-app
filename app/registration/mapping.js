import { allFields } from "./schema.js";

export function buildMappings(configuration, values) {
  const result = {
    customer: {},
    address: {},
    tags: [],
    customerMetafields: [],
    companyMetafields: [],
    locationMetafields: [],
  };
  for (const field of allFields(configuration)) {
    if (
      !Object.hasOwn(values, field.id) ||
      ["file", "password", "confirmPassword"].includes(field.type)
    )
      continue;
    const value = values[field.id];
    if (value === "" || value === null || value === undefined) continue;
    const dest = field.dataDestination || { type: "application" };
    if (dest.type === "customer") result.customer[dest.key] = String(value);
    if (dest.type === "address") result.address[dest.key] = String(value);
    if (dest.type === "customer_tag")
      result.tags.push(
        ...(Array.isArray(value)
          ? value.map(String)
          : [dest.key || String(value)]),
      );
    const owner = {
      customer_metafield: "customerMetafields",
      company_metafield: "companyMetafields",
      company_location_metafield: "locationMetafields",
    }[dest.type];
    if (!owner) continue;
    const type = dest.metafieldType || "single_line_text_field";
    let mapped;
    if (type === "list.single_line_text_field")
      mapped = JSON.stringify(
        Array.isArray(value) ? value.map(String) : [String(value)],
      );
    else if (type === "boolean") {
      if (![true, false, "true", "false"].includes(value))
        throw new Error(`${field.label}: value cannot be mapped to a boolean.`);
      mapped = String(value);
    } else if (["number_integer", "number_decimal"].includes(type)) {
      if (
        !Number.isFinite(Number(value)) ||
        (type === "number_integer" && !Number.isInteger(Number(value)))
      )
        throw new Error(`${field.label}: value cannot be mapped to ${type}.`);
      mapped = String(Number(value));
    } else mapped = Array.isArray(value) ? value.join(", ") : String(value);
    result[owner].push({
      namespace: dest.namespace,
      key: dest.key,
      type,
      value: mapped,
    });
  }
  return result;
}
