import type {
	JSONSchema7,
	JSONSchema7Definition,
	JSONSchema7Type,
} from "json-schema";
import { deepEqual, isPlainObj } from "./utils.ts";

// ─── Data Narrowing ──────────────────────────────────────────────────────────
//
// Narrows a resolved schema using runtime data when the target schema
// contains enum constraints that match the data values.
//
// Use case: when `sub` is `{ type: "string" }` and `sup` is
// `{ type: "string", enum: ["red", "green", "blue"] }`, and
// `subData = "red"`, the sub schema is narrowed to
// `{ type: "string", enum: ["red"] }` so that the subset check succeeds.
//
// Rules:
//   - Only narrows when the target schema has an `enum` (or `const`)
//   - Only narrows when the runtime value is present in the target enum
//   - If the value is NOT in the target enum, the schema is unchanged
//   - If the target has no enum/const, the schema is unchanged
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

// ─── Core Narrowing ──────────────────────────────────────────────────────────

/**
 * Narrows a primitive schema by adding an enum constraint matching the
 * runtime data value, if that value is present in the target schema's enum.
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
	const targetEnum = getTargetEnum(targetSchema);
	if (targetEnum === undefined) return schema;

	// Only narrow if the schema doesn't already have enum/const constraints
	if (Array.isArray(schema.enum) || "const" in schema) return schema;

	// Only narrow if the runtime value matches the target enum
	if (!isValueInEnum(data, targetEnum)) return schema;

	// Narrow: add enum: [data] to the schema
	return { ...schema, enum: [data as JSONSchema7Type] };
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
