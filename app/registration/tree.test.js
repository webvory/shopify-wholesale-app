import test from "node:test";
import assert from "node:assert/strict";
import { moveField, removeNode, duplicateNode } from "./tree.js";
const config = {
  sections: [
    {
      id: "s",
      rows: [
        {
          id: "r",
          columns: [
            {
              id: "a",
              fields: [
                { id: "one", type: "text", name: "business" },
                {
                  id: "two",
                  type: "text",
                  conditions: { rules: [{ fieldId: "one" }] },
                },
              ],
            },
            { id: "b", fields: [] },
          ],
        },
      ],
    },
  ],
};
test("moves into empty columns without mutating original", () => {
  const next = moveField(config, "one", "b", 0);
  assert.equal(next.sections[0].rows[0].columns[1].fields[0].id, "one");
  assert.equal(config.sections[0].rows[0].columns[0].fields.length, 2);
});
test("same column insertion positions account for removal", () => {
  const next = moveField(config, "one", "a", 2);
  assert.deepEqual(
    next.sections[0].rows[0].columns[0].fields.map((f) => f.id),
    ["two", "one"],
  );
});
test("deletion removes dangling visibility dependencies", () => {
  const next = removeNode(config, "one");
  assert.deepEqual(
    next.sections[0].rows[0].columns[0].fields[0].conditions.rules,
    [],
  );
});
test("duplication renews descendants and internal condition references", () => {
  const next = duplicateNode(config, "s");
  const fields = next.sections[1].rows[0].columns[0].fields;
  assert.notEqual(fields[0].id, "one");
  assert.equal(fields[0].name, "business_2");
  assert.equal(fields[1].conditions.rules[0].fieldId, fields[0].id);
});
test("append within same column goes to the end", () => {
  const next = moveField(config, "one", "a");
  assert.deepEqual(
    next.sections[0].rows[0].columns[0].fields.map((field) => field.id),
    ["two", "one"],
  );
});
