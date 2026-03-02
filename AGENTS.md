# AGENTS.md

## Project Overview

**json-schema-compatibility-checker** is a TypeScript library that checks compatibility between two JSON Schemas (Draft-07) using set-theoretic principles. The core idea: `A ⊆ B ⟺ A ∩ B ≡ A` — a schema A is a subset of B if their intersection (via `allOf` merge) equals A structurally.

- **Runtime**: Bun (test runner, script runner, package manager)
- **Language**: TypeScript (strict mode, ESNext target)
- **Linter/Formatter**: Biome (tabs, double quotes, recommended rules)
- **Build**: SWC (ESM + CJS dual output) + tsc (declaration files only)
- **Tests**: Bun's built-in test runner (`bun:test`)
- **Dependencies**: `@x0k/json-schema-merge` (merge engine), `class-validator` (format validation), `randexp` (pattern sampling)

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
├── types.ts                          # Public interfaces: SubsetResult, SchemaError, ResolvedConditionResult
├── merge-engine.ts                   # MergeEngine: allOf merge + conflict detection (wraps @x0k/json-schema-merge)
├── subset-checker.ts                 # Core subset logic: isAtomicSubsetOf, evaluateNot, getBranchesTyped, checkAtomic/Branched
├── normalizer.ts                     # Schema normalizer: infer type from const/enum, double-negation resolution, recursive normalization
├── condition-resolver.ts             # if/then/else resolution with discriminant data, allOf condition handling
├── semantic-errors.ts                # Human-readable error generation: computeSemanticErrors, comparePropertySchemas
├── format-validator.ts               # Format validation (email, uri, date-time...) + format hierarchy (FORMAT_SUPERSETS)
├── pattern-subset.ts                 # Regex pattern subset via sampling (isPatternSubset, arePatternsEquivalent)
├── formatter.ts                      # formatResult() for debug output
└── utils.ts                          # Shared utilities: deepEqual, isPlainObj, hasOwn, omitKeys, unionStrings

tests/
├── core/           # Tests for main API methods: isSubset, check, intersect, isEqual, normalize, semantic-errors, edge-cases
├── features/       # Tests per JSON Schema feature: type-system, const-enum, not, pattern, format, anyOf/oneOf, object-properties, etc.
├── conditions/     # Tests for if/then/else resolution, evaluateCondition, checkResolved
├── merge-engine/   # Tests for the merge engine: types, keywords, enum-const, advanced merges
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
                                              → [if atomic]  evaluateNot() + stripPatternFromSup()
                                                             → engine.merge(sub, sup)
                                                             → normalize(merged)
                                                             → deepEqual(merged, sub) → boolean
```

### Key Design Decisions — Follow These

1. **Immutability via copy-on-write.** The normalizer uses `ensureCopy()` — never mutate input schemas directly. All functions should treat schemas as immutable.
2. **WeakMap caching.** `normalizeCache` in `normalizer.ts` caches results per object reference. Do NOT break this by creating unnecessary copies of schemas before normalizing.
3. **Lazy early-exit patterns.** Every function uses short-circuit returns (identity checks, `deepEqual` before expensive operations). Preserve this pattern.
4. **Ternary results for uncertain operations.** `isPatternSubset()` and `isFormatSubset()` return `true | false | null`. `null` means "cannot determine" — never treat it as `false`.
5. **No `$ref` support.** The library does NOT resolve `$ref`. Do not attempt to add `$ref` resolution without explicit instruction.
6. **Facade pattern.** `JsonSchemaCompatibilityChecker` is a thin orchestrator. Core logic lives in the sub-modules. Add new logic to the appropriate sub-module, not to the facade.

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
});
```

### Comment Style

- Module-level header comments use box format: `// ─── Module Name ───────────`
- JSDoc on all public functions with `@param`, `@returns`, `@example` when useful
- Inline comments explain the "why", not the "what"
- Use English in comments; use English for new code comments, If you see french in commentary, you can translate it to English.

## Anti-Patterns to Avoid

1. **Do NOT add runtime dependencies** without explicit approval. The library is intentionally lightweight.
2. **Do NOT use `any` type.** Use `unknown` and narrow with type guards.
3. **Do NOT mutate input parameters.** Always use copy-on-write or return new objects.
4. **Do NOT add `console.log` in library code.** Use `formatResult()` for debug output in tests.
5. **Do NOT break the dual ESM/CJS build.** Avoid CommonJS-only patterns (`require`, `__dirname`). Use `import.meta` only in scripts/benchmarks, never in `src/`.
6. **Do NOT use `JSON.stringify` for schema comparison.** Use `deepEqual()` from `utils.ts`.
7. **Do NOT ignore `null` returns** from `isPatternSubset()` or `isFormatSubset()`. They indicate uncertainty, not failure.
8. **Do NOT nest ternaries.** Use early returns or if/else chains for readability.
9. **Do NOT create circular dependencies** between `src/` modules. The dependency graph flows: `index → facade → subset-checker → merge-engine/normalizer/semantic-errors → utils`.

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

## Trust These Instructions

These instructions have been validated against the actual codebase. Trust them and only search the filesystem if information here is incomplete or found to be incorrect.
