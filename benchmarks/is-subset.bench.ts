import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { run } from "./collect";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Identity / Trivial ──────────────────────────────────────────────────────

const simpleObject: JSONSchema7 = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
};

// ─── Type compatibility ──────────────────────────────────────────────────────

const integerSchema: JSONSchema7 = { type: "integer" };
const numberSchema: JSONSchema7 = { type: "number" };
const stringSchema: JSONSchema7 = { type: "string" };

// ─── Required fields ─────────────────────────────────────────────────────────

const moreRequired: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

const lessRequired: JSONSchema7 = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
};

// ─── additionalProperties ────────────────────────────────────────────────────

const closedObject: JSONSchema7 = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

const openObject: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name"],
};

// ─── Numeric constraints ─────────────────────────────────────────────────────

const strictNumeric: JSONSchema7 = { type: "number", minimum: 5, maximum: 10 };
const looseNumeric: JSONSchema7 = { type: "number", minimum: 0, maximum: 100 };
const exclusiveMinSub: JSONSchema7 = { type: "number", exclusiveMinimum: 5 };
const exclusiveMinSup: JSONSchema7 = { type: "number", exclusiveMinimum: 0 };
const multipleOf6: JSONSchema7 = { type: "number", multipleOf: 6 };
const multipleOf3: JSONSchema7 = { type: "number", multipleOf: 3 };

// ─── String constraints ──────────────────────────────────────────────────────

const strictString: JSONSchema7 = {
  type: "string",
  minLength: 3,
  maxLength: 10,
  pattern: "^[a-z]+$",
};

const looseString: JSONSchema7 = {
  type: "string",
  minLength: 1,
  maxLength: 100,
};

// ─── Enum ────────────────────────────────────────────────────────────────────

const smallEnum: JSONSchema7 = { type: "string", enum: ["a", "b"] };
const largeEnum: JSONSchema7 = { type: "string", enum: ["a", "b", "c", "d"] };

// ─── Array constraints ──────────────────────────────────────────────────────

const strictArray: JSONSchema7 = {
  type: "array",
  items: { type: "string", minLength: 1 },
  minItems: 1,
  maxItems: 5,
};

const looseArray: JSONSchema7 = {
  type: "array",
  items: { type: "string" },
};

const arrayWithUniqueItems: JSONSchema7 = {
  type: "array",
  items: { type: "number" },
  uniqueItems: true,
};

const arrayWithoutUniqueItems: JSONSchema7 = {
  type: "array",
  items: { type: "number" },
};

// ─── Deep nested ─────────────────────────────────────────────────────────────

const deepStrict: JSONSchema7 = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: {
            name: { type: "string" },
            bio: { type: "string" },
          },
          required: ["name", "bio"],
        },
      },
      required: ["profile"],
    },
  },
  required: ["user"],
};

const deepLoose: JSONSchema7 = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      required: ["profile"],
    },
  },
  required: ["user"],
};

const deep4Level: JSONSchema7 = {
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

const deep4LevelLoose: JSONSchema7 = {
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
                value: { type: "string" },
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

// ─── anyOf / oneOf ───────────────────────────────────────────────────────────

const anyOfSub: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }],
};

const anyOfSup: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};

const oneOfDiscriminated: JSONSchema7 = {
  oneOf: [
    {
      type: "object",
      properties: { kind: { const: "a" }, value: { type: "string" } },
      required: ["kind", "value"],
    },
    {
      type: "object",
      properties: { kind: { const: "b" }, value: { type: "number" } },
      required: ["kind", "value"],
    },
  ],
};

const oneOfLoose: JSONSchema7 = {
  oneOf: [
    {
      type: "object",
      properties: { kind: { type: "string" }, value: { type: "string" } },
      required: ["kind", "value"],
    },
    {
      type: "object",
      properties: { kind: { type: "string" }, value: { type: "number" } },
      required: ["kind", "value"],
    },
  ],
};

// ─── const / boolean schemas ─────────────────────────────────────────────────

const constHello: JSONSchema7 = { const: "hello" };
const constFortyTwo: JSONSchema7 = { const: 42 };

// ─── Type arrays ─────────────────────────────────────────────────────────────

const typeArraySmall: JSONSchema7 = { type: ["string"] };
const typeArrayLarge: JSONSchema7 = { type: ["string", "number"] };
const typeArrayNullable: JSONSchema7 = { type: ["string", "null"] };
const typeArrayString: JSONSchema7 = { type: ["string"] };

// ─── Format hierarchy ────────────────────────────────────────────────────────

const formatEmail: JSONSchema7 = { type: "string", format: "email" };
const formatIdnEmail: JSONSchema7 = { type: "string", format: "idn-email" };
const formatUri: JSONSchema7 = { type: "string", format: "uri" };
const formatIri: JSONSchema7 = { type: "string", format: "iri" };

// ─── not ─────────────────────────────────────────────────────────────────────

const notStringSub: JSONSchema7 = { type: "number" };
const notStringSup: JSONSchema7 = { not: { type: "string" } };
const notConstSub: JSONSchema7 = { type: "string", not: { const: "foo" } };
const notConstSup: JSONSchema7 = { type: "string" };

// ─── contains ────────────────────────────────────────────────────────────────

const containsStrict: JSONSchema7 = {
  type: "array",
  contains: { type: "string", minLength: 5 },
};

const containsLoose: JSONSchema7 = {
  type: "array",
  contains: { type: "string" },
};

// ─── Wide schema ─────────────────────────────────────────────────────────────

function makeWide(count: number): JSONSchema7 {
  const properties: Record<string, JSONSchema7> = {};
  const required: string[] = [];
  for (let i = 0; i < count; i++) {
    properties[`prop_${i}`] = { type: "string" };
    required.push(`prop_${i}`);
  }
  return { type: "object", properties, required };
}

const wide20 = makeWide(20);
const wide15 = makeWide(15);

// ─── Complex real-world ──────────────────────────────────────────────────────

const complexSchema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Z]" },
    age: { type: "integer", minimum: 0, maximum: 150, exclusiveMinimum: -1 },
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
  propertyNames: { minLength: 1 },
};

// ─── 5-level deep nesting ────────────────────────────────────────────────────

function makeDeep(
  depth: number,
  extra: Partial<JSONSchema7> = {},
): JSONSchema7 {
  if (depth === 0) return { type: "string", ...extra };
  return {
    type: "object",
    properties: { child: makeDeep(depth - 1, extra) },
    required: ["child"],
  };
}

const deep5Strict = makeDeep(5, { minLength: 1 });
const deep5Loose = makeDeep(5);

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
  boxplot(() => {
    bench("identity: A ⊆ A (simple object)", () =>
      checker.isSubset(simpleObject, simpleObject),
    );
    bench("identity: A ⊆ A (complex schema)", () =>
      checker.isSubset(complexSchema, complexSchema),
    );
    bench("boolean: false ⊆ true", () => checker.isSubset(false, true));
    bench("boolean: false ⊆ false", () => checker.isSubset(false, false));
    bench("boolean: true ⊆ true", () => checker.isSubset(true, true));
    bench("empty: {} ⊆ {}", () => checker.isSubset({}, {}));
  });
});

summary(() => {
  boxplot(() => {
    bench("type: integer ⊆ number (true)", () =>
      checker.isSubset(integerSchema, numberSchema),
    );
    bench("type: number ⊄ integer (false)", () =>
      checker.isSubset(numberSchema, integerSchema),
    );
    bench("type: string ⊄ number (false)", () =>
      checker.isSubset(stringSchema, numberSchema),
    );
    bench("type: string ⊆ string (true)", () =>
      checker.isSubset(stringSchema, stringSchema),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("required: more ⊆ less (true)", () =>
      checker.isSubset(moreRequired, lessRequired),
    );
    bench("required: less ⊄ more (false)", () =>
      checker.isSubset(lessRequired, moreRequired),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("additionalProps: closed ⊆ open (true)", () =>
      checker.isSubset(closedObject, openObject),
    );
    bench("additionalProps: open ⊄ closed (false)", () =>
      checker.isSubset(openObject, closedObject),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("numeric: strict [5,10] ⊆ loose [0,100] (true)", () =>
      checker.isSubset(strictNumeric, looseNumeric),
    );
    bench("numeric: loose [0,100] ⊄ strict [5,10] (false)", () =>
      checker.isSubset(looseNumeric, strictNumeric),
    );
    bench("numeric: exclusiveMin 5 ⊆ exclusiveMin 0 (true)", () =>
      checker.isSubset(exclusiveMinSub, exclusiveMinSup),
    );
    bench("numeric: multipleOf(6) ⊆ multipleOf(3) (true)", () =>
      checker.isSubset(multipleOf6, multipleOf3),
    );
    bench("numeric: multipleOf(3) ⊄ multipleOf(6) (false)", () =>
      checker.isSubset(multipleOf3, multipleOf6),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("string: strict ⊆ loose (true)", () =>
      checker.isSubset(strictString, looseString),
    );
    bench("string: loose ⊄ strict (false)", () =>
      checker.isSubset(looseString, strictString),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("enum: small ⊆ large (true)", () =>
      checker.isSubset(smallEnum, largeEnum),
    );
    bench("enum: large ⊄ small (false)", () =>
      checker.isSubset(largeEnum, smallEnum),
    );
    bench("enum: single value ⊆ type (true)", () =>
      checker.isSubset({ type: "string", enum: ["hello"] }, stringSchema),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("array: strict ⊆ loose (true)", () =>
      checker.isSubset(strictArray, looseArray),
    );
    bench("array: loose ⊄ strict (false)", () =>
      checker.isSubset(looseArray, strictArray),
    );
    bench("array: uniqueItems ⊆ no uniqueItems (true)", () =>
      checker.isSubset(arrayWithUniqueItems, arrayWithoutUniqueItems),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("deep 3-level: strict ⊆ loose (true)", () =>
      checker.isSubset(deepStrict, deepLoose),
    );
    bench("deep 3-level: loose ⊄ strict (false)", () =>
      checker.isSubset(deepLoose, deepStrict),
    );
    bench("deep 4-level: strict ⊆ loose (true)", () =>
      checker.isSubset(deep4Level, deep4LevelLoose),
    );
    bench("deep 5-level: strict ⊆ loose (true)", () =>
      checker.isSubset(deep5Strict, deep5Loose),
    );
    bench("deep 5-level: loose ⊄ strict (false)", () =>
      checker.isSubset(deep5Loose, deep5Strict),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("anyOf: sub ⊆ sup (true)", () =>
      checker.isSubset(anyOfSub, anyOfSup),
    );
    bench("anyOf: sup ⊄ sub (false)", () =>
      checker.isSubset(anyOfSup, anyOfSub),
    );
    bench("atomic ⊆ anyOf matching (true)", () =>
      checker.isSubset({ type: "string", minLength: 1 }, anyOfSup),
    );
    bench("atomic ⊄ anyOf no match (false)", () =>
      checker.isSubset(
        { type: "boolean" },
        { anyOf: [{ type: "string" }, { type: "number" }] },
      ),
    );
    bench("oneOf discriminated ⊆ oneOf loose (true)", () =>
      checker.isSubset(oneOfDiscriminated, oneOfLoose),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("const string ⊆ type string (true)", () =>
      checker.isSubset(constHello, stringSchema),
    );
    bench("const number ⊆ type number (true)", () =>
      checker.isSubset(constFortyTwo, numberSchema),
    );
    bench("const string ⊄ type number (false)", () =>
      checker.isSubset(constHello, numberSchema),
    );
    bench("any schema ⊆ true (true)", () =>
      checker.isSubset(stringSchema, true),
    );
    bench("true ⊄ concrete schema (false)", () =>
      checker.isSubset(true, stringSchema),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("type array: [string] ⊆ [string,number] (true)", () =>
      checker.isSubset(typeArraySmall, typeArrayLarge),
    );
    bench("type array: [string,number] ⊄ [string] (false)", () =>
      checker.isSubset(typeArrayLarge, typeArraySmall),
    );
    bench("type array: [string,null] ⊄ [string] (false)", () =>
      checker.isSubset(typeArrayNullable, typeArrayString),
    );
    bench("type array: [string] ⊆ [string,null] (true)", () =>
      checker.isSubset(typeArrayString, typeArrayNullable),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("format: email ⊆ idn-email (true)", () =>
      checker.isSubset(formatEmail, formatIdnEmail),
    );
    bench("format: uri ⊆ iri (true)", () =>
      checker.isSubset(formatUri, formatIri),
    );
    bench("format: email ⊆ string (true)", () =>
      checker.isSubset(formatEmail, stringSchema),
    );
    bench("format: string ⊄ email (false)", () =>
      checker.isSubset(stringSchema, formatEmail),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("not: number ⊆ not(string) (true)", () =>
      checker.isSubset(notStringSub, notStringSup),
    );
    bench("not: string+not(const) ⊆ string (true)", () =>
      checker.isSubset(notConstSub, notConstSup),
    );
    bench("contains: strict ⊆ loose (true)", () =>
      checker.isSubset(containsStrict, containsLoose),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("wide 20-prop schema vs 15-prop", () =>
      checker.isSubset(wide20, wide15),
    );
    bench("wide 15-prop schema vs 20-prop", () =>
      checker.isSubset(wide15, wide20),
    );
  });
});

await run();
