import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { run } from "./collect";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Compatible (isSubset: true, no diffs) ───────────────────────────────────

const compatibleStringSub: JSONSchema7 = { type: "string", minLength: 5 };
const compatibleStringSup: JSONSchema7 = { type: "string" };

const compatibleObjectSub: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

const compatibleObjectSup: JSONSchema7 = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
};

const compatibleNumericSub: JSONSchema7 = {
  type: "number",
  minimum: 5,
  maximum: 10,
};

const compatibleNumericSup: JSONSchema7 = {
  type: "number",
  minimum: 0,
  maximum: 100,
};

// ─── Incompatible: missing required ──────────────────────────────────────────

const missingRequiredSub: JSONSchema7 = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
};

const missingRequiredSup: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

// ─── Incompatible: conflicting types ─────────────────────────────────────────

const typeConflictSub: JSONSchema7 = { type: "string" };
const typeConflictSup: JSONSchema7 = { type: "number" };

// ─── Incompatible: nested diffs ──────────────────────────────────────────────

const nestedDiffSub: JSONSchema7 = {
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

const nestedDiffSup: JSONSchema7 = {
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

// ─── Incompatible: additionalProperties ──────────────────────────────────────

const additionalPropsSub: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name"],
};

const additionalPropsSup: JSONSchema7 = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

// ─── Incompatible: numeric constraint changes ────────────────────────────────

const numericConstraintSub: JSONSchema7 = {
  type: "number",
  minimum: 0,
  maximum: 100,
};

const numericConstraintSup: JSONSchema7 = {
  type: "number",
  minimum: 5,
  maximum: 10,
};

// ─── Incompatible: anyOf branch rejection ────────────────────────────────────

const anyOfBranchSub: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};

const anyOfBranchSup: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }],
};

// ─── Incompatible: anyOf no matching branch ──────────────────────────────────

const anyOfNoMatchSub: JSONSchema7 = { type: "boolean" };
const anyOfNoMatchSup: JSONSchema7 = {
  anyOf: [{ type: "string" }, { type: "number" }],
};

// ─── Incompatible: enum changes ──────────────────────────────────────────────

const enumChangeSub: JSONSchema7 = {
  type: "string",
  enum: ["a", "b", "c", "d"],
};

const enumChangeSup: JSONSchema7 = {
  type: "string",
  enum: ["a", "b"],
};

// ─── Incompatible: pattern added ─────────────────────────────────────────────

const patternAddedSub: JSONSchema7 = { type: "string", minLength: 1 };
const patternAddedSup: JSONSchema7 = {
  type: "string",
  minLength: 1,
  pattern: "^[a-z]+$",
};

// ─── Deep nesting diff ───────────────────────────────────────────────────────

const deepDiffSub: JSONSchema7 = {
  type: "object",
  properties: {
    level1: {
      type: "object",
      properties: {
        level2: {
          type: "object",
          properties: {
            value: { type: "string" },
          },
        },
      },
    },
  },
};

const deepDiffSup: JSONSchema7 = {
  type: "object",
  properties: {
    level1: {
      type: "object",
      properties: {
        level2: {
          type: "object",
          properties: {
            value: { type: "string", minLength: 10 },
          },
        },
      },
    },
  },
};

// ─── Multiple diffs ──────────────────────────────────────────────────────────

const multipleDiffsSub: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
};

const multipleDiffsSup: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    age: { type: "number", minimum: 0 },
    email: { type: "string" },
  },
  required: ["name", "age", "email"],
};

// ─── oneOf diff paths ────────────────────────────────────────────────────────

const oneOfDiffSub: JSONSchema7 = {
  oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};

const oneOfDiffSup: JSONSchema7 = {
  oneOf: [{ type: "string" }, { type: "number" }],
};

// ─── Real-world: API response check ──────────────────────────────────────────

const apiResponseSub: JSONSchema7 = {
  type: "object",
  properties: {
    status: { type: "integer", minimum: 100, maximum: 599 },
    data: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              name: { type: "string", minLength: 1 },
              role: { type: "string", enum: ["admin", "user", "viewer"] },
            },
            required: ["id", "email", "name", "role"],
          },
          minItems: 0,
        },
        total: { type: "integer", minimum: 0 },
      },
      required: ["users", "total"],
    },
  },
  required: ["status", "data"],
};

const apiResponseSup: JSONSchema7 = {
  type: "object",
  properties: {
    status: { type: "integer" },
    data: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string" },
            },
            required: ["id", "email"],
          },
        },
        total: { type: "number" },
      },
      required: ["users"],
    },
  },
  required: ["data"],
};

// ─── Real-world: webhook payload (incompatible) ──────────────────────────────

const webhookSub: JSONSchema7 = {
  type: "object",
  properties: {
    event: { type: "string" },
    payload: { type: "object" },
  },
  required: ["event"],
};

const webhookSup: JSONSchema7 = {
  type: "object",
  properties: {
    event: { type: "string", enum: ["created", "updated", "deleted"] },
    payload: {
      type: "object",
      properties: {
        id: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
      },
      required: ["id", "timestamp"],
    },
  },
  required: ["event", "payload"],
};

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
  boxplot(() => {
    bench("compatible: string (no diffs)", () =>
      checker.check(compatibleStringSub, compatibleStringSup),
    );
    bench("compatible: object (no diffs)", () =>
      checker.check(compatibleObjectSub, compatibleObjectSup),
    );
    bench("compatible: numeric range (no diffs)", () =>
      checker.check(compatibleNumericSub, compatibleNumericSup),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("incompatible: missing required (diffs)", () =>
      checker.check(missingRequiredSub, missingRequiredSup),
    );
    bench("incompatible: conflicting types → null merge", () =>
      checker.check(typeConflictSub, typeConflictSup),
    );
    bench("incompatible: additionalProperties constraint", () =>
      checker.check(additionalPropsSub, additionalPropsSup),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("incompatible: nested object diffs (3 levels)", () =>
      checker.check(nestedDiffSub, nestedDiffSup),
    );
    bench("incompatible: deep nesting diffs (3 levels)", () =>
      checker.check(deepDiffSub, deepDiffSup),
    );
    bench("incompatible: multiple diffs reported", () =>
      checker.check(multipleDiffsSub, multipleDiffsSup),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("incompatible: numeric constraint changes", () =>
      checker.check(numericConstraintSub, numericConstraintSup),
    );
    bench("incompatible: enum changes", () =>
      checker.check(enumChangeSub, enumChangeSup),
    );
    bench("incompatible: pattern added", () =>
      checker.check(patternAddedSub, patternAddedSup),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("incompatible: anyOf branch rejection", () =>
      checker.check(anyOfBranchSub, anyOfBranchSup),
    );
    bench("incompatible: anyOf no matching branch", () =>
      checker.check(anyOfNoMatchSub, anyOfNoMatchSup),
    );
    bench("incompatible: oneOf extra branch", () =>
      checker.check(oneOfDiffSub, oneOfDiffSup),
    );
  });
});

summary(() => {
  boxplot(() => {
    bench("real-world: API response ⊆ expected input (compatible)", () =>
      checker.check(apiResponseSub, apiResponseSup),
    );
    bench("real-world: webhook payload ⊄ strict event (incompatible)", () =>
      checker.check(webhookSub, webhookSup),
    );
  });
});

// ─── formatResult benchmarks ─────────────────────────────────────────────────

const passingResult = checker.check(compatibleStringSub, compatibleStringSup);
const failingResult = checker.check(numericConstraintSub, numericConstraintSup);
const typeClashResult = checker.check(typeConflictSub, typeConflictSup);
const nestedResult = checker.check(nestedDiffSub, nestedDiffSup);

summary(() => {
  boxplot(() => {
    bench("formatResult: passing (✅)", () =>
      checker.formatResult("test", passingResult),
    );
    bench("formatResult: failing with diffs (❌)", () =>
      checker.formatResult("test", failingResult),
    );
    bench("formatResult: type clash (❌)", () =>
      checker.formatResult("test", typeClashResult),
    );
    bench("formatResult: nested diffs (❌)", () =>
      checker.formatResult("test", nestedResult),
    );
  });
});

await run();
