# Exported Types

```ts
import type {
  SubsetResult,
  SchemaError,
  ResolvedConditionResult,
  ResolvedSubsetResult,
  CheckRuntimeOptions,
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

## `CheckRuntimeOptions`

```ts
interface CheckRuntimeOptions {
  /** Runtime data used for condition resolution, runtime validation, and narrowing */
  data: unknown;
}
```

When `data` is provided to `check(sub, sup, { data })`:

1. **Condition resolution** — `if/then/else` branches in both `sub` and `sup` are resolved using `data`
2. **Narrowing** — schemas are narrowed using runtime values (e.g. enum materialization)
3. **Runtime validation** — `data` is validated against both resolved schemas via AJV
4. **Subset check** — the static subset check runs on the resolved/narrowed schemas

`data` is a **concrete runtime instance value**, not just a partial discriminant.
If `data` does not validate against the resolved sub or sup schema, the result
will be `isSubset: false` with runtime validation errors prefixed with `$sub` or `$sup`.

### Static vs Runtime mode

```ts
// Static mode — no runtime data, purely structural comparison
checker.check(sub, sup);

// Runtime mode — data influences resolution, validation, and narrowing
checker.check(sub, sup, { data: { kind: "text", value: "hello" } });
```

