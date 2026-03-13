# JSON Schema Compatibility Checker

> Check structural compatibility between JSON Schemas (Draft-07) using a set-theoretic intersection approach.

---

## Sommaire

- [Introduction](#introduction)
- [Mathematical Principle](#mathematical-principle)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Runtime Validation & Custom Constraints](#runtime-validation--custom-constraints)
- [Full Documentation](#-full-documentation)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Introduction

**JSON Schema Compatibility Checker** is a TypeScript library that checks structural compatibility between two JSON Schemas (Draft-07).

### Why this library?

In workflow systems, node orchestration, or API integration, a recurring question is:

> *"Is the output of component A compatible with the input of component B?"*

In other words: **will every value produced by A be accepted by B?**

This library answers that question by checking if one schema is a **subset** of another, with detailed structural diagnostics when incompatible.

### What it does

- ✅ Checks if a schema is a subset of another (`sub ⊆ sup`)
- ✅ Produces detailed diagnostics with structural differences
- ✅ Computes the intersection of two schemas (`allOf` merge)
- ✅ Accumulates schemas sequentially via deep spread (`overlay`)
- ✅ Resolves `if/then/else` conditions with discriminant data
- ✅ Handles `anyOf`, `oneOf`, `not`, `format`, `pattern`, `dependencies`, etc.
- ✅ Handles `oneOf`/`anyOf` nested inside object properties and array items
- ✅ Compares regex patterns via sampling
- ✅ Validates runtime data against resolved schemas (via [AJV](https://ajv.js.org/))
- ✅ Supports custom `constraints` keyword with user-provided validators
- ✅ Provides human-readable formatting of results for debugging

---

## Mathematical Principle

The core of the library relies on a simple set-theoretic principle:

```
A ⊆ B  ⟺  A ∩ B ≡ A
```

**A schema A is a subset of B if and only if the intersection of A and B is structurally identical to A.**

In JSON Schema terms:

| Mathematical concept | JSON Schema translation |
|---|---|
| `A ∩ B` | `allOf([A, B])` resolved via merge |
| `≡` (equivalence) | Deep structural comparison |

If after the merge (intersection) the result is identical to the original schema `A`, then `A` was not "restricted" by `B` — meaning `A` is already contained within `B`.

If the merge produces a result different from `A`, the structural differences constitute the **diagnostic** of the incompatibility.

---

## Installation

```bash
bun add json-schema-compatibility-checker
```

> **Prerequisites**: TypeScript ≥ 5, ESM-compatible runtime (Bun, Node 18+).

### Runtime dependencies

| Package | Role | Size impact |
|---|---|---|
| `@x0k/json-schema-merge` | Schema intersection (`allOf` merge) | lightweight |
| `ajv` + `ajv-formats` | Runtime JSON Schema validation (condition evaluation, data validation) | ~250KB |
| `class-validator` | Format validation helpers | lightweight |
| `randexp` | Regex pattern sampling for subset analysis | lightweight |

---

## Quick Start

The simplest example: check if a strict schema is compatible with a more permissive one.

```ts
import { JsonSchemaCompatibilityChecker } from "json-schema-compatibility-checker";

const checker = new JsonSchemaCompatibilityChecker();

// Strict schema: requires name AND age
const strict = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

// Permissive schema: requires only name
const loose = {
  type: "object",
  properties: {
    name: { type: "string" },
  },
  required: ["name"],
};

// Is every value valid for strict also valid for loose?
console.log(checker.isSubset(strict, loose)); // true ✅

// Is the reverse true?
console.log(checker.isSubset(loose, strict)); // false ❌
// → An object { name: "Alice" } (no age) is valid for loose but not for strict
```

---

## API Reference

### `JsonSchemaCompatibilityChecker`

All compatibility checking methods are exposed by the `JsonSchemaCompatibilityChecker` class.

```ts
const checker = new JsonSchemaCompatibilityChecker();
```

| Method | Description | Returns |
|---|---|---|
| `isSubset(sub, sup)` | Checks if `sub ⊆ sup` | `boolean` |
| `check(sub, sup)` | Checks with detailed diagnostics | `SubsetResult` |
| `check(sub, sup, options)` | Checks with `if/then/else` condition resolution and runtime validation | `ResolvedSubsetResult` |
| `isEqual(a, b)` | Structural equality after normalization | `boolean` |
| `intersect(a, b)` | Intersection of two schemas | `JSONSchema7Definition \| null` |
| `resolveConditions(schema, data)` | Resolves `if/then/else` with runtime data | `ResolvedConditionResult` |
| `normalize(schema)` | Normalizes a schema (infers types, resolves double negation, canonicalizes constraints) | `JSONSchema7Definition` |
| `formatResult(label, result)` | Formats a result for debug output | `string` |
| `clearValidatorCache()` | Clears the AJV compiled validator caches (useful for long-running processes or tests) | `void` |

### `MergeEngine`

Low-level schema operations: intersection (`allOf` merge) and overlay (sequential deep spread).

```ts
import { MergeEngine } from "json-schema-compatibility-checker";

const engine = new MergeEngine();
```

| Method | Description | Returns |
|---|---|---|
| `merge(a, b)` | Intersection `allOf([a, b])` — returns `null` if incompatible | `JSONSchema7Definition \| null` |
| `mergeOrThrow(a, b)` | Like `merge`, but throws if incompatible | `JSONSchema7Definition` |
| `overlay(base, override)` | Sequential deep spread — last writer wins per property | `JSONSchema7Definition` |
| `compare(a, b)` | Structural comparison (0 = identical) | `number` |
| `isEqual(a, b)` | Structural equality | `boolean` |

**Quick example — `check` with diagnostics:**

```ts
const result = checker.check(
  { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  { type: "object", properties: { name: { type: "string" }, age: { type: "number" } }, required: ["name", "age"] }
);

console.log(result.isSubset); // false
console.log(result.errors);
// [{ key: "age", expected: "number", received: "undefined" }]
```

**Quick example — condition resolution:**

```ts
const result = checker.check(sub, conditionalSup, {
  data: { kind: "text" },
});
console.log(result.isSubset);          // true ✅
console.log(result.resolvedSup.branch); // "then"
```

**Quick example — `overlay` for sequential accumulation:**

```ts
import { MergeEngine } from "json-schema-compatibility-checker";

const engine = new MergeEngine();

// Node1 produces accountId with enum
const node1Output = {
  type: "object",
  properties: { accountId: { type: "string", enum: ["a", "b"] } },
  required: ["accountId"],
};

// Node2 redefines accountId as a simple string (wider)
const node2Output = {
  type: "object",
  properties: { accountId: { type: "string" } },
  required: ["accountId"],
};

// ❌ merge (intersection): keeps the enum — WRONG for a sequential pipeline
engine.merge(node1Output, node2Output);
// → { ..., properties: { accountId: { type: "string", enum: ["a", "b"] } } }

// ✅ overlay (deep spread): last writer wins — CORRECT
engine.overlay(node1Output, node2Output);
// → { ..., properties: { accountId: { type: "string" } } }
```

👉 For full documentation of every method with examples, see the **[API Reference](./docs/api-reference.md)**.

---

## Runtime Validation & Custom Constraints

### Runtime data validation

When `check()` is called with `{ data }`, the library uses [AJV](https://ajv.js.org/) (JSON Schema validator) to:

1. **Resolve `if/then/else` conditions** — evaluates the `if` schema against the data to determine which branch applies
2. **Narrow schemas** using runtime values (e.g. enum materialization)
3. **Perform the static subset check** on the resolved/narrowed schemas
4. **Validate data against targeted resolved schemas** (opt-in via `validate`) — catches data-level violations (wrong format, out of range, etc.)
5. **Validate custom constraints** against data for targeted schemas (opt-in via `validate`)

```ts
// Resolve conditions + narrowing only (no runtime validation)
const result = checker.check(sub, sup, {
  data: { kind: "email", value: "test@example.com" },
});

// Full pipeline including AJV + constraint runtime validation on both schemas
const result = checker.check(sub, sup, {
  data: { kind: "email", value: "test@example.com" },
  validate: true,
});
// result.isSubset — structural compatibility + runtime validation
// result.errors   — includes runtime validation errors prefixed with $sub / $sup
```

### Validate targets

The `validate` option controls **which schemas** undergo runtime validation:

```ts
// Validate both sub and sup (equivalent to validate: true)
checker.check(sub, sup, { data, validate: { sub: true, sup: true } });

// Validate only the sup schema (e.g. target input with constraints)
checker.check(sub, sup, { data, validate: { sup: true } });

// Validate only the sub schema
checker.check(sub, sup, { data, validate: { sub: true } });
```

### Partial validation mode

When you have **partial data** (e.g. only some properties known at design-time), standard runtime validation fails on missing `required` properties and `additionalProperties` constraints. The `partial` option strips these constraints before AJV validation so that only the properties **present** in data are validated:

```ts
const sup = {
  type: "object",
  properties: {
    accountId: { type: "string", enum: ["salut", "coucou"] },
    meetingId: { type: "string" },
    extraField: { type: "number" },
  },
  required: ["accountId", "meetingId", "extraField"],
};

// ❌ Without partial: fails on missing meetingId and extraField
const result = await checker.check(sup, sup, {
  data: { accountId: "salut" },
  validate: { sup: true },
});
// errors: meetingId missing, extraField missing

// ✅ With partial: validates only accountId (present in data)
const result = await checker.check(sup, sup, {
  data: { accountId: "salut" },
  validate: { sup: { partial: true } },
});
// errors: [] — accountId is valid, missing properties are ignored

// ✅ Partial still catches invalid values on present properties
const result = await checker.check(sup, sup, {
  data: { accountId: "bad_value" },
  validate: { sup: { partial: true } },
});
// errors: [{ key: "$sup.accountId", expected: "salut or coucou", received: "bad_value" }]
```

Partial mode applies recursively to nested objects and works with `oneOf`/`anyOf` branches, `if/then/else` conditions, and array items. Custom constraint validators already handle partial data correctly (they skip properties not present in data), so constraints are evaluated normally regardless of partial mode.

### Custom `constraints` keyword

The library extends JSON Schema with a custom `constraints` keyword for domain-specific validation rules that go beyond what JSON Schema can express (e.g. "is a valid UUID", "belongs to scope", "minimum age"):

```ts
import { JsonSchemaCompatibilityChecker } from "json-schema-compatibility-checker";

const checker = new JsonSchemaCompatibilityChecker({
  constraints: {
    IsUuid: (value) => ({
      valid: typeof value === "string" && /^[0-9a-f]{8}-/.test(value),
      message: "Value must be a valid UUID",
    }),
    MinAge: (value, params) => ({
      valid: typeof value === "number" && value >= (params?.min ?? 0),
      message: `Value must be at least ${params?.min}`,
    }),
  },
});

// Constraints in schemas
const sub = {
  type: "object",
  properties: {
    id: { type: "string", constraints: ["IsUuid"] },
    age: { type: "number", constraints: [{ name: "MinAge", params: { min: 18 } }] },
  },
  required: ["id", "age"],
};

// Static subset checking works with constraints (structural comparison)
checker.isSubset(sub, sup); // compares constraints via deepEqual after merge

// Runtime validation evaluates constraints against actual data
checker.check(sub, sup, { data: { id: "not-a-uuid", age: 15 } });
// → errors include constraint violations
```

Constraints are handled at three levels:
- **Structurally**: the merge engine unions them (intersection semantics — `allOf`)
- **Statically**: the subset checker compares them via `deepEqual` after merge
- **At runtime**: the constraint validator evaluates them against concrete data

---

## 📖 Full Documentation

| Page | Description |
|---|---|
| **[API Reference](./docs/api-reference.md)** | Detailed documentation of every method (`JsonSchemaCompatibilityChecker` + `MergeEngine`) with examples |
| **[Features Guide](./docs/features-guide.md)** | Complete feature tour: types, `required`, numeric constraints, `enum`/`const`, `anyOf`/`oneOf`, `not`, `format`, `pattern`, `if/then/else` conditions, `allOf`, custom `constraints`... |
| **[Utility Functions](./docs/utilities.md)** | `isPatternSubset`, `arePatternsEquivalent`, `isTrivialPattern` |
| **[Use Cases](./docs/use-cases.md)** | Node connection, sequential pipeline (overlay), API response validation, discriminated unions, conditional forms |
| **[Exported Types](./docs/types.md)** | `SubsetResult`, `SchemaError`, `ResolvedConditionResult`, `ResolvedSubsetResult`, `CheckRuntimeOptions`, `ValidateTargets`, `ValidateTargetOptions`, `ConstraintValidator`, `CheckerOptions` |
| **[Known Limitations](./docs/limitations.md)** | Cross-keyword constraints, `oneOf` exclusivity, probabilistic patterns, `$ref` not supported |
| **[Internal Architecture](./docs/architecture.md)** | Module diagram, verification flow, merge vs overlay, dependencies |

---

## Known Limitations

- **Cross-keyword constraints**: `exclusiveMinimum` vs `minimum` comparison may produce false negatives (structural limitation)
- **`oneOf` exclusivity**: treated like `anyOf` — semantic exclusivity is not verified
- **Regex patterns**: probabilistic approach via sampling (200 samples), not a formal proof
- **`if/then/else`**: requires discriminant data via `check(sub, sup, { data })`
- **`$ref`**: not supported — schemas must be pre-dereferenced
- **`patternProperties`**: partial support only
- **Nested branching fallback**: the property-by-property fallback for nested `oneOf`/`anyOf` does not check object-level keywords (`minProperties`/`maxProperties`) — those are handled by the merge when branching is not involved

👉 Details and examples in **[Known Limitations](./docs/limitations.md)**.

---

## License

MIT