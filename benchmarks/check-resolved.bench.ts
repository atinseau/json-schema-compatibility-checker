import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { run } from "./collect";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Conditional sup with if/then/else ───────────────────────────────────────

const conditionalSup: JSONSchema7 = {
  type: "object",
  properties: {
    kind: { type: "string" },
    value: {},
  },
  required: ["kind", "value"],
  if: {
    properties: { kind: { const: "text" } },
    required: ["kind"],
  },
  then: {
    properties: { value: { type: "string" } },
  },
  else: {
    properties: { value: { type: "number" } },
  },
};

// ─── Sub matching then-branch ────────────────────────────────────────────────

const subMatchingThen: JSONSchema7 = {
  type: "object",
  properties: {
    kind: { const: "text" },
    value: { type: "string", minLength: 1 },
  },
  required: ["kind", "value"],
};

const thenData = { kind: "text" };

// ─── Sub matching else-branch ────────────────────────────────────────────────

const subMatchingElse: JSONSchema7 = {
  type: "object",
  properties: {
    kind: { const: "data" },
    value: { type: "number", minimum: 0 },
  },
  required: ["kind", "value"],
};

const elseData = { kind: "data" };

// ─── Sub violating resolved branch ───────────────────────────────────────────

const subViolating: JSONSchema7 = {
  type: "object",
  properties: {
    kind: { const: "text" },
    value: { type: "number" }, // wrong! then-branch expects string
  },
  required: ["kind", "value"],
};

// ─── Form schema: business account ───────────────────────────────────────────

const formSchema: JSONSchema7 = {
  type: "object",
  properties: {
    accountType: { type: "string", enum: ["personal", "business"] },
    email: { type: "string", format: "email" },
    companyName: { type: "string" },
    taxId: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
  },
  required: ["accountType", "email"],
  if: {
    properties: { accountType: { const: "business" } },
    required: ["accountType"],
  },
  then: { required: ["companyName", "taxId"] },
  else: { required: ["firstName", "lastName"] },
};

const businessOutput: JSONSchema7 = {
  type: "object",
  properties: {
    accountType: {
      const: "business",
      type: "string",
      enum: ["personal", "business"],
    },
    email: { type: "string", format: "email" },
    companyName: { type: "string", minLength: 1 },
    taxId: { type: "string", minLength: 1 },
  },
  required: ["accountType", "email", "companyName", "taxId"],
  additionalProperties: false,
};

const businessFormData = { accountType: "business" };

const personalOutput: JSONSchema7 = {
  type: "object",
  properties: {
    accountType: {
      const: "personal",
      type: "string",
      enum: ["personal", "business"],
    },
    email: { type: "string", format: "email" },
    firstName: { type: "string", minLength: 1 },
    lastName: { type: "string", minLength: 1 },
  },
  required: ["accountType", "email", "firstName", "lastName"],
  additionalProperties: false,
};

const personalFormData = { accountType: "personal" };

// ─── Incomplete form output (should fail) ────────────────────────────────────

const incompleteFormSchema: JSONSchema7 = {
  type: "object",
  properties: {
    accountType: { type: "string", enum: ["personal", "business"] },
    email: { type: "string" },
  },
  required: ["accountType", "email"],
  if: {
    properties: { accountType: { const: "business" } },
    required: ["accountType"],
  },
  then: { required: ["companyName"] },
  else: { required: ["firstName"] },
};

const incompleteOutput: JSONSchema7 = {
  type: "object",
  properties: {
    accountType: { const: "business" },
    email: { type: "string" },
  },
  required: ["accountType", "email"],
  // Missing companyName!
};

// ─── Nested conditional: config with mode ────────────────────────────────────

const nestedConditionalSup: JSONSchema7 = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["fast", "safe"] },
        retries: { type: "integer" },
      },
      required: ["mode"],
      if: { properties: { mode: { const: "safe" } }, required: ["mode"] },
      then: {
        required: ["retries"],
        properties: { retries: { type: "integer", minimum: 3 } },
      },
    },
  },
  required: ["config"],
};

const nestedSub: JSONSchema7 = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: {
        mode: { const: "safe", type: "string", enum: ["fast", "safe"] },
        retries: { type: "integer", minimum: 5 },
      },
      required: ["mode", "retries"],
    },
  },
  required: ["config"],
};

const nestedData = { config: { mode: "safe" } };

// ─── Separate supData ────────────────────────────────────────────────────────

const subForSeparateData: JSONSchema7 = {
  type: "object",
  properties: { kind: { const: "text" }, value: { type: "string" } },
  required: ["kind", "value"],
};

const supDataThen = { kind: "text" };
const supDataElse = { kind: "other" };

// ─── Sub with its own conditions ─────────────────────────────────────────────

const subWithConditions: JSONSchema7 = {
  type: "object",
  properties: {
    kind: { const: "text" },
    value: { type: "string" },
  },
  required: ["kind", "value"],
  if: { properties: { kind: { const: "text" } }, required: ["kind"] },
  then: { properties: { value: { type: "string", minLength: 1 } } },
};

// ─── Pattern in resolved schemas ─────────────────────────────────────────────

const patternSup: JSONSchema7 = {
  type: "object",
  properties: {
    mode: { type: "string" },
    code: { type: "string" },
  },
  required: ["mode", "code"],
  if: {
    properties: { mode: { const: "strict" } },
    required: ["mode"],
  },
  then: {
    properties: {
      code: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
    },
  },
};

const patternSub: JSONSchema7 = {
  type: "object",
  properties: {
    mode: { const: "strict", type: "string" },
    code: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
  },
  required: ["mode", "code"],
};

const patternData = { mode: "strict" };

// ─── allOf + if/then/else combined ───────────────────────────────────────────

const allOfConditionalSup: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    role: { type: "string", enum: ["admin", "user", "guest"] },
  },
  required: ["name"],
  allOf: [
    {
      if: {
        properties: { age: { type: "number", exclusiveMinimum: 20 } },
        required: ["age"],
      },
      then: {
        required: ["email"],
        properties: { email: { type: "string" } },
      },
    },
    {
      if: {
        properties: { role: { const: "admin" } },
        required: ["role"],
      },
      then: {
        properties: {
          permissions: { type: "array", items: { type: "string" } },
        },
        required: ["permissions"],
      },
    },
  ],
};

const allOfSub: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    role: { type: "string", enum: ["admin", "user", "guest"] },
    email: { type: "string" },
    permissions: { type: "array", items: { type: "string" } },
  },
  required: ["name", "age", "role", "email", "permissions"],
};

const allOfData = { name: "Alice", age: 25, role: "admin" };

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
  boxplot(() => {
    bench("then-branch match (text → string)", () =>
      checker.checkResolved(subMatchingThen, conditionalSup, thenData),
    );
    bench("else-branch match (data → number)", () =>
      checker.checkResolved(subMatchingElse, conditionalSup, elseData),
    );
    bench("violating resolved branch (text → wrong type)", () =>
      checker.checkResolved(subViolating, conditionalSup, thenData),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("form: business output ⊆ conditional form (resolved)", () =>
      checker.checkResolved(businessOutput, formSchema, businessFormData),
    );
    bench("form: personal output ⊆ conditional form (resolved)", () =>
      checker.checkResolved(personalOutput, formSchema, personalFormData),
    );
    bench("form: incomplete output ⊄ conditional form (missing required)", () =>
      checker.checkResolved(
        incompleteOutput,
        incompleteFormSchema,
        businessFormData,
      ),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("nested: safe config (recursive resolution)", () =>
      checker.checkResolved(nestedSub, nestedConditionalSup, nestedData),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("separate supData: then resolution", () =>
      checker.checkResolved(
        subForSeparateData,
        conditionalSup,
        thenData,
        supDataThen,
      ),
    );
    bench("separate supData: else resolution", () =>
      checker.checkResolved(
        subForSeparateData,
        conditionalSup,
        thenData,
        supDataElse,
      ),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("sub with own conditions: both resolved", () =>
      checker.checkResolved(subWithConditions, conditionalSup, thenData),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("pattern: resolved sup adds pattern constraint", () =>
      checker.checkResolved(patternSub, patternSup, patternData),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("allOf: multiple conditions in allOf resolved", () =>
      checker.checkResolved(allOfSub, allOfConditionalSup, allOfData),
    );
  });
});

// ─── Comparison: isSubset (without resolution) vs checkResolved ──────────────

summary(() => {
  boxplot(() => {
    bench("comparison: isSubset WITHOUT resolution (false negative)", () =>
      checker.isSubset(subMatchingThen, conditionalSup),
    );
    bench("comparison: checkResolved WITH resolution (correct)", () =>
      checker.checkResolved(subMatchingThen, conditionalSup, thenData),
    );
  });
});

await run();
