import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { run } from "./collect";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const constString: JSONSchema7 = { const: "hello" };
const constNumber: JSONSchema7 = { const: 3.14 };
const constInteger: JSONSchema7 = { const: 42 };
const constBoolean: JSONSchema7 = { const: true };
const constObject: JSONSchema7 = { const: { a: 1 } };
const constArray: JSONSchema7 = { const: [1, 2, 3] };
const constNull: JSONSchema7 = { const: null };

const enumHomogeneous: JSONSchema7 = { enum: [1, 2, 3] };
const enumHeterogeneous: JSONSchema7 = { enum: ["a", 1, true, null] };

const constWithEnum: JSONSchema7 = { const: "a", enum: ["a", "b", "c"] };
const constNotInEnum: JSONSchema7 = { const: "x", enum: ["a", "b", "c"] };

const doubleNegation: JSONSchema7 = {
  not: { not: { type: "string", minLength: 1 } },
};

const tripleNegation: JSONSchema7 = {
  not: { not: { not: { type: "string" } } },
};

const simpleString: JSONSchema7 = {
  type: "string",
  minLength: 1,
  maxLength: 100,
};

const nestedProperties: JSONSchema7 = {
  type: "object",
  properties: {
    status: { const: "active" },
    count: { const: 42 },
    tags: { enum: ["a", "b", "c"] },
  },
};

const arrayItems: JSONSchema7 = {
  type: "array",
  items: { const: "item" },
};

const tupleItems: JSONSchema7 = {
  type: "array",
  items: [{ const: "a" }, { const: 1 }, { const: true }],
};

const anyOfBranches: JSONSchema7 = {
  anyOf: [{ const: "a" }, { const: 1 }, { const: true }],
};

const oneOfBranches: JSONSchema7 = {
  oneOf: [{ const: true }, { const: "yes" }, { const: 42 }],
};

const additionalPropsSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: { const: 0 },
};

const patternProperties: JSONSchema7 = {
  patternProperties: { "^S_": { const: "active" }, "^N_": { enum: [1, 2, 3] } },
};

const deeplyNested: JSONSchema7 = {
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
                value: { const: "deep" },
              },
            },
          },
        },
      },
    },
  },
};

const complexSchema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Z]" },
    age: { type: "integer", minimum: 0, maximum: 150 },
    email: { type: "string", format: "email" },
    tags: {
      type: "array",
      items: { const: "tag" },
      minItems: 0,
      maxItems: 10,
      uniqueItems: true,
    },
    metadata: {
      type: "object",
      properties: {
        created: { const: "2024-01-01" },
      },
      additionalProperties: { enum: ["a", "b"] },
    },
  },
  required: ["name", "email"],
  additionalProperties: false,
};

const propertyNamesSchema: JSONSchema7 = {
  type: "object",
  propertyNames: { not: { not: { pattern: "^[a-z]" } } },
};

const containsSchema: JSONSchema7 = {
  type: "array",
  contains: { const: 42 },
};

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
  boxplot(() => {
    bench("const: string", () => checker.normalize(constString));
    bench("const: number", () => checker.normalize(constNumber));
    bench("const: integer", () => checker.normalize(constInteger));
    bench("const: boolean", () => checker.normalize(constBoolean));
    bench("const: object", () => checker.normalize(constObject));
    bench("const: array", () => checker.normalize(constArray));
    bench("const: null", () => checker.normalize(constNull));
  });
});

summary(() => {
  boxplot(() => {
    bench("enum: homogeneous [1,2,3]", () =>
      checker.normalize(enumHomogeneous),
    );
    bench("enum: heterogeneous ['a',1,true,null]", () =>
      checker.normalize(enumHeterogeneous),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("const + enum (const ∈ enum)", () =>
      checker.normalize(constWithEnum),
    );
    bench("const + enum (const ∉ enum)", () =>
      checker.normalize(constNotInEnum),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("double negation not(not(X))", () =>
      checker.normalize(doubleNegation),
    );
    bench("triple negation not(not(not(X)))", () =>
      checker.normalize(tripleNegation),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("simple string (no inference)", () =>
      checker.normalize(simpleString),
    );
    bench("boolean schema: true", () => checker.normalize(true));
    bench("boolean schema: false", () => checker.normalize(false));
  });
});

summary(() => {
  boxplot(() => {
    bench("nested properties (3 const/enum props)", () =>
      checker.normalize(nestedProperties),
    );
    bench("array items (single const)", () => checker.normalize(arrayItems));
    bench("tuple items (3 const values)", () => checker.normalize(tupleItems));
    bench("anyOf branches (3 const)", () => checker.normalize(anyOfBranches));
    bench("oneOf branches (3 const)", () => checker.normalize(oneOfBranches));
    bench("additionalProperties (const)", () =>
      checker.normalize(additionalPropsSchema),
    );
    bench("patternProperties (2 patterns)", () =>
      checker.normalize(patternProperties),
    );
    bench("contains (const)", () => checker.normalize(containsSchema));
    bench("propertyNames (double negation)", () =>
      checker.normalize(propertyNamesSchema),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("deeply nested (4 levels)", () => checker.normalize(deeplyNested));
    bench("complex schema (all keywords)", () =>
      checker.normalize(complexSchema),
    );
  });
});

await run();
