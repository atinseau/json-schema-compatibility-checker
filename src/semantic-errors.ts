import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { SchemaError } from "./types.ts";
import { SchemaErrorType } from "./types.ts";
import { deepEqual, hasOwn, isPlainObj } from "./utils.ts";

// ─── Semantic Error Generator ────────────────────────────────────────────────
//
// Generates human-readable semantic errors by directly comparing two schemas.
//
// Unlike a structural differ (which would compare sub vs merged), this module
// directly compares sub (source/received) and sup (target/expected) to produce
// business-oriented error messages.
//
// Property paths are normalized:
//   - `accountId`       (top-level property)
//   - `user.name`       (nested property)
//   - `users[].name`    (property inside array items)
//
// Convention:
//   - `expected` = what the target schema (sup) expects
//   - `received` = what the source schema (sub) provides

// ─── Type Formatting ─────────────────────────────────────────────────────────

/**
 * Formats enum values into a readable string.
 *
 * Examples:
 *   - 1 value  : `"123"`
 *   - 2 values : `"123 or hello"`
 *   - 3 values : `"10, 20, or 30"`
 */
function formatEnumValues(values: unknown[]): string {
	const parts = values.map((v) =>
		typeof v === "string" ? v : JSON.stringify(v),
	);
	if (parts.length === 0) return "never";
	if (parts.length === 1) return parts[0] as string;
	if (parts.length === 2) return `${parts[0]} or ${parts[1]}`;
	const last = parts.pop();
	return `${parts.join(", ")}, or ${last}`;
}

/**
 * Formats a schema into a readable type representation.
 *
 * Examples:
 *   - `{ type: "string" }`                                    → `"string"`
 *   - `{ type: "array", items: { type: "string" } }`          → `"string[]"`
 *   - `{ type: "array", items: { type: ["string","number"] }` → `"string[] | number[]"`
 *   - `{ enum: [1, 2, 3] }`                                   → `"1, 2, or 3"`
 *   - `{ const: "hello" }`                                    → `"hello"`
 *   - `{ anyOf: [{type:"string"},{type:"number"}] }`          → `"string | number"`
 *   - `undefined`                                              → `"undefined"`
 */
export function formatSchemaType(
	def: JSONSchema7Definition | undefined,
): string {
	return formatSchemaTypeInternal(def);
}

function formatSchemaTypeInternal(
	def: JSONSchema7Definition | undefined,
): string {
	if (def === undefined) return "undefined";
	if (typeof def === "boolean") return def ? "any" : "never";

	const schema = def as JSONSchema7;

	// ── Const ──
	if (hasOwn(schema, "const")) {
		const v = schema.const;
		return typeof v === "string" ? v : JSON.stringify(v);
	}

	// ── Enum ──
	if (Array.isArray(schema.enum)) {
		return formatEnumValues(schema.enum);
	}

	// ── anyOf / oneOf (union types) ──
	const branches = schema.anyOf ?? schema.oneOf;
	if (Array.isArray(branches) && branches.length > 0) {
		const parts = branches.map((b) => formatSchemaType(b));
		return parts.join(" | ");
	}

	// ── Array type ──
	if (schema.type === "array") {
		if (schema.items !== undefined && typeof schema.items !== "boolean") {
			const itemSchema = schema.items as JSONSchema7;

			// Items with anyOf/oneOf → "string[] | number[]"
			const itemBranches = itemSchema.anyOf ?? itemSchema.oneOf;
			if (Array.isArray(itemBranches) && itemBranches.length > 0) {
				const parts = itemBranches.map((b) => `${formatSchemaType(b)}[]`);
				return parts.join(" | ");
			}

			// Items with multiple types → "string[] | number[]"
			if (Array.isArray(itemSchema.type)) {
				const parts = itemSchema.type.map((t) => `${t}[]`);
				return parts.join(" | ");
			}

			const itemType = formatSchemaType(itemSchema);
			return `${itemType}[]`;
		}
		// items is boolean true or missing
		return "array";
	}

	// ── Simple type ──
	if (typeof schema.type === "string") {
		return schema.type;
	}

	// ── Multiple types (type: ["string", "number"]) ──
	if (Array.isArray(schema.type)) {
		return schema.type.join(" | ");
	}

	// ── not (pure-not schema, no other significant keywords) ──
	if (
		hasOwn(schema, "not") &&
		!schema.type &&
		!isPlainObj(schema.properties) &&
		schema.items === undefined &&
		!Array.isArray(schema.enum) &&
		!hasOwn(schema, "const")
	) {
		return `not ${formatSchemaType(schema.not as JSONSchema7Definition)}`;
	}

	// ── Fallback ──
	// Schema without explicit type — try to infer from structure
	if (isPlainObj(schema.properties)) return "object";
	if (schema.items !== undefined) return "array";

	return "unknown";
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

/**
 * Builds a normalized property path.
 *   - Root + key              → `"accountId"`
 *   - Parent + key            → `"user.name"`
 *   - Parent[] + key          → `"users[].name"`
 */
function joinPath(parent: string, key: string): string {
	if (!parent) return key;
	return `${parent}.${key}`;
}

/**
 * Appends the `[]` suffix to indicate entering array items.
 */
function arrayPath(parent: string): string {
	if (!parent) return "[]";
	return `${parent}[]`;
}

// ─── Schema Accessors ────────────────────────────────────────────────────────

/**
 * Safely extracts the properties from a schema.
 */
function getProperties(
	schema: JSONSchema7,
): Record<string, JSONSchema7Definition> | null {
	if (isPlainObj(schema.properties)) {
		return schema.properties as Record<string, JSONSchema7Definition>;
	}
	return null;
}

/**
 * Safely extracts the required fields from a schema.
 */
function getRequired(schema: JSONSchema7): string[] {
	if (Array.isArray(schema.required)) {
		return schema.required as string[];
	}
	return [];
}

/**
 * Determines the effective type of a schema (string or array of types).
 */
function getEffectiveType(schema: JSONSchema7): string | string[] | undefined {
	if (schema.type !== undefined) return schema.type as string | string[];

	// Infer from const
	if (hasOwn(schema, "const")) {
		const v = schema.const;
		if (v === null) return "null";
		if (Array.isArray(v)) return "array";
		return typeof v;
	}

	// Infer from properties
	if (isPlainObj(schema.properties)) return "object";

	// Infer from items
	if (schema.items !== undefined) return "array";

	return undefined;
}

/**
 * Checks whether a type (string) is included in a type or array of types.
 */
function typeIncludes(
	schemaType: string | string[] | undefined,
	target: string,
): boolean {
	if (schemaType === undefined) return false;
	if (typeof schemaType === "string") {
		// integer is a subset of number
		if (target === "number" && schemaType === "integer") return true;
		if (target === "integer" && schemaType === "number") return true;
		return schemaType === target;
	}
	return schemaType.includes(target);
}

/**
 * Checks whether two types are compatible.
 * A type is compatible if the sub type is included in the sup type.
 */
function typesAreCompatible(
	subType: string | string[] | undefined,
	supType: string | string[] | undefined,
): boolean {
	if (supType === undefined) return true; // sup accepts anything
	if (subType === undefined) return true; // sub is undetermined, cannot conclude

	if (typeof subType === "string" && typeof supType === "string") {
		if (subType === supType) return true;
		// integer ⊆ number
		if (subType === "integer" && supType === "number") return true;
		return false;
	}

	if (typeof subType === "string" && Array.isArray(supType)) {
		return supType.some(
			(t) => t === subType || (subType === "integer" && t === "number"),
		);
	}

	if (Array.isArray(subType) && typeof supType === "string") {
		return subType.every(
			(t) => t === supType || (t === "integer" && supType === "number"),
		);
	}

	if (Array.isArray(subType) && Array.isArray(supType)) {
		return subType.every((st) =>
			supType.some(
				(supt) => supt === st || (st === "integer" && supt === "number"),
			),
		);
	}

	return true;
}

// ─── Constraint Helpers ──────────────────────────────────────────────────────

/**
 * Formats a constraint value into a readable string.
 */
function fmtConstraint(name: string, value: unknown): string {
	if (value === undefined) return `${name}: not set`;
	if (typeof value === "boolean") return `${name}: ${value}`;
	if (typeof value === "number" || typeof value === "string")
		return `${name}: ${value}`;
	return `${name}: ${JSON.stringify(value)}`;
}

/**
 * Compares a "minimum-like" numeric constraint (sub.X must be >= sup.X for sub ⊆ sup).
 * Examples: minimum, exclusiveMinimum, minLength, minItems, minProperties
 */
function checkMinConstraint(
	subVal: number | undefined,
	supVal: number | undefined,
	name: string,
	path: string,
	errors: SchemaError[],
	type: SchemaErrorType,
): void {
	if (supVal !== undefined) {
		if (subVal === undefined || subVal < supVal) {
			errors.push({
				type,
				key: path || "$root",
				expected: fmtConstraint(name, supVal),
				received: fmtConstraint(name, subVal),
			});
		}
	}
}

/**
 * Compares a "maximum-like" numeric constraint (sub.X must be <= sup.X for sub ⊆ sup).
 * Examples: maximum, exclusiveMaximum, maxLength, maxItems, maxProperties
 */
function checkMaxConstraint(
	subVal: number | undefined,
	supVal: number | undefined,
	name: string,
	path: string,
	errors: SchemaError[],
	type: SchemaErrorType,
): void {
	if (supVal !== undefined) {
		if (subVal === undefined || subVal > supVal) {
			errors.push({
				type,
				key: path || "$root",
				expected: fmtConstraint(name, supVal),
				received: fmtConstraint(name, subVal),
			});
		}
	}
}

/**
 * Compares numeric constraints between sub and sup.
 */
function checkNumericConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	const subMin = sub.minimum;
	const subExclMin = sub.exclusiveMinimum as number | undefined;
	const subMax = sub.maximum;
	const subExclMax = sub.exclusiveMaximum as number | undefined;

	const supMin = sup.minimum;
	const supExclMin = sup.exclusiveMinimum as number | undefined;
	const supMax = sup.maximum;
	const supExclMax = sup.exclusiveMaximum as number | undefined;

	// ── LOWER BOUND cross-check ──

	// Check sup.minimum
	if (supMin !== undefined) {
		// sub satisfies sup.minimum if:
		//   sub.minimum >= sup.minimum  OR
		//   sub.exclusiveMinimum >= sup.minimum  (>X implies >=X when X is the same)
		const satisfiedByMin = subMin !== undefined && subMin >= supMin;
		const satisfiedByExclMin = subExclMin !== undefined && subExclMin >= supMin;

		if (!satisfiedByMin && !satisfiedByExclMin) {
			errors.push({
				type: SchemaErrorType.NumericConstraint,
				key: path || "$root",
				expected: fmtConstraint("minimum", supMin),
				received:
					subMin !== undefined
						? fmtConstraint("minimum", subMin)
						: subExclMin !== undefined
							? fmtConstraint("exclusiveMinimum", subExclMin)
							: fmtConstraint("minimum", undefined),
			});
		}
	}

	// Check sup.exclusiveMinimum
	if (supExclMin !== undefined) {
		// sub satisfies sup.exclusiveMinimum if:
		//   sub.exclusiveMinimum >= sup.exclusiveMinimum  OR
		//   sub.minimum > sup.exclusiveMinimum  (>=X with X>B implies >B)
		const satisfiedByExclMin =
			subExclMin !== undefined && subExclMin >= supExclMin;
		const satisfiedByMin = subMin !== undefined && subMin > supExclMin;

		if (!satisfiedByExclMin && !satisfiedByMin) {
			errors.push({
				type: SchemaErrorType.NumericConstraint,
				key: path || "$root",
				expected: fmtConstraint("exclusiveMinimum", supExclMin),
				received:
					subExclMin !== undefined
						? fmtConstraint("exclusiveMinimum", subExclMin)
						: subMin !== undefined
							? fmtConstraint("minimum", subMin)
							: fmtConstraint("exclusiveMinimum", undefined),
			});
		}
	}

	// ── UPPER BOUND cross-check ──

	// Check sup.maximum
	if (supMax !== undefined) {
		// sub satisfies sup.maximum if:
		//   sub.maximum <= sup.maximum  OR
		//   sub.exclusiveMaximum <= sup.maximum
		const satisfiedByMax = subMax !== undefined && subMax <= supMax;
		const satisfiedByExclMax = subExclMax !== undefined && subExclMax <= supMax;

		if (!satisfiedByMax && !satisfiedByExclMax) {
			errors.push({
				type: SchemaErrorType.NumericConstraint,
				key: path || "$root",
				expected: fmtConstraint("maximum", supMax),
				received:
					subMax !== undefined
						? fmtConstraint("maximum", subMax)
						: subExclMax !== undefined
							? fmtConstraint("exclusiveMaximum", subExclMax)
							: fmtConstraint("maximum", undefined),
			});
		}
	}

	// Check sup.exclusiveMaximum
	if (supExclMax !== undefined) {
		// sub satisfies sup.exclusiveMaximum if:
		//   sub.exclusiveMaximum <= sup.exclusiveMaximum  OR
		//   sub.maximum < sup.exclusiveMaximum
		const satisfiedByExclMax =
			subExclMax !== undefined && subExclMax <= supExclMax;
		const satisfiedByMax = subMax !== undefined && subMax < supExclMax;

		if (!satisfiedByExclMax && !satisfiedByMax) {
			errors.push({
				type: SchemaErrorType.NumericConstraint,
				key: path || "$root",
				expected: fmtConstraint("exclusiveMaximum", supExclMax),
				received:
					subExclMax !== undefined
						? fmtConstraint("exclusiveMaximum", subExclMax)
						: subMax !== undefined
							? fmtConstraint("maximum", subMax)
							: fmtConstraint("exclusiveMaximum", undefined),
			});
		}
	}

	// ── multipleOf (unchanged) ──
	if (sup.multipleOf !== undefined) {
		if (sub.multipleOf === undefined) {
			errors.push({
				type: SchemaErrorType.NumericConstraint,
				key: path || "$root",
				expected: fmtConstraint("multipleOf", sup.multipleOf),
				received: fmtConstraint("multipleOf", sub.multipleOf),
			});
		} else if (sub.multipleOf !== sup.multipleOf) {
			// sub.multipleOf must be a multiple of sup.multipleOf for sub ⊆ sup
			if (sub.multipleOf % sup.multipleOf !== 0) {
				errors.push({
					type: SchemaErrorType.NumericConstraint,
					key: path || "$root",
					expected: fmtConstraint("multipleOf", sup.multipleOf),
					received: fmtConstraint("multipleOf", sub.multipleOf),
				});
			}
		}
	}
}

/**
 * Compares string constraints between sub and sup.
 */
function checkStringConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	checkMinConstraint(
		sub.minLength,
		sup.minLength,
		"minLength",
		path,
		errors,
		SchemaErrorType.StringConstraint,
	);
	checkMaxConstraint(
		sub.maxLength,
		sup.maxLength,
		"maxLength",
		path,
		errors,
		SchemaErrorType.StringConstraint,
	);

	// ── Pattern ──
	if (sup.pattern !== undefined) {
		if (sub.pattern === undefined) {
			errors.push({
				type: SchemaErrorType.StringConstraint,
				key: path || "$root",
				expected: fmtConstraint("pattern", sup.pattern),
				received: "no pattern constraint",
			});
		} else if (sub.pattern !== sup.pattern) {
			// Different patterns — we can't statically determine subset relationship
			// without sampling, so report it as a potential mismatch.
			// The subset checker may have already stripped equivalent patterns,
			// so if we get here, they're genuinely different.
			errors.push({
				type: SchemaErrorType.StringConstraint,
				key: path || "$root",
				expected: fmtConstraint("pattern", sup.pattern),
				received: fmtConstraint("pattern", sub.pattern),
			});
		}
	}

	// ── Format ──
	if (sup.format !== undefined && sub.format !== sup.format) {
		if (sub.format === undefined) {
			errors.push({
				type: SchemaErrorType.StringConstraint,
				key: path || "$root",
				expected: fmtConstraint("format", sup.format),
				received: "no format constraint",
			});
		} else {
			errors.push({
				type: SchemaErrorType.StringConstraint,
				key: path || "$root",
				expected: fmtConstraint("format", sup.format),
				received: fmtConstraint("format", sub.format),
			});
		}
	}
}

/**
 * Compares object constraints (excluding properties/required) between sub and sup.
 */
function checkObjectConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	// ── additionalProperties ──
	if (sup.additionalProperties !== undefined) {
		if (sup.additionalProperties === false) {
			// sup forbids additional properties
			if (
				sub.additionalProperties === undefined ||
				sub.additionalProperties === true
			) {
				// sub allows them → incompatible
				errors.push({
					type: SchemaErrorType.ObjectConstraint,
					key: path || "$root",
					expected: "additionalProperties: false",
					received: "additional properties allowed",
				});
			} else if (
				typeof sub.additionalProperties === "object" &&
				sub.additionalProperties !== null
			) {
				// sub has a schema for additional properties → still allows them
				errors.push({
					type: SchemaErrorType.ObjectConstraint,
					key: path || "$root",
					expected: "additionalProperties: false",
					received: "additionalProperties: schema",
				});
			}
		} else if (
			typeof sup.additionalProperties === "object" &&
			sup.additionalProperties !== null
		) {
			// sup has a schema for additionalProperties
			if (
				sub.additionalProperties === undefined ||
				sub.additionalProperties === true
			) {
				// sub allows anything → more permissive
				errors.push({
					type: SchemaErrorType.ObjectConstraint,
					key: path || "$root",
					expected: `additionalProperties: ${formatSchemaType(sup.additionalProperties as JSONSchema7Definition)}`,
					received: "additional properties allowed",
				});
			} else if (
				typeof sub.additionalProperties === "object" &&
				sub.additionalProperties !== null
			) {
				// Both have schema-form additionalProperties — recurse
				const apPath = path
					? `${path}.<additionalProperties>`
					: "<additionalProperties>";
				const apErrors = computeSemanticErrors(
					sub.additionalProperties as JSONSchema7Definition,
					sup.additionalProperties as JSONSchema7Definition,
					apPath,
				);
				errors.push(...apErrors);
			}
		}
	}

	// ── minProperties / maxProperties ──
	checkMinConstraint(
		sub.minProperties,
		sup.minProperties,
		"minProperties",
		path,
		errors,
		SchemaErrorType.ObjectConstraint,
	);
	checkMaxConstraint(
		sub.maxProperties,
		sup.maxProperties,
		"maxProperties",
		path,
		errors,
		SchemaErrorType.ObjectConstraint,
	);

	// ── propertyNames ──
	if (sup.propertyNames !== undefined) {
		if (sub.propertyNames === undefined) {
			errors.push({
				type: SchemaErrorType.ObjectConstraint,
				key: path || "$root",
				expected: `propertyNames: ${formatSchemaType(sup.propertyNames)}`,
				received: "no propertyNames constraint",
			});
		} else {
			// Both have propertyNames — recurse
			const pnErrors = computeSemanticErrors(
				sub.propertyNames as JSONSchema7Definition,
				sup.propertyNames as JSONSchema7Definition,
				path ? `${path}.<propertyNames>` : "<propertyNames>",
			);
			errors.push(...pnErrors);
		}
	}

	// ── dependencies ──
	if (isPlainObj(sup.dependencies)) {
		const supDeps = sup.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const subDeps = isPlainObj(sub.dependencies)
			? (sub.dependencies as Record<string, JSONSchema7Definition | string[]>)
			: null;

		const subRequired = Array.isArray(sub.required)
			? (sub.required as string[])
			: [];
		const subProps = isPlainObj(sub.properties) ? sub.properties : {};

		for (const key of Object.keys(supDeps)) {
			const supDep = supDeps[key];
			const subDep = subDeps?.[key];

			if (subDep === undefined) {
				if (Array.isArray(supDep)) {
					// ── Semantic deduction for array-form dependencies ──
					//
					// A dependency `{ A: ['B', 'C'] }` means:
					//   "if A is present → B and C must also be present"
					//
					// Case 1: All dependent properties (B, C) are in sub.required
					//   → The dependency is trivially satisfied (B and C are ALWAYS present)
					//
					// Case 2: The trigger property (A) doesn't exist in sub.properties
					//         AND is not in sub.required
					//   → sub will never produce A, so the dependency is never triggered
					const allDepsAlwaysRequired = supDep.every((d) =>
						subRequired.includes(d),
					);
					const triggerNeverProduced =
						!hasOwn(subProps, key) && !subRequired.includes(key);

					if (!allDepsAlwaysRequired && !triggerNeverProduced) {
						errors.push({
							type: SchemaErrorType.ObjectConstraint,
							key: path || "$root",
							expected: `dependency: ${key} requires ${supDep.join(", ")}`,
							received: `no dependency for ${key}`,
						});
					}
				} else {
					// ── Schema-form dependencies ──
					// Check if the trigger property is never produced by sub
					const triggerNeverProduced =
						!hasOwn(subProps, key) && !subRequired.includes(key);

					if (!triggerNeverProduced) {
						errors.push({
							type: SchemaErrorType.ObjectConstraint,
							key: path || "$root",
							expected: `dependency: ${key} requires schema`,
							received: `no dependency for ${key}`,
						});
					}
				}
			} else if (Array.isArray(supDep) && Array.isArray(subDep)) {
				// Both are array form — check if sub includes all required props from sup
				const missing = supDep.filter((d) => !subDep.includes(d));
				if (missing.length > 0) {
					errors.push({
						type: SchemaErrorType.ObjectConstraint,
						key: path || "$root",
						expected: `dependency: ${key} requires ${supDep.join(", ")}`,
						received: `dependency: ${key} requires ${subDep.join(", ")}`,
					});
				}
			} else if (!Array.isArray(supDep) && !Array.isArray(subDep)) {
				// Both are schema form — recurse
				const depPath = path
					? `${path}.<dependency:${key}>`
					: `<dependency:${key}>`;
				const depErrors = computeSemanticErrors(
					subDep as JSONSchema7Definition,
					supDep as JSONSchema7Definition,
					depPath,
				);
				errors.push(...depErrors);
			} else {
				// Mixed forms (one array, one schema) — report mismatch
				errors.push({
					type: SchemaErrorType.ObjectConstraint,
					key: path || "$root",
					expected: Array.isArray(supDep)
						? `dependency: ${key} requires ${supDep.join(", ")}`
						: `dependency: ${key} requires schema`,
					received: Array.isArray(subDep)
						? `dependency: ${key} requires ${subDep.join(", ")}`
						: `dependency: ${key} requires schema`,
				});
			}
		}
	}

	// ── patternProperties ──
	if (isPlainObj(sup.patternProperties)) {
		const supPP = sup.patternProperties as Record<
			string,
			JSONSchema7Definition
		>;
		const subPP = isPlainObj(sub.patternProperties)
			? (sub.patternProperties as Record<string, JSONSchema7Definition>)
			: null;

		for (const pattern of Object.keys(supPP)) {
			const supPropDef = supPP[pattern];
			if (supPropDef === undefined) continue;

			const subPropDef = subPP?.[pattern];
			const ppPath = path
				? `${path}.<patternProperties:${pattern}>`
				: `<patternProperties:${pattern}>`;

			if (subPropDef === undefined) {
				// sub doesn't constrain this pattern at all — more permissive
				errors.push({
					type: SchemaErrorType.ObjectConstraint,
					key: ppPath,
					expected: formatSchemaType(supPropDef),
					received: "no constraint for this pattern",
				});
			} else {
				// Both define the same pattern — recurse
				const ppErrors = computeSemanticErrors(subPropDef, supPropDef, ppPath);
				errors.push(...ppErrors);
			}
		}
	}
}

/**
 * Compares array constraints (excluding items) between sub and sup.
 */
function checkArrayConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	checkMinConstraint(
		sub.minItems,
		sup.minItems,
		"minItems",
		path,
		errors,
		SchemaErrorType.ArrayConstraint,
	);
	checkMaxConstraint(
		sub.maxItems,
		sup.maxItems,
		"maxItems",
		path,
		errors,
		SchemaErrorType.ArrayConstraint,
	);

	// ── uniqueItems ──
	if (sup.uniqueItems === true && sub.uniqueItems !== true) {
		errors.push({
			type: SchemaErrorType.ArrayConstraint,
			key: path || "$root",
			expected: "uniqueItems: true",
			received: fmtConstraint("uniqueItems", sub.uniqueItems ?? false),
		});
	}

	// ── contains ──
	if (sup.contains !== undefined) {
		if (sub.contains === undefined) {
			errors.push({
				type: SchemaErrorType.ArrayConstraint,
				key: path || "$root",
				expected: `contains: ${formatSchemaType(sup.contains as JSONSchema7Definition)}`,
				received: "no contains constraint",
			});
		} else {
			// Both have contains — recurse to compare the contained schemas
			const containsPath = path ? `${path}.<contains>` : "<contains>";
			const containsErrors = computeSemanticErrors(
				sub.contains as JSONSchema7Definition,
				sup.contains as JSONSchema7Definition,
				containsPath,
			);
			errors.push(...containsErrors);
		}
	}
}

/**
 * Detects whether a schema has a numeric type.
 */
function isNumericType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "number" || t === "integer";
	return t.some((v) => v === "number" || v === "integer");
}

/**
 * Detects whether a schema has a string type.
 */
function isStringType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "string";
	return t.includes("string");
}

/**
 * Detects whether a schema has an object type.
 */
function isObjectType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "object";
	return t.includes("object");
}

/**
 * Detects whether a schema has an array type.
 */
function isArrayType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "array";
	return t.includes("array");
}

// ─── Keyword-based implicit type detection ───────────────────────────────────
//
// propertyNames schemas (e.g. { minLength: 1 }) don't always carry an explicit
// `type`, yet their keywords unambiguously imply a type family. These helpers
// let us trigger the right constraint checks even when `getEffectiveType`
// returns `undefined`.

function hasNumericKeywords(s: JSONSchema7): boolean {
	return (
		s.minimum !== undefined ||
		s.maximum !== undefined ||
		s.exclusiveMinimum !== undefined ||
		s.exclusiveMaximum !== undefined ||
		s.multipleOf !== undefined
	);
}

function hasStringKeywords(s: JSONSchema7): boolean {
	return (
		s.minLength !== undefined ||
		s.maxLength !== undefined ||
		s.pattern !== undefined ||
		s.format !== undefined
	);
}

function hasObjectKeywords(s: JSONSchema7): boolean {
	return (
		s.minProperties !== undefined ||
		s.maxProperties !== undefined ||
		s.propertyNames !== undefined ||
		s.additionalProperties !== undefined ||
		isPlainObj(s.patternProperties) ||
		isPlainObj(s.dependencies)
	);
}

function hasArrayKeywords(s: JSONSchema7): boolean {
	return (
		s.minItems !== undefined ||
		s.maxItems !== undefined ||
		s.uniqueItems !== undefined ||
		s.contains !== undefined
	);
}

// ─── Core Comparison ─────────────────────────────────────────────────────────

/**
 * Compares two schemas and produces semantic errors.
 *
 * @param sub   The source schema (what is produced / received)
 * @param sup   The target schema (what is expected)
 * @param path  The current normalized path
 * @returns     List of semantic errors
 */
/**
 * Lightweight semantic check for whether `sub` trivially satisfies `sup.not`.
 *
 * Returns:
 * - `true`  — the `not` is definitely satisfied (no error should be reported)
 * - `false` — the `not` is definitely violated (error should be reported)
 * - `null`  — cannot determine (fall back to structural check)
 *
 * This inlines the most common cases from `evaluateNot` in `subset-checker.ts`
 * to avoid circular imports.
 */
function isNotSatisfied(sub: JSONSchema7, sup: JSONSchema7): boolean | null {
	if (
		!hasOwn(sup, "not") ||
		!isPlainObj(sup.not) ||
		typeof sup.not === "boolean"
	) {
		return null;
	}
	const notSchema = sup.not as JSONSchema7;

	// ── Type disjointness ──
	// If sub has a type and not has a type, and they're completely disjoint → satisfied
	if (sub.type !== undefined && notSchema.type !== undefined) {
		const subTypes = Array.isArray(sub.type) ? sub.type : [sub.type];
		const notTypes = Array.isArray(notSchema.type)
			? notSchema.type
			: [notSchema.type];
		const hasOverlap = subTypes.some((t) => notTypes.includes(t));

		// Only consider pure type-only not schemas (no extra constraints)
		const notKeys = Object.keys(notSchema);
		const isTypeOnly = notKeys.length === 1 && notKeys[0] === "type";

		if (isTypeOnly) {
			if (!hasOverlap) return true; // disjoint types → not is satisfied
			// If sub's types are entirely within not's types → definitely violated
			if (subTypes.every((t) => notTypes.includes(t))) return false;
		}
	}

	// ── Const disjointness ──
	if (hasOwn(notSchema, "const")) {
		if (hasOwn(sub, "const")) {
			return !deepEqual(sub.const, notSchema.const);
		}
		if (Array.isArray(sub.enum)) {
			const allDisjoint = sub.enum.every((v) => !deepEqual(v, notSchema.const));
			if (allDisjoint) return true;
		}
	}

	// ── Enum disjointness ──
	if (Array.isArray(notSchema.enum)) {
		if (hasOwn(sub, "const")) {
			const constInNotEnum = notSchema.enum.some((v) =>
				deepEqual(v, sub.const),
			);
			if (!constInNotEnum) return true;
			return false;
		}
		if (Array.isArray(sub.enum)) {
			const hasOverlap = sub.enum.some((v) =>
				notSchema.enum?.some((nv) => deepEqual(v, nv)),
			);
			if (!hasOverlap) return true;
		}
	}

	return null;
}

export function computeSemanticErrors(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	path = "",
): SchemaError[] {
	// ── Boolean schemas ──
	if (typeof sup === "boolean") {
		if (sup === false) {
			return [
				{
					type: SchemaErrorType.TypeMismatch,
					key: path || "$root",
					expected: "never",
					received: formatSchemaType(sub),
				},
			];
		}
		return []; // sup = true accepts everything
	}
	if (typeof sub === "boolean") {
		if (sub === true) {
			return [
				{
					type: SchemaErrorType.TypeMismatch,
					key: path || "$root",
					expected: formatSchemaType(sup),
					received: "any",
				},
			];
		}
		return []; // sub = false produces nothing, trivially subset
	}

	const subSchema = sub as JSONSchema7;
	const supSchema = sup as JSONSchema7;

	const errors: SchemaError[] = [];

	// ── Handle `not` keyword ──
	// Use semantic evaluation to check if the `not` is satisfied before
	// falling back to structural comparison.
	if (
		hasOwn(supSchema, "not") &&
		isPlainObj(supSchema.not) &&
		typeof supSchema.not !== "boolean"
	) {
		const notSchema = supSchema.not as JSONSchema7;
		const notFormatted = formatSchemaType(notSchema);

		// Use semantic evaluation to check if the `not` is satisfied
		const notResult = isNotSatisfied(subSchema, supSchema);

		if (notResult === false) {
			// Sub definitely violates the `not` → confirmed error
			errors.push({
				type: SchemaErrorType.NotSchema,
				key: path || "$root",
				expected: `not ${notFormatted}`,
				received: formatSchemaType(subSchema),
			});
		} else if (notResult === null) {
			// Indeterminate → fall back to structural check
			if (!hasOwn(subSchema, "not")) {
				errors.push({
					type: SchemaErrorType.NotSchema,
					key: path || "$root",
					expected: `not ${notFormatted}`,
					received: formatSchemaType(subSchema),
				});
			} else if (
				isPlainObj(subSchema.not) &&
				typeof subSchema.not !== "boolean"
			) {
				const subNotSchema = subSchema.not as JSONSchema7;
				if (!deepEqual(subNotSchema, notSchema)) {
					errors.push({
						type: SchemaErrorType.NotSchema,
						key: path || "$root",
						expected: `not ${notFormatted}`,
						received: `not ${formatSchemaType(subNotSchema)}`,
					});
				}
			}
		}
		// If notResult === true → not is satisfied, no error
	}

	// ── Get effective types ──
	const subType = getEffectiveType(subSchema);
	const supType = getEffectiveType(supSchema);

	// ── Handle anyOf/oneOf in sup ──
	// If sup has branches, try to find the best matching one for error reporting
	const supBranches = supSchema.anyOf ?? supSchema.oneOf;
	if (Array.isArray(supBranches) && supBranches.length > 0 && !supSchema.type) {
		return computeErrorsAgainstBranches(subSchema, supBranches, path);
	}

	// ── Handle anyOf/oneOf in sub ──
	const subBranches = subSchema.anyOf ?? subSchema.oneOf;
	if (Array.isArray(subBranches) && subBranches.length > 0 && !subSchema.type) {
		const branchErrors: SchemaError[] = [];
		for (const branch of subBranches) {
			const errs = computeSemanticErrors(branch, sup, path);
			branchErrors.push(...errs);
		}
		return branchErrors;
	}

	// ── Both are object types → compare properties + object constraints ──
	const supProps = getProperties(supSchema);
	const subProps = getProperties(subSchema);

	if (supProps !== null || isObjectType(supType)) {
		// sup is an object schema
		if (subType !== undefined && !typeIncludes(subType, "object")) {
			// sub is not an object at all
			errors.push({
				type: SchemaErrorType.TypeMismatch,
				key: path || "$root",
				expected: formatSchemaType(supSchema),
				received: formatSchemaType(subSchema),
			});
			return errors;
		}

		if (supProps !== null) {
			const supRequired = getRequired(supSchema);
			const subRequired = getRequired(subSchema);

			for (const key of Object.keys(supProps)) {
				const propPath = joinPath(path, key);
				const supPropDef = supProps[key];
				const subPropDef = subProps?.[key];

				if (supPropDef === undefined) continue;

				const isRequiredInSup = supRequired.includes(key);

				// ── Missing property (required in sup, absent in sub) ──
				if (subPropDef === undefined) {
					if (isRequiredInSup) {
						errors.push({
							type: SchemaErrorType.MissingProperty,
							key: propPath,
							expected: formatSchemaType(supPropDef),
							received: "undefined",
						});
					}
					continue;
				}

				// ── Optionality mismatch (required in sup, optional in sub) ──
				if (isRequiredInSup && !subRequired.includes(key)) {
					errors.push({
						type: SchemaErrorType.Optionality,
						key: propPath,
						expected: "not optional",
						received: "optional",
					});
					continue;
				}

				// ── Recurse into the property schemas ──
				const propErrors = comparePropertySchemas(
					subPropDef,
					supPropDef,
					propPath,
				);
				errors.push(...propErrors);
			}
		}

		// ── Object-level constraints ──
		checkObjectConstraints(subSchema, supSchema, path, errors);

		return errors;
	}

	// ── Both are array types → compare items + array constraints ──
	if (
		(supType === "array" || supSchema.items !== undefined) &&
		(subType === "array" || subSchema.items !== undefined)
	) {
		// Check items compatibility
		if (supSchema.items !== undefined && typeof supSchema.items !== "boolean") {
			if (
				subSchema.items !== undefined &&
				typeof subSchema.items !== "boolean"
			) {
				// Both have items schemas — recurse
				if (Array.isArray(supSchema.items) && Array.isArray(subSchema.items)) {
					// Tuple comparison
					const maxLen = Math.max(
						supSchema.items.length,
						subSchema.items.length,
					);
					for (let i = 0; i < maxLen; i++) {
						const supItem = supSchema.items[i];
						const subItem = subSchema.items[i];
						const itemPath = joinPath(path, `[${i}]`);
						if (supItem !== undefined && subItem === undefined) {
							errors.push({
								type: SchemaErrorType.MissingProperty,
								key: itemPath,
								expected: formatSchemaType(supItem),
								received: "undefined",
							});
						} else if (supItem !== undefined && subItem !== undefined) {
							errors.push(...computeSemanticErrors(subItem, supItem, itemPath));
						}
					}
				} else if (
					!Array.isArray(supSchema.items) &&
					!Array.isArray(subSchema.items)
				) {
					// Single items schema — recurse with [] path
					const itemPath = arrayPath(path);
					const itemErrors = computeSemanticErrors(
						subSchema.items as JSONSchema7Definition,
						supSchema.items as JSONSchema7Definition,
						itemPath,
					);
					errors.push(...itemErrors);
				}
			} else {
				// sup has items schema but sub doesn't
				errors.push({
					type: SchemaErrorType.TypeMismatch,
					key: path || "$root",
					expected: formatSchemaType(supSchema),
					received: formatSchemaType(subSchema),
				});
			}
		}

		// ── Array-level constraints ──
		checkArrayConstraints(subSchema, supSchema, path, errors);

		return errors;
	}

	// ── Type mismatch at current level ──
	if (subType !== undefined && supType !== undefined) {
		if (!typesAreCompatible(subType, supType)) {
			errors.push({
				type: SchemaErrorType.TypeMismatch,
				key: path || "$root",
				expected: formatSchemaType(supSchema),
				received: formatSchemaType(subSchema),
			});
			return errors;
		}
	}

	// ── Enum comparison ──
	if (Array.isArray(supSchema.enum)) {
		if (Array.isArray(subSchema.enum)) {
			// Both have enums — check if sub.enum ⊆ sup.enum
			const subExtra = subSchema.enum.filter(
				(v) => !supSchema.enum?.some((sv) => deepEqual(v, sv)),
			);
			if (subExtra.length > 0) {
				errors.push({
					type: SchemaErrorType.EnumMismatch,
					key: path || "$root",
					expected: formatEnumValues(supSchema.enum),
					received: formatEnumValues(subSchema.enum),
				});
			}
		} else if (hasOwn(subSchema, "const")) {
			// sub has const, sup has enum — check inclusion
			const constInEnum = supSchema.enum.some((v) =>
				deepEqual(v, subSchema.const),
			);
			if (!constInEnum) {
				errors.push({
					type: SchemaErrorType.EnumMismatch,
					key: path || "$root",
					expected: formatEnumValues(supSchema.enum),
					received: formatSchemaType(subSchema),
				});
			}
		} else {
			// sup has enum but sub is a plain type (no enum restriction)
			errors.push({
				type: SchemaErrorType.EnumMismatch,
				key: path || "$root",
				expected: formatEnumValues(supSchema.enum),
				received: formatSchemaType(subSchema),
			});
		}
		return errors;
	}

	// ── Const comparison ──
	if (hasOwn(supSchema, "const") && hasOwn(subSchema, "const")) {
		if (!deepEqual(supSchema.const, subSchema.const)) {
			errors.push({
				type: SchemaErrorType.EnumMismatch,
				key: path || "$root",
				expected: formatSchemaType(supSchema),
				received: formatSchemaType(subSchema),
			});
		}
		return errors;
	}

	// ── Same-type constraint comparison ──
	// Types are compatible (or unspecified), now check individual keywords.

	if (
		isNumericType(subType) ||
		isNumericType(supType) ||
		hasNumericKeywords(supSchema) ||
		hasNumericKeywords(subSchema)
	) {
		checkNumericConstraints(subSchema, supSchema, path, errors);
	}

	if (
		isStringType(subType) ||
		isStringType(supType) ||
		hasStringKeywords(supSchema) ||
		hasStringKeywords(subSchema)
	) {
		checkStringConstraints(subSchema, supSchema, path, errors);
	}

	// Object-level constraints when sup doesn't have explicit properties
	// but still has object constraints (e.g., just { type: "object", minProperties: 3 })
	if (
		isObjectType(subType) ||
		isObjectType(supType) ||
		hasObjectKeywords(supSchema) ||
		hasObjectKeywords(subSchema)
	) {
		checkObjectConstraints(subSchema, supSchema, path, errors);
	}

	// Array-level constraints when sup doesn't have explicit items
	// but still has array constraints (e.g., just { type: "array", minItems: 2 })
	if (
		isArrayType(subType) ||
		isArrayType(supType) ||
		hasArrayKeywords(supSchema) ||
		hasArrayKeywords(subSchema)
	) {
		checkArrayConstraints(subSchema, supSchema, path, errors);
	}

	if (errors.length > 0) {
		return errors;
	}

	// ── Fallback: generic incompatibility ──
	// If we get here, there's an incompatibility we couldn't pinpoint precisely.
	// Produce a root-level error with the formatted types.
	const expectedStr = formatSchemaType(supSchema);
	const receivedStr = formatSchemaType(subSchema);
	if (expectedStr !== receivedStr) {
		// Do not report type_mismatch when:
		//   - sub has an enum (formatting as "active or pending")
		//   - sup has a `not` constraint that is confirmed satisfied (notResult === true)
		//   - the base types are compatible
		//
		// In this scenario the only source of incompatibility was the `not` keyword,
		// which is confirmed to be satisfied by sub's enum values. The textual
		// representations differ ("active or pending" vs "string") solely because
		// formatSchemaType renders enum values rather than their declared type —
		// there is no actual semantic incompatibility.
		const supNotSatisfied =
			hasOwn(supSchema, "not") &&
			isPlainObj(supSchema.not) &&
			isNotSatisfied(subSchema, supSchema) === true;

		const isEnumCompatibleWithSupNot =
			Array.isArray(subSchema.enum) &&
			supSchema.type !== undefined &&
			subSchema.type !== undefined &&
			typesAreCompatible(subSchema.type, supSchema.type) &&
			supNotSatisfied;

		if (!isEnumCompatibleWithSupNot) {
			errors.push({
				type: SchemaErrorType.TypeMismatch,
				key: path || "$root",
				expected: expectedStr,
				received: receivedStr,
			});
		}
	}

	return errors;
}

// ─── Property Schema Comparison ──────────────────────────────────────────────

/**
 * Compares two property schemas and produces errors.
 * Handles recursion into nested objects and arrays.
 */
function comparePropertySchemas(
	subDef: JSONSchema7Definition,
	supDef: JSONSchema7Definition,
	path: string,
): SchemaError[] {
	if (typeof subDef === "boolean" || typeof supDef === "boolean") {
		if (subDef !== supDef) {
			return [
				{
					type: SchemaErrorType.TypeMismatch,
					key: path,
					expected: formatSchemaType(supDef),
					received: formatSchemaType(subDef),
				},
			];
		}
		return [];
	}

	const subSchema = subDef as JSONSchema7;
	const supSchema = supDef as JSONSchema7;

	const subType = getEffectiveType(subSchema);
	const supType = getEffectiveType(supSchema);

	// ── Enum comparison (before type check, as enums can cross types) ──
	if (Array.isArray(supSchema.enum)) {
		if (Array.isArray(subSchema.enum)) {
			const subExtra = subSchema.enum.filter(
				(v) => !supSchema.enum?.some((sv) => deepEqual(v, sv)),
			);
			if (subExtra.length > 0) {
				return [
					{
						type: SchemaErrorType.EnumMismatch,
						key: path,
						expected: formatEnumValues(supSchema.enum),
						received: formatEnumValues(subSchema.enum),
					},
				];
			}
			return [];
		}
		if (hasOwn(subSchema, "const")) {
			const constInEnum = supSchema.enum.some((v) =>
				deepEqual(v, subSchema.const),
			);
			if (!constInEnum) {
				return [
					{
						type: SchemaErrorType.EnumMismatch,
						key: path,
						expected: formatEnumValues(supSchema.enum),
						received: formatSchemaType(subSchema),
					},
				];
			}
			return [];
		}
		// sup has enum, sub is a plain type
		return [
			{
				type: SchemaErrorType.EnumMismatch,
				key: path,
				expected: formatEnumValues(supSchema.enum),
				received: formatSchemaType(subSchema),
			},
		];
	}

	// ── Const comparison ──
	if (hasOwn(supSchema, "const") && hasOwn(subSchema, "const")) {
		if (!deepEqual(supSchema.const, subSchema.const)) {
			return [
				{
					type: SchemaErrorType.EnumMismatch,
					key: path,
					expected: formatSchemaType(supSchema),
					received: formatSchemaType(subSchema),
				},
			];
		}
		return [];
	}

	// ── Type mismatch ──
	if (subType !== undefined && supType !== undefined) {
		if (!typesAreCompatible(subType, supType)) {
			return [
				{
					type: SchemaErrorType.TypeMismatch,
					key: path,
					expected: formatSchemaType(supSchema),
					received: formatSchemaType(subSchema),
				},
			];
		}
	}

	// ── If same types, recurse deeper ──
	return computeSemanticErrors(subDef, supDef, path);
}

// ─── Branch Error Computation ────────────────────────────────────────────────

/**
 * When sup has branches (anyOf/oneOf), attempts to find the closest
 * matching branch and generates errors against it.
 *
 * Strategy: compute errors for each branch and return those from the
 * branch with the fewest errors (best match).
 */
function computeErrorsAgainstBranches(
	sub: JSONSchema7,
	branches: JSONSchema7Definition[],
	path: string,
): SchemaError[] {
	let bestErrors: SchemaError[] | null = null;

	for (const branch of branches) {
		const errors = computeSemanticErrors(sub, branch, path);
		if (errors.length === 0) return [];
		if (bestErrors === null || errors.length < bestErrors.length) {
			bestErrors = errors;
		}
	}

	return (
		bestErrors ?? [
			{
				type: SchemaErrorType.BranchMismatch,
				key: path || "$root",
				expected: formatSchemaType({ anyOf: branches } as JSONSchema7),
				received: formatSchemaType(sub),
			},
		]
	);
}
