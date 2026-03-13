import type { JSONSchema7Definition } from "json-schema";
import type {
	Constraint,
	ConstraintValidatorRegistry,
	SchemaError,
} from "./types.ts";
import { SchemaErrorType } from "./types.ts";
import { hasOwn, isPlainObj, toConstraintArray } from "./utils.ts";

// ─── Constraint Validator ────────────────────────────────────────────────────
//
// Validates runtime data against custom `constraints` found in a schema,
// using the provided validator registry.
//
// This module is separate from `runtime-validator.ts` (which wraps AJV)
// and from `format-validator.ts` (which handles the `format` keyword).

/**
 * Validates a single value against a list of constraints using the registry.
 *
 * @param constraints - The constraints to validate against
 * @param value - The runtime value
 * @param registry - The constraint validator registry
 * @param path - The property path for error reporting
 * @returns Array of errors (empty if all constraints pass)
 */
async function validateValue(
	constraints: Constraint[],
	value: unknown,
	registry: ConstraintValidatorRegistry,
	path: string,
): Promise<SchemaError[]> {
	const errors: SchemaError[] = [];

	for (const constraint of constraints) {
		const name = typeof constraint === "string" ? constraint : constraint.name;
		const params =
			typeof constraint === "string" ? undefined : constraint.params;

		const validator = registry[name];

		if (!validator) {
			errors.push({
				type: SchemaErrorType.CustomConstraint,
				key: path || "$root",
				expected: name,
				received: "unknown constraint (not registered)",
			});
			continue;
		}

		try {
			const result = await validator(value, params);
			if (!result.valid) {
				errors.push({
					type: SchemaErrorType.CustomConstraint,
					key: path || "$root",
					expected: name,
					received: result.message ?? "constraint validation failed",
				});
			}
		} catch (err) {
			errors.push({
				type: SchemaErrorType.CustomConstraint,
				key: path || "$root",
				expected: name,
				received:
					err instanceof Error ? err.message : "constraint validation error",
			});
		}
	}

	return errors;
}

/**
 * Recursively validates runtime data against all `constraints` found
 * in a schema, using the provided validator registry.
 *
 * Walks into: root-level constraints, `properties`, `patternProperties`,
 * `items` (single schema and tuple form), `additionalProperties` (schema form),
 * `dependencies` (schema form).
 *
 * When a schema declares a constraint that is not present in the registry,
 * an "unknown constraint (not registered)" error is produced. This ensures
 * that unregistered constraints are never silently ignored at runtime.
 *
 * @param schema - The resolved/narrowed schema containing constraints
 * @param data - The runtime data to validate
 * @param registry - The constraint validator registry (may be empty)
 * @param path - The current property path (for error reporting)
 * @returns Array of schema errors (empty if all constraints pass)
 */
export async function validateSchemaConstraints(
	schema: JSONSchema7Definition,
	data: unknown,
	registry: ConstraintValidatorRegistry,
	path = "",
): Promise<SchemaError[]> {
	// Boolean schemas → nothing to validate
	if (typeof schema === "boolean") return [];

	const errors: SchemaError[] = [];

	// ── Root-level constraints ──
	const constraints = toConstraintArray(schema.constraints);
	if (constraints.length > 0) {
		errors.push(...(await validateValue(constraints, data, registry, path)));
	}

	// ── Recurse into properties ──
	if (isPlainObj(schema.properties) && isPlainObj(data)) {
		const props = schema.properties as Record<string, JSONSchema7Definition>;
		const dataObj = data as Record<string, unknown>;

		for (const key of Object.keys(props)) {
			const propSchema = props[key];
			if (propSchema === undefined) continue;

			const propValue = dataObj[key];
			// Only validate if the property exists in the data
			if (propValue === undefined && !hasOwn(dataObj, key)) continue;

			const propPath = path ? `${path}.${key}` : key;
			errors.push(
				...(await validateSchemaConstraints(
					propSchema,
					propValue,
					registry,
					propPath,
				)),
			);
		}
	}

	// ── Recurse into items (single schema) ──
	if (isPlainObj(schema.items) && Array.isArray(data)) {
		const itemSchema = schema.items as JSONSchema7Definition;
		const itemPath = path ? `${path}[]` : "[]";

		for (let i = 0; i < data.length; i++) {
			errors.push(
				...(await validateSchemaConstraints(
					itemSchema,
					data[i],
					registry,
					itemPath,
				)),
			);
		}
	}

	// ── Recurse into tuple items ──
	if (Array.isArray(schema.items) && Array.isArray(data)) {
		const tupleSchemas = schema.items as JSONSchema7Definition[];
		for (let i = 0; i < tupleSchemas.length && i < data.length; i++) {
			const itemSchema = tupleSchemas[i];
			if (itemSchema === undefined) continue;
			const itemPath = path ? `${path}[${i}]` : `[${i}]`;
			errors.push(
				...(await validateSchemaConstraints(
					itemSchema,
					data[i],
					registry,
					itemPath,
				)),
			);
		}
	}

	// ── Recurse into patternProperties ──
	if (isPlainObj(schema.patternProperties) && isPlainObj(data)) {
		const pp = schema.patternProperties as Record<
			string,
			JSONSchema7Definition
		>;
		const dataObj = data as Record<string, unknown>;

		for (const pattern of Object.keys(pp)) {
			const patternSchema = pp[pattern];
			if (patternSchema === undefined || typeof patternSchema === "boolean")
				continue;

			let regex: RegExp;
			try {
				regex = new RegExp(pattern);
			} catch {
				// Invalid regex pattern — skip silently (same approach as AJV)
				continue;
			}

			for (const dataKey of Object.keys(dataObj)) {
				if (!regex.test(dataKey)) continue;

				const dataValue = dataObj[dataKey];
				const ppPath = path ? `${path}.${dataKey}` : dataKey;
				errors.push(
					...(await validateSchemaConstraints(
						patternSchema,
						dataValue,
						registry,
						ppPath,
					)),
				);
			}
		}
	}

	// ── Recurse into additionalProperties (schema form) ──
	if (
		isPlainObj(schema.additionalProperties) &&
		typeof schema.additionalProperties !== "boolean" &&
		isPlainObj(data)
	) {
		const apSchema = schema.additionalProperties as JSONSchema7Definition;
		const dataObj = data as Record<string, unknown>;
		const definedProps = isPlainObj(schema.properties)
			? new Set(Object.keys(schema.properties as Record<string, unknown>))
			: new Set<string>();

		// Collect patternProperties regexes to exclude matching keys
		const ppPatterns: RegExp[] = [];
		if (isPlainObj(schema.patternProperties)) {
			for (const pattern of Object.keys(
				schema.patternProperties as Record<string, unknown>,
			)) {
				try {
					ppPatterns.push(new RegExp(pattern));
				} catch {
					// Invalid pattern — skip
				}
			}
		}

		for (const dataKey of Object.keys(dataObj)) {
			// Skip keys defined in properties
			if (definedProps.has(dataKey)) continue;

			// Skip keys matching any patternProperties pattern
			if (ppPatterns.some((re) => re.test(dataKey))) continue;

			const dataValue = dataObj[dataKey];
			const apPath = path ? `${path}.${dataKey}` : dataKey;
			errors.push(
				...(await validateSchemaConstraints(
					apSchema,
					dataValue,
					registry,
					apPath,
				)),
			);
		}
	}

	// ── Recurse into dependencies (schema form) ──
	if (isPlainObj(schema.dependencies) && isPlainObj(data)) {
		const deps = schema.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const dataObj = data as Record<string, unknown>;

		for (const depKey of Object.keys(deps)) {
			// Dependency only applies if the trigger key is present in data
			if (!hasOwn(dataObj, depKey)) continue;

			const depValue = deps[depKey];
			if (depValue === undefined) continue;

			// Skip array-form dependencies (property deps, not schema deps)
			if (Array.isArray(depValue)) continue;

			// Skip boolean schemas
			if (typeof depValue === "boolean") continue;

			// Schema-form dependency: validate the entire data object against it
			// The dependency schema applies to the whole object, not just the dep key
			errors.push(
				...(await validateSchemaConstraints(depValue, data, registry, path)),
			);
		}
	}

	return errors;
}
