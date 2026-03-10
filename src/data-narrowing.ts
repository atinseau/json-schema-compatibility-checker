import type {
	JSONSchema7,
	JSONSchema7Definition,
	JSONSchema7Type,
} from "json-schema";
import { validateFormat } from "./format-validator.ts";
import { deepEqual, isPlainObj } from "./utils.ts";

// ─── Data Narrowing ──────────────────────────────────────────────────────────
//
// Narrows a resolved schema using runtime data when the opposite schema
// contains value constraints that can be materialized safely.
//
// This module is intentionally limited to schema refinement. Full runtime
// validation is handled elsewhere by the AJV-based validation layer used by
// `check(sub, sup, { data })` when concrete data is provided.
//
// Use case: when `sub` is `{ type: "string" }` and `sup` is
// `{ type: "string", enum: ["red", "green", "blue"] }`, and
// `data = "red"`, the sub schema is narrowed to
// `{ type: "string", const: "red" }` so that the subset check succeeds.
//
// Rules:
//   - Narrows when the target schema has an `enum` (or `const`) and the runtime
//     value matches one of the allowed values
//   - Materializes the runtime value as `const` when the source schema already
//     declares `enum`/`const` and the runtime value is compatible with it
//   - Preserves the schema unchanged when the runtime value is incompatible
//     with the source or target constraints
//   - Keeps lightweight compatibility checks such as `format` to avoid
//     narrowing with obviously invalid values
//   - Recurses into object properties for complex schemas

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Checks if a value is present in an enum array using deep equality.
 */
function isValueInEnum(
	value: unknown,
	enumValues: JSONSchema7["enum"],
): boolean {
	if (!Array.isArray(enumValues)) return false;
	return enumValues.some((v) => deepEqual(v, value));
}

/**
 * Extracts the effective enum values from a schema.
 * Handles both `enum` and `const` keywords.
 * Returns undefined if the schema has no enum constraint.
 */
function getTargetEnum(schema: JSONSchema7): JSONSchema7Type[] | undefined {
	if (Array.isArray(schema.enum)) return schema.enum;
	if ("const" in schema) return [schema.const as JSONSchema7Type];
	return undefined;
}

/**
 * Checks whether a runtime value satisfies the schema's own enum/const
 * constraints, when present.
 */
function matchesOwnValueConstraint(
	schema: JSONSchema7,
	data: unknown,
): boolean {
	if (Array.isArray(schema.enum)) {
		return isValueInEnum(data, schema.enum);
	}

	if ("const" in schema) {
		return deepEqual(schema.const, data);
	}

	return true;
}

/**
 * Checks whether a runtime value satisfies the schema's own format constraint,
 * when present.
 */
function matchesOwnFormatConstraint(
	schema: JSONSchema7,
	data: unknown,
): boolean {
	if (schema.format === undefined) return true;

	const formatResult = validateFormat(data, schema.format);
	return formatResult !== false;
}

// ─── Core Narrowing ──────────────────────────────────────────────────────────

/**
 * Narrows a primitive schema by materializing the runtime value when it is
 * compatible with both the source schema and the target schema constraints.
 *
 * @param schema - The resolved schema to potentially narrow
 * @param data - The runtime data value
 * @param targetSchema - The opposite schema containing potential enum constraints
 * @returns The narrowed schema (new object) or the original if no narrowing occurred
 */
function narrowPrimitive(
	schema: JSONSchema7,
	data: unknown,
	targetSchema: JSONSchema7,
): JSONSchema7 {
	if (!matchesOwnValueConstraint(schema, data)) return schema;
	if (!matchesOwnFormatConstraint(schema, data)) return schema;

	const targetEnum = getTargetEnum(targetSchema);

	if (targetEnum !== undefined) {
		if (!isValueInEnum(data, targetEnum)) return schema;
		return { ...schema, const: data as JSONSchema7Type };
	}

	if (Array.isArray(schema.enum) || "const" in schema) {
		return { ...schema, const: data as JSONSchema7Type };
	}

	return schema;
}

/**
 * Narrows object properties recursively by matching runtime data values
 * against the target schema's property enum constraints.
 *
 * @param schema - The resolved object schema to potentially narrow
 * @param data - The runtime data (must be a plain object)
 * @param targetSchema - The opposite schema containing potential enum constraints
 * @returns The narrowed schema (new object) or the original if no narrowing occurred
 */
function narrowObjectProperties(
	schema: JSONSchema7,
	data: Record<string, unknown>,
	targetSchema: JSONSchema7,
): JSONSchema7 {
	if (!isPlainObj(schema.properties)) return schema;
	if (!isPlainObj(targetSchema.properties)) return schema;

	const props = schema.properties as Record<string, JSONSchema7Definition>;
	const targetProps = targetSchema.properties as Record<
		string,
		JSONSchema7Definition
	>;

	let changed = false;
	const narrowedProps: Record<string, JSONSchema7Definition> = {};

	for (const key of Object.keys(props)) {
		const propDef = props[key];
		if (propDef === undefined) continue;

		// Skip boolean schemas — they can't be narrowed
		if (typeof propDef === "boolean") {
			narrowedProps[key] = propDef;
			continue;
		}

		const targetPropDef = targetProps[key];
		const propData = data[key];

		// No matching target property or no runtime data for this key — skip
		if (
			targetPropDef === undefined ||
			typeof targetPropDef === "boolean" ||
			propData === undefined
		) {
			narrowedProps[key] = propDef;
			continue;
		}

		// Recursively narrow this property
		const narrowed = narrowSchemaWithData(propDef, propData, targetPropDef);

		if (narrowed !== propDef) {
			changed = true;
		}
		narrowedProps[key] = narrowed;
	}

	if (!changed) return schema;
	return { ...schema, properties: narrowedProps };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Narrows a schema using runtime data when the target schema has enum
 * constraints that match the data values.
 *
 * This enables runtime-aware subset checking: when a schema is generic
 * (e.g. `{ type: "string" }`) but the actual runtime value matches an
 * enum constraint in the target schema, the source schema is narrowed
 * to reflect the concrete value.
 *
 * Important: this function does not perform full runtime validation.
 * Runtime validation of `data` against resolved schemas is handled separately
 * by the AJV-based validation layer. This helper only performs safe refinement.
 *
 * @param schema - The resolved source schema to potentially narrow
 * @param data - The runtime data value (primitive or object)
 * @param targetSchema - The target schema containing potential enum constraints
 * @returns The narrowed schema or the original if no narrowing applies
 *
 * @example
 * ```ts
 * // Primitive narrowing
 * const sub = { type: "string" };
 * const sup = { type: "string", enum: ["red", "green", "blue"] };
 * narrowSchemaWithData(sub, "red", sup);
 * // → { type: "string", enum: ["red"] }
 *
 * // Object property narrowing
 * const sub = { type: "object", properties: { color: { type: "string" } } };
 * const sup = { type: "object", properties: { color: { type: "string", enum: ["red", "green"] } } };
 * narrowSchemaWithData(sub, { color: "red" }, sup);
 * // → { type: "object", properties: { color: { type: "string", enum: ["red"] } } }
 * ```
 */
export function narrowSchemaWithData(
	schema: JSONSchema7,
	data: unknown,
	targetSchema: JSONSchema7,
): JSONSchema7 {
	// Fast path: if schemas are identical or data is undefined/null, no narrowing
	if (schema === targetSchema || data === undefined || data === null) {
		return schema;
	}

	// Object case: recurse into properties
	if (isPlainObj(data) && schema.type === "object") {
		return narrowObjectProperties(schema, data, targetSchema);
	}

	// Primitive case: try to narrow with enum from target
	if (!isPlainObj(data)) {
		return narrowPrimitive(schema, data, targetSchema);
	}

	return schema;
}
