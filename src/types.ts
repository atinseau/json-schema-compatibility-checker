import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

// ─── Module augmentation ─────────────────────────────────────────────────────
// Extends JSONSchema7 with the custom `constraints` keyword so that consumers
// of this package see the property on every JSONSchema7 without needing a
// separate ambient file or `/// <reference>` directive.

declare module "json-schema" {
	interface JSONSchema7 {
		constraints?: Constraints;
	}
}

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Discriminant for `SchemaError` — indicates the nature of the incompatibility.
 *
 * | Member                 | Description                                                        | Source module(s)           |
 * |------------------------|--------------------------------------------------------------------|---------------------------|
 * | `TypeMismatch`         | Incompatible types (e.g. `string` vs `number`, boolean schemas)    | `semantic-errors.ts`       |
 * | `MissingProperty`      | Required property absent from the source schema                    | `semantic-errors.ts`       |
 * | `Optionality`          | Property required in target but optional in source                 | `semantic-errors.ts`       |
 * | `EnumMismatch`         | `enum` / `const` values are incompatible                           | `semantic-errors.ts`       |
 * | `NumericConstraint`    | `minimum`, `maximum`, `exclusiveMin/Max`, `multipleOf`             | `semantic-errors.ts`       |
 * | `StringConstraint`     | `minLength`, `maxLength`, `pattern`, `format`                      | `semantic-errors.ts`       |
 * | `ObjectConstraint`     | `additionalProperties`, `min/maxProperties`, `propertyNames`, etc. | `semantic-errors.ts`       |
 * | `ArrayConstraint`      | `minItems`, `maxItems`, `uniqueItems`, `contains`                  | `semantic-errors.ts`       |
 * | `NotSchema`            | Incompatibility on the `not` keyword                               | `semantic-errors.ts`       |
 * | `BranchMismatch`       | No `anyOf` / `oneOf` branch matches                                | `semantic-errors.ts`       |
 * | `RuntimeValidation`    | Runtime data invalid against a standard JSON Schema keyword (AJV)  | `runtime-validator.ts`     |
 * | `CustomConstraint`     | Custom constraint failed, unknown, or threw                        | `constraint-validator.ts`  |
 */
export enum SchemaErrorType {
	TypeMismatch = "type_mismatch",
	MissingProperty = "missing_property",
	Optionality = "optionality",
	EnumMismatch = "enum_mismatch",
	NumericConstraint = "numeric_constraint",
	StringConstraint = "string_constraint",
	ObjectConstraint = "object_constraint",
	ArrayConstraint = "array_constraint",
	NotSchema = "not_schema",
	BranchMismatch = "branch_mismatch",
	RuntimeValidation = "runtime_validation",
	CustomConstraint = "custom_constraint",
}

export interface SchemaError {
	/** Discriminant indicating the nature of the error */
	type: SchemaErrorType;
	/** Normalized path to the concerned property (e.g. "user.name", "users[].name", "accountId") */
	key: string;
	/** Type or value expected by the target schema (sup) */
	expected: string;
	/** Type or value received from the source schema (sub) */
	received: string;
}

export interface SubsetResult {
	/** true if sub ⊆ sup (every value valid for sub is also valid for sup) */
	isSubset: boolean;
	/** The schema resulting from the intersection allOf(sub, sup), or null if incompatible */
	merged: JSONSchema7Definition | null;
	/** Semantic errors describing incompatibilities between the two schemas */
	errors: SchemaError[];
}

/**
 * Per-target validation options.
 *
 * When `partial` is `true`, runtime validation strips `required` and
 * `additionalProperties` constraints at every level of the schema before
 * passing it to AJV. This allows validating **only the properties present
 * in `data`** without false negatives on missing required properties or
 * extra properties not defined in the schema.
 *
 * Partial mode applies recursively: nested object schemas also have their
 * `required` and `additionalProperties` stripped.
 *
 * @example
 * ```ts
 * // Validate sup in partial mode — only check properties present in data
 * checker.check(sub, sup, {
 *   data: { accountId: 'salut' },
 *   validate: { sup: { partial: true } },
 * });
 * ```
 */
export interface ValidateTargetOptions {
	/**
	 * When `true`, strip `required` and `additionalProperties` from the
	 * schema before AJV validation so that only properties present in
	 * `data` are validated.
	 *
	 * @default false
	 */
	partial?: boolean;
}

/**
 * Granular control over which schema(s) runtime validation applies to.
 *
 * When provided as an object, each key independently controls whether
 * runtime validation (AJV + custom constraints) runs against that schema:
 *   - `sub`: validate `data` against the resolved/narrowed sub schema
 *   - `sup`: validate `data` against the resolved/narrowed sup schema
 *
 * Each target accepts either a boolean or a `ValidateTargetOptions` object.
 * When `true`, validation runs with default options. When an object is
 * provided, its flags (e.g. `partial`) customize the validation behavior.
 *
 * Omitted keys default to `false`.
 *
 * @example
 * ```ts
 * // Validate only the sup schema (e.g. target input with constraints)
 * checker.check(sub, sup, { data: {}, validate: { sup: true } });
 *
 * // Validate only the sub schema
 * checker.check(sub, sup, { data: {}, validate: { sub: true } });
 *
 * // Validate both (equivalent to `validate: true`)
 * checker.check(sub, sup, { data: {}, validate: { sub: true, sup: true } });
 *
 * // Validate sup in partial mode (skip required / additionalProperties)
 * checker.check(sub, sup, {
 *   data: { accountId: 'salut' },
 *   validate: { sup: { partial: true } },
 * });
 * ```
 */
export interface ValidateTargets {
	/** When `true` or an options object, validate `data` against the resolved sub schema */
	sub?: boolean | ValidateTargetOptions;
	/** When `true` or an options object, validate `data` against the resolved sup schema */
	sup?: boolean | ValidateTargetOptions;
}

/**
 * Options for runtime-aware subset checking.
 *
 * When `data` is provided, the checker:
 *   1. Resolves `if/then/else` conditions in both `sub` and `sup` using `data`
 *      (if `data` is `undefined`, conditions are resolved with `{}`)
 *   2. Narrows schemas using runtime values (e.g. enum materialization)
 *   3. Performs the static subset check on the resolved/narrowed schemas
 *
 * When `validate` is `true` (or an object with `sub`/`sup` flags), additional
 * runtime steps run **after** the static check passes:
 *   4. `data` is validated against the targeted resolved schema(s) via AJV
 *   5. Custom constraints are validated against `data` for the targeted schema(s)
 *
 * `data` can be a partial discriminant (e.g. `{ kind: "text" }`) used solely
 * for condition resolution and narrowing. It does **not** need to be a complete
 * instance of the schemas unless runtime validation is enabled.
 */
export interface CheckRuntimeOptions {
	/** Runtime data used for condition resolution, narrowing, and optionally runtime validation */
	data: unknown;

	/**
	 * Controls runtime validation of `data` against resolved schemas.
	 *
	 * - `true` — validate against **both** sub and sup schemas (AJV + constraints)
	 * - `false` / omitted — no runtime validation (data used only for condition
	 *   resolution and narrowing)
	 * - `{ sub: true }` — validate only against the sub schema
	 * - `{ sup: true }` — validate only against the sup schema
	 * - `{ sub: true, sup: true }` — equivalent to `true`
	 * - `{ sup: { partial: true } }` — validate sup in partial mode
	 *   (skip `required` / `additionalProperties` enforcement)
	 *
	 * @default false
	 */
	validate?: boolean | ValidateTargets;

	/**
	 * Arbitrary context forwarded to every constraint validator during
	 * this `check()` call.
	 *
	 * Useful for passing per-request state (e.g. tenant ID, user scope)
	 * that is not encoded in the schema but is needed by validators at runtime.
	 *
	 * @example
	 * ```ts
	 * checker.check(sub, sup, {
	 *   data: { accountId: '123' },
	 *   validate: { sup: { partial: true } },
	 *   constraintContext: { companyId: 42 },
	 * });
	 * ```
	 */
	constraintContext?: ConstraintExecutionContext;
}

/**
 * Extended result from `check()` when runtime options are provided.
 * Includes resolution results for sub and sup in addition to the SubsetResult.
 */
export interface ResolvedSubsetResult extends SubsetResult {
	resolvedSub: ResolvedConditionResult;
	resolvedSup: ResolvedConditionResult;
}

export interface ResolvedConditionResult {
	/** The schema with if/then/else resolved (flattened) */
	resolved: JSONSchema7;
	/** The branch that was applied ("then" | "else" | null if no condition) */
	branch: "then" | "else" | null;
	/** The discriminant used for resolution */
	discriminant: Record<string, unknown>;
}

export type Constraint =
	| string
	| {
			name: string;
			params?: Record<string, unknown>;
	  };

export type Constraints = Constraint | Constraint[];

// ─── Constraint Validator types ──────────────────────────────────────────────

/**
 * Arbitrary per-call context forwarded to every constraint validator
 * during a `check()` invocation.
 *
 * Allows callers to pass request-scoped information (e.g. tenant ID,
 * user ID, feature flags) that is not part of the schema definition
 * but is required by constraint validators at runtime.
 */
export type ConstraintExecutionContext = Record<string, unknown>;

/**
 * Result of a constraint validation.
 */
export interface ConstraintValidationResult {
	/** Whether the value satisfies the constraint */
	valid: boolean;
	/** Human-readable message when `valid` is `false` */
	message?: string;
}

/**
 * A constraint validator function.
 *
 * Receives the value to validate, optional params defined in the schema's
 * constraint definition, and an optional per-call execution context.
 *
 * Can be synchronous or asynchronous. When async validators are used,
 * `check()` with runtime options returns a `Promise`.
 *
 * @param value - The runtime value to validate
 * @param params - The `params` object from the constraint definition, if any
 * @param context - The per-call execution context passed via `constraintContext`, if any
 * @returns The validation result, or a Promise resolving to it
 *
 * @example
 * ```ts
 * // Synchronous validator
 * const isUuid: ConstraintValidator = (value) => ({
 *   valid: typeof value === "string" && /^[0-9a-f]{8}-/.test(value),
 *   message: "Value must be a valid UUID",
 * });
 *
 * // Async validator
 * const isUniqueEmail: ConstraintValidator = async (value) => ({
 *   valid: await checkEmailUniqueness(value as string),
 *   message: "Email must be unique",
 * });
 *
 * const minAge: ConstraintValidator = (value, params) => ({
 *   valid: typeof value === "number" && value >= (params?.min ?? 0),
 *   message: `Value must be at least ${params?.min}`,
 * });
 *
 * // Validator using execution context (e.g. tenant-scoped DB lookup)
 * const isUniqueInTenant: ConstraintValidator = async (value, params, context) => ({
 *   valid: await checkUniqueness(value as string, context?.companyId as number),
 *   message: "Value must be unique within the tenant",
 * });
 * ```
 */
export type ConstraintValidator = (
	value: unknown,
	params?: Record<string, unknown>,
	context?: ConstraintExecutionContext,
) => ConstraintValidationResult | Promise<ConstraintValidationResult>;

/**
 * Registry mapping constraint names to their validator functions.
 *
 * Keys are constraint names as they appear in schema definitions
 * (e.g. `"IsUuid"`, `"MinAge"`).
 */
export type ConstraintValidatorRegistry = Record<string, ConstraintValidator>;

/**
 * Options for the JsonSchemaCompatibilityChecker constructor.
 */
export interface CheckerOptions {
	/**
	 * Registry of custom constraint validators.
	 *
	 * When provided, the checker can validate runtime data against
	 * custom constraints defined in schemas via the `constraints` keyword.
	 *
	 * Constraint names must match those used in schema definitions.
	 * Unknown constraints (present in a schema but absent from the registry)
	 * will be reported as errors during runtime validation.
	 */
	constraints?: ConstraintValidatorRegistry;
}
