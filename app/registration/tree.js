/* global globalThis */
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const newId = () => globalThis.crypto.randomUUID();

export function locate(configuration, id) {
  for (const section of configuration.sections) {
    if (section.id === id)
      return { node: section, list: configuration.sections, section };
    for (const row of section.rows) {
      if (row.id === id) return { node: row, list: section.rows, section, row };
      for (const column of row.columns) {
        if (column.id === id)
          return { node: column, list: row.columns, section, row, column };
        const node = column.fields.find((field) => field.id === id);
        if (node) return { node, list: column.fields, section, row, column };
      }
    }
  }
  return null;
}

export function moveField(configuration, fieldId, columnId, index) {
  const next = clone(configuration);
  const source = locate(next, fieldId);
  const target = locate(next, columnId);
  if (!source?.node.type || !target?.node.fields) return configuration;
  const oldIndex = source.list.indexOf(source.node);
  const insertionIndex = index ?? target.node.fields.length;
  source.list.splice(oldIndex, 1);
  const destination = Math.max(
    0,
    Math.min(
      insertionIndex,
      target.node.fields.length + (source.list === target.node.fields ? 1 : 0),
    ),
  );
  target.node.fields.splice(
    source.list === target.node.fields && oldIndex < destination
      ? destination - 1
      : destination,
    0,
    source.node,
  );
  return next;
}

export function duplicateNode(configuration, id) {
  const next = clone(configuration);
  const found = locate(next, id);
  if (!found) return configuration;
  const copy = clone(found.node);
  const ids = new Map();
  const names = new Set();
  function collectNames(node) {
    if (node.name) names.add(node.name);
    for (const key of ["sections", "rows", "columns", "fields"])
      node[key]?.forEach(collectNames);
  }
  collectNames(next);
  function replace(node) {
    if (node.id) {
      const old = node.id;
      node.id = newId();
      ids.set(old, node.id);
    }
    if (node.name) {
      const base = node.name;
      let suffix = 2;
      while (names.has(node.name)) node.name = `${base}_${suffix++}`;
      names.add(node.name);
    }
    for (const key of ["rows", "columns", "fields"])
      node[key]?.forEach(replace);
  }
  function references(node) {
    node.conditions?.rules?.forEach((rule) => {
      rule.fieldId = ids.get(rule.fieldId) || rule.fieldId;
    });
    for (const key of ["rows", "columns", "fields"])
      node[key]?.forEach(references);
  }
  replace(copy);
  references(copy);
  found.list.splice(found.list.indexOf(found.node) + 1, 0, copy);
  return next;
}

export function removeNode(configuration, id) {
  const next = clone(configuration);
  const found = locate(next, id);
  if (!found) return configuration;
  const deleted = new Set();
  function collect(node) {
    deleted.add(node.id);
    for (const key of ["rows", "columns", "fields"])
      node[key]?.forEach(collect);
  }
  collect(found.node);
  found.list.splice(found.list.indexOf(found.node), 1);
  function clean(node) {
    if (node.conditions?.rules)
      node.conditions.rules = node.conditions.rules.filter(
        (rule) => !deleted.has(rule.fieldId),
      );
    for (const key of ["sections", "rows", "columns", "fields"])
      node[key]?.forEach(clean);
  }
  clean(next);
  return next;
}
