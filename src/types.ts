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

export interface SchemaError {
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
 * Options for runtime-aware subset checking.
 *
 * When `data` is provided, the checker:
 *   1. Resolves `if/then/else` conditions in both `sub` and `sup` using `data`
 *      (if `data` is `undefined`, conditions are resolved with `{}`)
 *   2. Narrows schemas using runtime values (e.g. enum materialization)
 *   3. Performs the static subset check on the resolved/narrowed schemas
 *
 * When `validate` is `true`, two additional runtime steps run **after** the
 * static check passes:
 *   4. `data` is validated against both resolved schemas via AJV
 *   5. Custom constraints are validated against `data`
 *
 * `data` can be a partial discriminant (e.g. `{ kind: "text" }`) used solely
 * for condition resolution and narrowing. It does **not** need to be a complete
 * instance of the schemas unless `validate: true` is set.
 */
export interface CheckRuntimeOptions {
	/** Runtime data used for condition resolution, narrowing, and optionally runtime validation */
	data: unknown;

	/**
	 * When `true`, enables runtime validation of `data` against both resolved
	 * schemas via AJV, and custom constraint validation if a registry was
	 * provided at construction time.
	 *
	 * When `false` or omitted (default), `data` is used only for condition
	 * resolution (`if/then/else`) and schema narrowing — no AJV validation
	 * or constraint validation is performed.
	 *
	 * @default false
	 */
	validate?: boolean;
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
 * Receives the value to validate and optional params defined
 * in the schema's constraint definition.
 *
 * Must be synchronous — async validation is out of scope
 * for this library. Wrap async checks in your application layer.
 *
 * @param value - The runtime value to validate
 * @param params - The `params` object from the constraint definition, if any
 * @returns The validation result
 *
 * @example
 * ```ts
 * const isUuid: ConstraintValidator = (value) => ({
 *   valid: typeof value === "string" && /^[0-9a-f]{8}-/.test(value),
 *   message: "Value must be a valid UUID",
 * });
 *
 * const minAge: ConstraintValidator = (value, params) => ({
 *   valid: typeof value === "number" && value >= (params?.min ?? 0),
 *   message: `Value must be at least ${params?.min}`,
 * });
 * ```
 */
export type ConstraintValidator = (
	value: unknown,
	params?: Record<string, unknown>,
) => ConstraintValidationResult;

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
