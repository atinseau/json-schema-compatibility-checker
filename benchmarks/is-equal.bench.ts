import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { run } from "./collect";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Identical schemas ───────────────────────────────────────────────────────

const simpleObject: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

const simpleObjectClone: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

// ─── Different schemas ───────────────────────────────────────────────────────

const stringSchema: JSONSchema7 = { type: "string" };
const numberSchema: JSONSchema7 = { type: "number" };

// ─── Extra property ──────────────────────────────────────────────────────────

const objectOneField: JSONSchema7 = {
  type: "object",
  properties: { a: { type: "string" } },
};

const objectTwoFields: JSONSchema7 = {
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "number" },
  },
};

// ─── Different required ──────────────────────────────────────────────────────

const withRequired: JSONSchema7 = {
  type: "object",
  properties: { a: { type: "string" } },
  required: ["a"],
};

const withoutRequired: JSONSchema7 = {
  type: "object",
  properties: { a: { type: "string" } },
};

// ─── Const normalization ─────────────────────────────────────────────────────

const constOnly: JSONSchema7 = { const: "test" };
const constWithType: JSONSchema7 = { const: "test", type: "string" };

// ─── Boolean schemas ─────────────────────────────────────────────────────────

const boolTrue = true;
const boolFalse = false;

// ─── Empty schemas ───────────────────────────────────────────────────────────

const empty1: JSONSchema7 = {};
const empty2: JSONSchema7 = {};

// ─── Complex identical schemas ───────────────────────────────────────────────

const complexA: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    age: { type: "integer", minimum: 0, maximum: 150 },
    email: { type: "string", format: "email" },
    tags: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 0,
      maxItems: 10,
      uniqueItems: true,
    },
    metadata: {
      type: "object",
      properties: {
        created: { type: "string", format: "date-time" },
      },
      additionalProperties: { type: "string" },
    },
  },
  required: ["name", "email"],
  additionalProperties: false,
  minProperties: 2,
  maxProperties: 10,
};

const complexB: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    age: { type: "integer", minimum: 0, maximum: 150 },
    email: { type: "string", format: "email" },
    tags: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 0,
      maxItems: 10,
      uniqueItems: true,
    },
    metadata: {
      type: "object",
      properties: {
        created: { type: "string", format: "date-time" },
      },
      additionalProperties: { type: "string" },
    },
  },
  required: ["name", "email"],
  additionalProperties: false,
  minProperties: 2,
  maxProperties: 10,
};

// ─── Deeply nested identical ─────────────────────────────────────────────────

const deepA: JSONSchema7 = {
  type: "object",
  properties: {
    l1: {
      type: "object",
      properties: {
        l2: {
          type: "object",
          properties: {
            l3: {
              type: "object",
              properties: {
                value: { type: "string", minLength: 1 },
              },
              required: ["value"],
            },
          },
          required: ["l3"],
        },
      },
      required: ["l2"],
    },
  },
  required: ["l1"],
};

const deepB: JSONSchema7 = {
  type: "object",
  properties: {
    l1: {
      type: "object",
      properties: {
        l2: {
          type: "object",
          properties: {
            l3: {
              type: "object",
              properties: {
                value: { type: "string", minLength: 1 },
              },
              required: ["value"],
            },
          },
          required: ["l3"],
        },
      },
      required: ["l2"],
    },
  },
  required: ["l1"],
};

// ─── With anyOf / oneOf ──────────────────────────────────────────────────────

const anyOfSchemaA: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};

const anyOfSchemaB: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};

const oneOfSchemaA: JSONSchema7 = {
  oneOf: [
    {
      type: "object",
      properties: { kind: { const: "a" } },
      required: ["kind"],
    },
    {
      type: "object",
      properties: { kind: { const: "b" } },
      required: ["kind"],
    },
  ],
};

const oneOfSchemaB: JSONSchema7 = {
  oneOf: [
    {
      type: "object",
      properties: { kind: { const: "a" } },
      required: ["kind"],
    },
    {
      type: "object",
      properties: { kind: { const: "b" } },
      required: ["kind"],
    },
  ],
};

// ─── Enum schemas ────────────────────────────────────────────────────────────

const enumA: JSONSchema7 = { type: "string", enum: ["a", "b", "c", "d", "e"] };
const enumB: JSONSchema7 = { type: "string", enum: ["a", "b", "c", "d", "e"] };
const enumDiff: JSONSchema7 = {
  type: "string",
  enum: ["a", "b", "c", "d", "f"],
};

// ─── With format ─────────────────────────────────────────────────────────────

const formatA: JSONSchema7 = { type: "string", format: "email" };
const formatB: JSONSchema7 = { type: "string", format: "email" };
const formatDiff: JSONSchema7 = { type: "string", format: "uri" };

// ─── With patternProperties ──────────────────────────────────────────────────

const patternPropsA: JSONSchema7 = {
  type: "object",
  patternProperties: {
    "^S_": { type: "string", minLength: 1 },
    "^N_": { type: "number", minimum: 0 },
  },
};

const patternPropsB: JSONSchema7 = {
  type: "object",
  patternProperties: {
    "^S_": { type: "string", minLength: 1 },
    "^N_": { type: "number", minimum: 0 },
  },
};

// ─── With propertyNames ──────────────────────────────────────────────────────

const propertyNamesA: JSONSchema7 = {
  type: "object",
  propertyNames: { minLength: 1, pattern: "^[a-z]" },
};

const propertyNamesB: JSONSchema7 = {
  type: "object",
  propertyNames: { minLength: 1, pattern: "^[a-z]" },
};

// ─── After normalization (const inference) ───────────────────────────────────

const normalizedA = checker.normalize({ const: "hello" });
const normalizedB = checker.normalize({ const: "hello", type: "string" });

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
  boxplot(() => {
    bench("identical: same reference", () =>
      checker.isEqual(simpleObject, simpleObject),
    );
    bench("identical: different references (simple)", () =>
      checker.isEqual(simpleObject, simpleObjectClone),
    );
    bench("identical: empty schemas", () => checker.isEqual(empty1, empty2));
    bench("identical: boolean true === true", () =>
      checker.isEqual(boolTrue, boolTrue),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("different: string vs number", () =>
      checker.isEqual(stringSchema, numberSchema),
    );
    bench("different: extra property", () =>
      checker.isEqual(objectOneField, objectTwoFields),
    );
    bench("different: required mismatch", () =>
      checker.isEqual(withRequired, withoutRequired),
    );
    bench("different: boolean true vs false", () =>
      checker.isEqual(boolTrue, boolFalse),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("normalization: const vs const+type (equal after normalize)", () =>
      checker.isEqual(constOnly, constWithType),
    );
    bench("normalization: pre-normalized values", () =>
      checker.isEqual(normalizedA, normalizedB),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("complex: identical complex schemas", () =>
      checker.isEqual(complexA, complexB),
    );
    bench("deeply nested: identical 4-level schemas", () =>
      checker.isEqual(deepA, deepB),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("anyOf: identical branches", () =>
      checker.isEqual(anyOfSchemaA, anyOfSchemaB),
    );
    bench("oneOf: identical discriminated union", () =>
      checker.isEqual(oneOfSchemaA, oneOfSchemaB),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("enum: identical (5 values)", () => checker.isEqual(enumA, enumB));
    bench("enum: different (last value differs)", () =>
      checker.isEqual(enumA, enumDiff),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("format: identical", () => checker.isEqual(formatA, formatB));
    bench("format: different", () => checker.isEqual(formatA, formatDiff));
  });
});

summary(() => {
  boxplot(() => {
    bench("patternProperties: identical", () =>
      checker.isEqual(patternPropsA, patternPropsB),
    );
    bench("propertyNames: identical", () =>
      checker.isEqual(propertyNamesA, propertyNamesB),
    );
  });
});

await run();
