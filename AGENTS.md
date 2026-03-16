# AGENTS.md

## Project Overview

**json-schema-compatibility-checker** is a TypeScript library that checks compatibility between two JSON Schemas (Draft-07) using set-theoretic principles. The core idea: `A ⊆ B ⟺ A ∩ B ≡ A` — a schema A is a subset of B if their intersection (via `allOf` merge) equals A structurally.

- **Runtime**: Bun (test runner, script runner, package manager)
- **Language**: TypeScript (strict mode, ESNext target)
- **Linter/Formatter**: Biome (tabs, double quotes, recommended rules)
- **Build**: SWC (ESM + CJS dual output) + tsc (declaration files only)
- **Tests**: Bun's built-in test runner (`bun:test`)
- **Dependencies**: `@x0k/json-schema-merge` (merge engine), `ajv` + `ajv-formats` (runtime JSON Schema validation — condition evaluation, data validation), `class-validator` (format validation), `randexp` (pattern sampling)

## Commands — Always Validate Your Changes

```bash
# Install dependencies (required before anything else)
bun install

# Type-check (no emit) — run FIRST to catch type errors early
bun check-types

# Lint + format (auto-fix with --write)
bun biome check --write --unsafe

# Run all tests
bun test

# Run a single test file (use this to iterate quickly — saves tokens)
bun test tests/core/is-subset.spec.ts

# Build (ESM + CJS + types) — only needed to verify publish artifacts
bun run build

# Benchmarks
bun run bench
```

**Mandatory before committing**: `bun check-types && bun biome check --write --unsafe && bun test`

The CI pipeline (`.github/workflows/ci.yml`) runs: check-types → biome check → test → build. Your changes MUST pass all four.

## Token Efficiency Rules

**Do NOT read entire files into context when you only need a signature or a small section.** This codebase has files up to 1200+ lines. Follow these rules:

1. **Search before reading.** Use `grep -rn "functionName" src/` to locate symbols. Do NOT `cat` entire files to find something.
2. **Read only the lines you need.** Use `sed -n '50,80p' src/subset-checker.ts` or equivalent to read specific line ranges.
3. **Never dump `node_modules` or `dist` content.** These are generated artifacts.
4. **Run targeted tests.** Use `bun test tests/core/is-subset.spec.ts` instead of `bun test` when iterating on a specific module.
5. **Use `--no-color` flags** when available to reduce ANSI escape noise in output.
6. **Pipe long outputs through `head` or `tail`.** For example: `bun test 2>&1 | tail -30` to see only failures.
7. **Use `wc -l` to check file size** before reading: `wc -l src/semantic-errors.ts` — if > 100 lines, read only the section you need.

## Repository Structure

```
src/
├── index.ts                          # Public re-exports (entry point)
├── json-schema-compatibility-checker.ts  # Main facade class (JsonSchemaCompatibilityChecker)
├── types.ts                          # Public interfaces: SubsetResult, SchemaError, ResolvedConditionResult, ValidateTargets, ValidateTargetOptions, ConstraintValidator, CheckerOptions
├── merge-engine.ts                   # MergeEngine: allOf merge (intersection) + overlay (deep spread) + conflict detection (wraps @x0k/json-schema-merge)
├── subset-checker.ts                 # Core subset logic: isAtomicSubsetOf, evaluateNot, getBranchesTyped, checkAtomic/Branched, nested branching fallback (hasNestedBranching, isPropertySubsetOf, isObjectSubsetByProperties, tryNestedBranchingFallback)
├── normalizer.ts                     # Schema normalizer: infer type from const/enum, double-negation resolution, constraints canonicalization, recursive normalization
├── condition-resolver.ts             # if/then/else resolution with discriminant data, allOf condition handling, delegates evaluation to runtime-validator
├── runtime-validator.ts              # AJV-based runtime validation: isDataValidForSchema, getRuntimeValidationErrors, getPartialRuntimeValidationErrors, stripRequiredRecursive (singleton AJV instance with LRU + WeakMap caching)
├── constraint-validator.ts           # Custom constraint validation: validateSchemaConstraints (recurses into properties, items, patternProperties, additionalProperties, dependencies)
├── data-narrowing.ts                 # Narrows a schema using runtime data when the target has enum/const constraints
├── semantic-errors.ts                # Human-readable error generation: computeSemanticErrors, comparePropertySchemas, checkCustomConstraints, formatSchemaType (with constraints suffix)
├── format-validator.ts               # Format validation (email, uri, date-time...) + format hierarchy (FORMAT_SUPERSETS)
├── pattern-subset.ts                 # Regex pattern subset via sampling (isPatternSubset, arePatternsEquivalent)
├── formatter.ts                      # formatResult() for debug output
├── validate-targets.ts               # Normalizes `validate` option into per-schema flags (sub/sup enabled + partial mode)
└── utils.ts                          # Shared utilities: deepEqual, isPlainObj, hasOwn, omitKeys, unionStrings, mergeConstraints, toConstraintArray

global.d.ts                           # Module augmentation: extends JSONSchema7 with `constraints?: Constraints`

tests/
├── core/           # Tests for main API methods: isSubset, check, check-connection, intersect, isEqual, normalize, semantic-errors, edge-cases, constraint-validators, runtime-validator-cache
├── features/       # Tests per JSON Schema feature: type-system, const-enum, not, pattern, format, anyOf/oneOf, object-properties, data-narrowing, contains-items, dependencies, property-names, partial-validation
├── conditions/     # Tests for if/then/else resolution, evaluateCondition, resolve-conditions
├── merge-engine/   # Tests for the merge engine: types, keywords, enum-const, advanced merges, overlay (deep spread), merge-constraints
├── bugs/           # Regression tests for specific bug fixes
├── integration/    # Import tests (ESM + CJS) and end-to-end integration
└── audit/          # Tests for unsupported features ($ref) and edge detection

benchmarks/         # Performance benchmarks using mitata (run with `bun run bench`)
scripts/            # postbuild.ts — rewrites import specifiers for dual ESM/CJS output
```

## Architecture & Key Patterns

### Data Flow for `isSubset(sub, sup)`

```
sub, sup → normalize() → getBranchesTyped() → [if branched] per-branch check
                                              → [if atomic]  evaluateNot() + stripNotFromSup()
                                                             + stripPatternFromSup()
                                                             → engine.merge(sub, sup)
                                                             → normalize(merged)
                                                             → deepEqual(merged, sub) → boolean
                                                             → [if false] tryNestedBranchingFallback()
                                                                → hasNestedBranching() guard
                                                                → isObjectSubsetByProperties()
                                                                   → per-property isPropertySubsetOf()
                                                                      → getBranchesTyped() + isAtomicSubsetOf()

With options (runtime mode — returns Promise<ResolvedSubsetResult>):
sub, sup, { data, validate } → resolveValidateTargets(validate)     ← extract sub/sup/partialSub/partialSup flags
                              → resolveConditions(sub, data)          ← uses isDataValidForSchema (AJV)
                              → resolveConditions(sup, data)          ← uses isDataValidForSchema (AJV)
                              → narrowSchemaWithData(resolvedSub, data, resolvedSup)
                              → narrowSchemaWithData(resolvedSup, data, resolvedSub)
                              → checkInternal(narrowedSub, narrowedSup)     ← structural subset check
                              → [if static check fails] return { isSubset: false, errors }
                              → [if validateSub] getRuntimeValidationErrors(narrowedSub, data)
                                                 or getPartialRuntimeValidationErrors(narrowedSub, data) if partialSub
                              → [if validateSup] getRuntimeValidationErrors(narrowedSup, data)
                                                 or getPartialRuntimeValidationErrors(narrowedSup, data) if partialSup
                              → [if validateSub] await validateSchemaConstraints(narrowedSub, data, registry)
                              → [if validateSup] await validateSchemaConstraints(narrowedSup, data, registry)
                              → [if runtime errors] return { isSubset: false, errors }
                              → [if all pass] return { isSubset: true, ... }
```

### Runtime Validator (`runtime-validator.ts`)

Centralizes all AJV-based runtime validation behind a singleton AJV instance (module-level, shared across all checker instances). Four main exports:

| Function | Purpose |
|---|---|
| `isDataValidForSchema(schema, data)` | Boolean validation — used by `condition-resolver.ts` for `if/then/else` evaluation (replaces the former hand-rolled `evaluateCondition` logic) |
| `getRuntimeValidationErrors(schema, data)` | Returns `SchemaError[]` — used by the facade's `check()` runtime path for full data-level validation |
| `getPartialRuntimeValidationErrors(schema, data)` | Returns `SchemaError[]` — like `getRuntimeValidationErrors` but strips `required`, `additionalProperties`, `minItems`, and `minProperties` before AJV compilation so only present values are validated |
| `stripRequiredRecursive(schema)` | Returns a new schema with `required`, `additionalProperties`, `minItems`, and `minProperties` removed recursively (into `properties`, `items`, `oneOf`/`anyOf`/`allOf`, `then`/`else`). Used internally by `getPartialRuntimeValidationErrors`. Copy-on-write — never mutates input. |

Caching strategy: **WeakMap** by schema object reference (primary, zero-cost for repeated calls with same schema instance) + **LRU Map** (bounded to 500 entries) keyed by deterministic `stableStringify` (fallback for structurally identical schemas with different references). Note: `getPartialRuntimeValidationErrors` creates a stripped copy of the schema before compilation — the stripped schema is a new object, so it goes through the LRU string cache path (not the WeakMap). This is acceptable because partial validation is used less frequently than full validation.

### Constraint Validator (`constraint-validator.ts`)

Validates runtime data against the custom `constraints` keyword using a user-provided `ConstraintValidatorRegistry`. Separate from the AJV-based runtime validator (which handles standard JSON Schema keywords) and from `format-validator.ts` (which handles the `format` keyword for static subset checking).

`validateSchemaConstraints(schema, data, registry)` is **async** — it `await`s each constraint validator to support both synchronous and asynchronous validators. It recursively walks into: root-level constraints, `properties`, `patternProperties`, `items` (single + tuple), `additionalProperties` (schema form), `dependencies` (schema form).

Constraint validators (`ConstraintValidator` type) can return either `ConstraintValidationResult` or `Promise<ConstraintValidationResult>`. This allows validators that need I/O (e.g. database uniqueness checks) without requiring the caller to wrap synchronous validators.

### Nested Branching Fallback

The merge engine (`@x0k/json-schema-merge`) cannot distribute `allOf` over `oneOf`/`anyOf` inside object properties or array items. When `merge(sub, sup)` fails (returns `null` or produces a result ≠ sub) and either schema contains `oneOf`/`anyOf` nested inside `properties` or `items`, the subset checker falls back to a **property-by-property comparison** that reuses the existing branching logic on each sub-schema individually.

Four helpers in `subset-checker.ts`:

| Helper | Purpose |
|---|---|
| `hasNestedBranching(schema)` | Cheap guard — detects `oneOf`/`anyOf` inside `properties` or `items`. The fallback only triggers when this returns `true`, so zero overhead on normal schemas. |
| `isPropertySubsetOf(sub, sup, engine)` | Compares a single property sub-schema handling branches on **both** sides. Extracts sub branches and verifies each one against sup via `isAtomicSubsetOf`. |
| `isObjectSubsetByProperties(sub, sup, engine)` | The fallback: checks type compatibility, `required` inclusion, `additionalProperties` constraints, then iterates over each property pair using `isPropertySubsetOf`. Also handles array `items`. |
| `tryNestedBranchingFallback(sub, sup, engine)` | Single entry point that encapsulates the guard + call. Returns `true`/`false`/`null` (`null` = not applicable). Used at every fallback site in `isAtomicSubsetOf` and `checkAtomic`. |

### MergeEngine: Two Operations, Two Semantics

`MergeEngine` exposes two fundamentally different schema-combining operations:

| | `merge` / `mergeOrThrow` | `overlay` |
|---|---|---|
| **Semantics** | `allOf(A, B)` — set **intersection** | `{ ...base, ...override }` — deep **spread** |
| **Commutative?** | ✅ Yes — `merge(A, B) ≡ merge(B, A)` | ❌ No — order matters (last writer wins) |
| **Property conflict** | Keeps the **narrowest** constraint | Keeps the **last writer** |
| **Nested objects** | Intersected recursively (`allOf`) | Deep-spread recursively (`overlay`) |
| **Use case** | Subset checking (`A ⊆ B ⟺ A ∩ B ≡ A`), parallel branch convergence | Sequential pipeline context accumulation |

**`merge(a, b)` / `mergeOrThrow(a, b)`** — Computes `allOf([a, b])`. Returns the schema that satisfies **both** inputs simultaneously. Used internally by the subset checker. Correct for parallel branches converging (the guaranteed type is the intersection).

**`overlay(base, override)`** — Deep spread with last-writer-wins per property. When both base and override define the same property as object-like schemas, `overlay` **recurses** into that property (deep spread). Otherwise the override replaces entirely. `required` arrays are unioned. Object-level keywords (`additionalProperties`, `minProperties`, etc.) use override-wins-if-present semantics. Correct for sequential pipelines where each node overwrites context keys:

```ts
// Sequential pipeline accumulation:
const context = nodeOutputs.reduce((acc, output) =>
  engine.overlay(acc, output), initialSchema);

// Parallel branch convergence:
const converged = engine.merge(pathAContext, pathBContext);
```

### Key Design Decisions — Follow These

1. **Immutability via copy-on-write.** The normalizer uses `ensureCopy()` — never mutate input schemas directly. All functions should treat schemas as immutable. `overlay` returns new objects and never mutates its inputs.
2. **WeakMap caching.** `normalizeCache` in `normalizer.ts` caches results per object reference. Do NOT break this by creating unnecessary copies of schemas before normalizing. The runtime validator uses both a `WeakMap` (primary) and a bounded `LRU Map` (fallback) for compiled AJV validators.
3. **Lazy early-exit patterns.** Every function uses short-circuit returns (identity checks, `deepEqual` before expensive operations). Preserve this pattern.
4. **Ternary results for uncertain operations.** `isPatternSubset()` and `isFormatSubset()` return `true | false | null`. `null` means "cannot determine" — never treat it as `false`.
5. **No `$ref` support.** The library does NOT resolve `$ref`. Do not attempt to add `$ref` resolution without explicit instruction.
6. **Facade pattern.** `JsonSchemaCompatibilityChecker` is a thin orchestrator. Core logic lives in the sub-modules. Add new logic to the appropriate sub-module, not to the facade.
7. **Intersection ≠ Overlay.** Do NOT use `merge`/`mergeOrThrow` for sequential context accumulation — it silently swallows widening overrides (intersection keeps the narrowest). Use `overlay` instead. Do NOT use `overlay` for subset checking — it has no set-theoretic meaning.
8. **Nested branching fallback.** When the merge-based check fails and either schema has `oneOf`/`anyOf` inside `properties` or `items`, the subset checker falls back to property-by-property comparison. This is triggered automatically — no caller intervention needed. The fallback is guarded by `hasNestedBranching()` to avoid overhead on normal schemas.
9. **Singleton AJV instance.** `runtime-validator.ts` uses a module-level AJV singleton shared across all `JsonSchemaCompatibilityChecker` instances. This is intentional for performance (compiled validators are reused). AJV is configured with `strict: false` to tolerate unknown keywords like `constraints`. Do NOT create per-instance AJV — it would break the caching strategy.
10. **Custom constraints are runtime-only.** The `constraints` keyword is **completely ignored** in the static path: `normalize()` strips it from schemas before subset checking, the merge engine does not handle it, and semantic errors never report constraint mismatches. Constraints are only evaluated at runtime via `validateSchemaConstraints()` when `check()` is called with `{ data, validate: true }` and constraint validators are registered. The condition resolver (`mergeBranchInto`) still unions constraints during `if/then/else` resolution so that the resolved schema preserves them for runtime validation. The merge engine and condition resolver share `mergeConstraints` / `toConstraintArray` from `utils.ts`.
11. **`check()` with options is async.** When `check(sub, sup, options)` is called with `CheckRuntimeOptions`, it returns `Promise<ResolvedSubsetResult>` (not a synchronous result). This is because constraint validators can be async (`ConstraintValidator` returns `ConstraintValidationResult | Promise<ConstraintValidationResult>`). The overload without options (`check(sub, sup)`) remains synchronous and returns `SubsetResult`. Callers must `await` the runtime path.
12. **Partial validation mode.** `validate` targets (`sub`/`sup`) accept either `boolean` or `{ partial?: boolean }`. When `partial: true`, the runtime validator calls `stripRequiredRecursive` on the schema before AJV compilation — this removes `required`, `additionalProperties`, `minItems`, and `minProperties` at every level so that AJV only validates values **present** in `data` without penalizing absent properties, extra properties, or truncated arrays/objects. This is for design-time scenarios where only some property values are known (e.g. after filtering template expressions from data). The constraint validator (`validateSchemaConstraints`) already skips absent properties naturally (via its `if (propValue === undefined && !hasOwn(dataObj, key)) continue` guard), so it requires no special handling for partial mode. The `resolveValidateTargets` function in `validate-targets.ts` normalizes the `validate` option into `{ sub, sup, partialSub, partialSup }` booleans consumed by `checkWithOptions`.

## Code Conventions

### TypeScript

- **Strict mode** is enabled (`strict: true`, `noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`).
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax: true`).
- Use `.ts` extensions in import paths (the postbuild script rewrites them to `.js`).
- Prefer `for` loops over `.forEach()` for hot paths (V8 optimization).
- Use `const` by default. Use `let` only when reassignment is needed. Never use `var`.

### Biome Rules

- **Indent**: tabs (not spaces)
- **Quotes**: double quotes for strings
- **Imports**: auto-organized by Biome assist
- **Linter**: recommended rules enabled, `noThenProperty` disabled (JSON Schema uses `then`)
- Run `bun biome check --write --unsafe` to auto-fix before committing.

### Testing Conventions

- Import from `bun:test`: `import { beforeAll, describe, expect, test } from "bun:test";`
- Import types from `json-schema`: `import type { JSONSchema7 } from "json-schema";`
- Import the checker from `../../src` (relative to test file in `tests/<category>/`)
- Use `beforeAll` to instantiate `JsonSchemaCompatibilityChecker` once per file
- Use descriptive test names with mathematical notation: `"A ⊆ B"`, `"strict ⊆ loose"`, `"multipleOf(6) ⊆ multipleOf(3)"`
- Organize tests with `describe()` blocks grouped by feature
- Use section dividers: `// ── Section Name ──────────`

### Example test pattern:

```ts
import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
  checker = new JsonSchemaCompatibilityChecker();
});

describe("featureName", () => {
  test("descriptive name with ⊆ notation", () => {
    const sub: JSONSchema7 = { type: "string", minLength: 3 };
    const sup: JSONSchema7 = { type: "string", minLength: 1 };
    expect(checker.isSubset(sub, sup)).toBe(true);
  });

  // check() with options returns a Promise — use async/await
  test("runtime check with data", async () => {
    const result = await checker.check(sub, sup, {
      data: "hello",
      validate: true,
    });
    expect(result.isSubset).toBe(true);
  });
});
```

### Comment Style

- Module-level header comments use box format: `// ─── Module Name ───────────`
- JSDoc on all public functions with `@param`, `@returns`, `@example` when useful
- Inline comments explain the "why", not the "what"
- Use English in comments; use English for new code comments, If you see french in commentary, you can translate it to English.

## Anti-Patterns to Avoid

1. **Do NOT add runtime dependencies** without explicit approval. Current runtime deps: `@x0k/json-schema-merge`, `ajv`, `ajv-formats`, `class-validator`, `randexp`.
2. **Do NOT use `any` type.** Use `unknown` and narrow with type guards.
3. **Do NOT mutate input parameters.** Always use copy-on-write or return new objects.
4. **Do NOT add `console.log` in library code.** Use `formatResult()` for debug output in tests.
5. **Do NOT break the dual ESM/CJS build.** Avoid CommonJS-only patterns (`require`, `__dirname`). Use `import.meta` only in scripts/benchmarks, never in `src/`.
6. **Do NOT use `JSON.stringify` for schema comparison.** Use `deepEqual()` from `utils.ts`.
7. **Do NOT ignore `null` returns** from `isPatternSubset()` or `isFormatSubset()`. They indicate uncertainty, not failure.
8. **Do NOT nest ternaries.** Use early returns or if/else chains for readability.
9. **Do NOT create circular dependencies** between `src/` modules. The dependency graph flows: `index → facade → subset-checker/condition-resolver/data-narrowing/constraint-validator → merge-engine/normalizer/semantic-errors/runtime-validator → utils`.

## Adding New Features Checklist

1. Identify the correct sub-module (see Architecture section above).
2. Add the implementation with copy-on-write immutability and early-exit patterns.
3. Add unit tests in the appropriate `tests/` subdirectory, following existing conventions.
4. Run `bun check-types && bun biome check --write --unsafe && bun test` — all must pass.
5. If adding a new public API method, export it from `src/index.ts` and add it to `JsonSchemaCompatibilityChecker` if it's a method.
6. Update `src/types.ts` if new public interfaces are needed.

## Known Limitations (Do Not Try to Fix Unless Asked)

- **Cross-keyword constraints**: `exclusiveMinimum` vs `minimum` comparison produces false negatives (structural limitation).
- **`oneOf` exclusivity**: Not verified — treated like `anyOf` for subset purposes.
- **Regex patterns**: Probabilistic sampling (200 samples), not formal proof.
- **`$ref`**: Not supported. Schemas must be pre-dereferenced.
- **`patternProperties`**: Partial support only.
- **`overlay` is property-level only**: `overlay` deep-spreads `properties` of object schemas recursively. It does NOT deep-spread `patternProperties`, `dependencies` (schema form), or `items` — those use override-wins at the keyword level. This matches runtime spread semantics where only named properties are merged key-by-key.
- **Nested branching fallback scope**: The property-by-property fallback for nested `oneOf`/`anyOf` does NOT check object-level keywords like `minProperties`/`maxProperties` — those are rare in practice and are already handled by the merge when branching isn't involved. The fallback covers `properties`, `required`, `additionalProperties`, and array `items`.

## Trust These Instructions

These instructions have been validated against the actual codebase. Trust them and only search the filesystem if information here is incomplete or found to be incorrect.
