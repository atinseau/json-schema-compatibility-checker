# Exported Types

```ts
import type {
  SubsetResult,
  SchemaError,
  ResolvedConditionResult,
  ResolvedSubsetResult,
  CheckRuntimeOptions,
  ValidateTargets,
  ValidateTargetOptions,
} from "json-schema-compatibility-checker";
```

---

## `SchemaError`

```ts
interface SchemaError {
  /** Normalized path to the concerned property (e.g. "user.name", "users[].name", "accountId") */
  key: string;
  /** Type or value expected by the target schema (sup) */
  expected: string;
  /** Type or value received from the source schema (sub) */
  received: string;
}
```

---

## `SubsetResult`

```ts
interface SubsetResult {
  /** true if sub ⊆ sup (every value valid for sub is also valid for sup) */
  isSubset: boolean;
  /** The schema resulting from the intersection allOf(sub, sup), or null if incompatible */
  merged: JSONSchema7Definition | null;
  /** Semantic errors describing incompatibilities between the two schemas */
  errors: SchemaError[];
}
```

---

## `ResolvedConditionResult`

```ts
interface ResolvedConditionResult {
  /** The schema with if/then/else resolved (flattened) */
  resolved: JSONSchema7;
  /** The branch that was applied ("then" | "else" | null if no condition) */
  branch: "then" | "else" | null;
  /** The discriminant used for resolution */
  discriminant: Record<string, unknown>;
}
```

---

## `ResolvedSubsetResult`

```ts
interface ResolvedSubsetResult extends SubsetResult {
  /** Resolution result for the sub schema's conditions */
  resolvedSub: ResolvedConditionResult;
  /** Resolution result for the sup schema's conditions */
  resolvedSup: ResolvedConditionResult;
}
```

---

## `ValidateTargetOptions`

```ts
interface ValidateTargetOptions {
  /**
   * When true, strip `required` and `additionalProperties` from the
   * schema before AJV validation so that only properties present in
   * `data` are validated.
   *
   * @default false
   */
  partial?: boolean;
}
```

Use `partial: true` when you have **partial data** at design-time (e.g. only some property values are known) and want to validate those values against the schema without false negatives on missing required properties or unexpected additional properties.

Partial mode applies **recursively**: nested object schemas also have their `required` and `additionalProperties` stripped before AJV compilation.

> **Note:** Custom constraint validators (`validateSchemaConstraints`) already skip properties not present in the data, so `partial` only affects the AJV validation step.

---

## `ValidateTargets`

```ts
interface ValidateTargets {
  /** When true or an options object, validate data against the resolved sub schema */
  sub?: boolean | ValidateTargetOptions;
  /** When true or an options object, validate data against the resolved sup schema */
  sup?: boolean | ValidateTargetOptions;
}
```

Each target accepts either:
- `true` — enable validation with default options
- `false` / omitted — skip validation for this target
- `{ partial: true }` — enable validation in **partial mode** (strips `required` and `additionalProperties`)

```ts
// Validate only sup
checker.check(sub, sup, { data, validate: { sup: true } });

// Validate sup in partial mode (only check properties present in data)
checker.check(sub, sup, { data, validate: { sup: { partial: true } } });

// Validate sub in partial mode, sup in full mode
checker.check(sub, sup, { data, validate: { sub: { partial: true }, sup: true } });
```

---

## `CheckRuntimeOptions`

```ts
interface CheckRuntimeOptions {
  /** Runtime data used for condition resolution, narrowing, and optionally runtime validation */
  data: unknown;

  /**
   * Controls runtime validation of data against resolved schemas.
   *
   * - `true` — validate against both sub and sup schemas (AJV + constraints)
   * - `false` / omitted — no runtime validation (data used only for condition resolution and narrowing)
   * - `{ sub: true }` — validate only against the sub schema
   * - `{ sup: true }` — validate only against the sup schema
   * - `{ sub: true, sup: true }` — equivalent to `true`
   * - `{ sup: { partial: true } }` — validate sup in partial mode
   *
   * @default false
   */
  validate?: boolean | ValidateTargets;
}
```

When `data` is provided to `check(sub, sup, { data })`:

1. **Condition resolution** — `if/then/else` branches in both `sub` and `sup` are resolved using `data`
2. **Narrowing** — schemas are narrowed using runtime values (e.g. enum materialization)
3. **Static subset check** — the merge-based structural subset check runs on the resolved/narrowed schemas
4. **Runtime validation** (opt-in via `validate`) — `data` is validated against the targeted resolved schema(s) via AJV, then custom constraints are evaluated

When `validate` is omitted or `false`, `data` is used **only** for condition resolution and narrowing — no AJV validation runs.

When `validate` is enabled, `data` is a **concrete runtime instance value**. If `data` does not validate against the targeted schema(s), the result will be `isSubset: false` with runtime validation errors prefixed with `$sub` or `$sup`.

### Partial validation mode

When a validate target uses `{ partial: true }`, the runtime validator strips `required` and `additionalProperties` from the schema before AJV compilation. This allows validating **only the properties present in `data`** without false negatives for missing properties.

```ts
const sup = {
  type: "object",
  properties: {
    accountId: { type: "string", enum: ["a", "b"] },
    meetingId: { type: "string" },
  },
  required: ["accountId", "meetingId"],
};

// Full mode: fails because meetingId is missing
const full = await checker.check(sup, sup, {
  data: { accountId: "a" },
  validate: { sup: true },
});
console.log(full.isSubset); // false — meetingId missing

// Partial mode: only validates accountId (which is present and valid)
const partial = await checker.check(sup, sup, {
  data: { accountId: "a" },
  validate: { sup: { partial: true } },
});
console.log(partial.isSubset); // true — accountId is valid, meetingId skipped
```

### Static vs Runtime mode

```ts
// Static mode — no runtime data, purely structural comparison
checker.check(sub, sup);

// Runtime mode — data influences resolution, validation, and narrowing
checker.check(sub, sup, { data: { kind: "text", value: "hello" }, validate: true });

// Runtime mode with partial validation on sup
checker.check(sub, sup, { data: { kind: "text" }, validate: { sup: { partial: true } } });
```

