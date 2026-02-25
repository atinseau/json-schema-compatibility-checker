import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { SchemaError } from "./types";
import { hasOwn, isPlainObj } from "./utils";

// ─── Semantic Error Generator ────────────────────────────────────────────────
//
// Génère des erreurs sémantiques lisibles en comparant directement deux schemas.
//
// Contrairement au differ structurel (qui comparait sub vs merged), ce module
// compare directement sub (source/received) et sup (target/expected) pour
// produire des messages d'erreur orientés métier.
//
// Les chemins de propriétés sont normalisés :
//   - `accountId`       (propriété top-level)
//   - `user.name`       (propriété imbriquée)
//   - `users[].name`    (propriété dans les items d'un tableau)
//
// Convention :
//   - `expected` = ce que le schema cible (sup) attend
//   - `received` = ce que le schema source (sub) fournit

// ─── Type Formatting ─────────────────────────────────────────────────────────

/**
 * Formate les valeurs d'un enum en chaîne lisible.
 *
 * Exemples :
 *   - 1 valeur  : `"123"`
 *   - 2 valeurs : `"123 or salut"`
 *   - 3 valeurs : `"10, 20, or 30"`
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
 * Formate un schema en représentation de type lisible.
 *
 * Exemples :
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
 * Construit un chemin de propriété normalisé.
 *   - Racine + clé            → `"accountId"`
 *   - Parent + clé            → `"user.name"`
 *   - Parent[] + clé          → `"users[].name"`
 */
function joinPath(parent: string, key: string): string {
	if (!parent) return key;
	return `${parent}.${key}`;
}

/**
 * Ajoute le suffixe `[]` pour indiquer qu'on entre dans les items d'un array.
 */
function arrayPath(parent: string): string {
	if (!parent) return "[]";
	return `${parent}[]`;
}

// ─── Schema Accessors ────────────────────────────────────────────────────────

/**
 * Extrait les propriétés d'un schema de manière sûre.
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
 * Extrait les champs required d'un schema de manière sûre.
 */
function getRequired(schema: JSONSchema7): string[] {
	if (Array.isArray(schema.required)) {
		return schema.required as string[];
	}
	return [];
}

/**
 * Détermine le type effectif d'un schema (string ou tableau de types).
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
 * Vérifie si un type (string) est inclus dans un type ou un tableau de types.
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
 * Vérifie si deux types sont compatibles.
 * Un type est compatible si le type de sub est inclus dans le type de sup.
 */
function typesAreCompatible(
	subType: string | string[] | undefined,
	supType: string | string[] | undefined,
): boolean {
	if (supType === undefined) return true; // sup accepte tout
	if (subType === undefined) return true; // sub indéterminé, on ne peut pas conclure

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
 * Formate une valeur de contrainte en string lisible.
 */
function fmtConstraint(name: string, value: unknown): string {
	if (value === undefined) return `${name}: not set`;
	if (typeof value === "boolean") return `${name}: ${value}`;
	if (typeof value === "number" || typeof value === "string")
		return `${name}: ${value}`;
	return `${name}: ${JSON.stringify(value)}`;
}

/**
 * Compare une contrainte numérique "minimum-like" (sub.X doit être >= sup.X pour sub ⊆ sup).
 * Exemples : minimum, exclusiveMinimum, minLength, minItems, minProperties
 */
function checkMinConstraint(
	subVal: number | undefined,
	supVal: number | undefined,
	name: string,
	path: string,
	errors: SchemaError[],
): void {
	if (supVal !== undefined) {
		if (subVal === undefined || subVal < supVal) {
			errors.push({
				key: path || "$root",
				expected: fmtConstraint(name, supVal),
				received: fmtConstraint(name, subVal),
			});
		}
	}
}

/**
 * Compare une contrainte numérique "maximum-like" (sub.X doit être <= sup.X pour sub ⊆ sup).
 * Exemples : maximum, exclusiveMaximum, maxLength, maxItems, maxProperties
 */
function checkMaxConstraint(
	subVal: number | undefined,
	supVal: number | undefined,
	name: string,
	path: string,
	errors: SchemaError[],
): void {
	if (supVal !== undefined) {
		if (subVal === undefined || subVal > supVal) {
			errors.push({
				key: path || "$root",
				expected: fmtConstraint(name, supVal),
				received: fmtConstraint(name, subVal),
			});
		}
	}
}

/**
 * Compare les contraintes numériques entre sub et sup.
 */
function checkNumericConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	checkMinConstraint(sub.minimum, sup.minimum, "minimum", path, errors);
	checkMaxConstraint(sub.maximum, sup.maximum, "maximum", path, errors);
	checkMinConstraint(
		sub.exclusiveMinimum as number | undefined,
		sup.exclusiveMinimum as number | undefined,
		"exclusiveMinimum",
		path,
		errors,
	);
	checkMaxConstraint(
		sub.exclusiveMaximum as number | undefined,
		sup.exclusiveMaximum as number | undefined,
		"exclusiveMaximum",
		path,
		errors,
	);

	if (sup.multipleOf !== undefined) {
		if (sub.multipleOf === undefined) {
			errors.push({
				key: path || "$root",
				expected: fmtConstraint("multipleOf", sup.multipleOf),
				received: fmtConstraint("multipleOf", sub.multipleOf),
			});
		} else if (sub.multipleOf !== sup.multipleOf) {
			// sub.multipleOf must be a multiple of sup.multipleOf for sub ⊆ sup
			if (sub.multipleOf % sup.multipleOf !== 0) {
				errors.push({
					key: path || "$root",
					expected: fmtConstraint("multipleOf", sup.multipleOf),
					received: fmtConstraint("multipleOf", sub.multipleOf),
				});
			}
		}
	}
}

/**
 * Compare les contraintes de string entre sub et sup.
 */
function checkStringConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	checkMinConstraint(sub.minLength, sup.minLength, "minLength", path, errors);
	checkMaxConstraint(sub.maxLength, sup.maxLength, "maxLength", path, errors);

	// ── Pattern ──
	if (sup.pattern !== undefined) {
		if (sub.pattern === undefined) {
			errors.push({
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
				key: path || "$root",
				expected: fmtConstraint("format", sup.format),
				received: "no format constraint",
			});
		} else {
			errors.push({
				key: path || "$root",
				expected: fmtConstraint("format", sup.format),
				received: fmtConstraint("format", sub.format),
			});
		}
	}
}

/**
 * Compare les contraintes d'objet (hors properties/required) entre sub et sup.
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
			// sup interdit les propriétés additionnelles
			if (
				sub.additionalProperties === undefined ||
				sub.additionalProperties === true
			) {
				// sub les autorise → incompatible
				errors.push({
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
	);
	checkMaxConstraint(
		sub.maxProperties,
		sup.maxProperties,
		"maxProperties",
		path,
		errors,
	);

	// ── propertyNames ──
	if (sup.propertyNames !== undefined) {
		if (sub.propertyNames === undefined) {
			errors.push({
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

		for (const key of Object.keys(supDeps)) {
			const supDep = supDeps[key];
			const subDep = subDeps?.[key];

			if (subDep === undefined) {
				// sup requires a dependency that sub doesn't have
				if (Array.isArray(supDep)) {
					errors.push({
						key: path || "$root",
						expected: `dependency: ${key} requires ${supDep.join(", ")}`,
						received: `no dependency for ${key}`,
					});
				} else {
					errors.push({
						key: path || "$root",
						expected: `dependency: ${key} requires schema`,
						received: `no dependency for ${key}`,
					});
				}
			} else if (Array.isArray(supDep) && Array.isArray(subDep)) {
				// Both are array form — check if sub includes all required props from sup
				const missing = supDep.filter((d) => !subDep.includes(d));
				if (missing.length > 0) {
					errors.push({
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
 * Compare les contraintes d'array (hors items) entre sub et sup.
 */
function checkArrayConstraints(
	sub: JSONSchema7,
	sup: JSONSchema7,
	path: string,
	errors: SchemaError[],
): void {
	checkMinConstraint(sub.minItems, sup.minItems, "minItems", path, errors);
	checkMaxConstraint(sub.maxItems, sup.maxItems, "maxItems", path, errors);

	// ── uniqueItems ──
	if (sup.uniqueItems === true && sub.uniqueItems !== true) {
		errors.push({
			key: path || "$root",
			expected: "uniqueItems: true",
			received: fmtConstraint("uniqueItems", sub.uniqueItems ?? false),
		});
	}

	// ── contains ──
	if (sup.contains !== undefined) {
		if (sub.contains === undefined) {
			errors.push({
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
 * Détecte si un schema a un type numérique.
 */
function isNumericType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "number" || t === "integer";
	return t.some((v) => v === "number" || v === "integer");
}

/**
 * Détecte si un schema a un type string.
 */
function isStringType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "string";
	return t.includes("string");
}

/**
 * Détecte si un schema a un type object.
 */
function isObjectType(t: string | string[] | undefined): boolean {
	if (t === undefined) return false;
	if (typeof t === "string") return t === "object";
	return t.includes("object");
}

/**
 * Détecte si un schema a un type array.
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
 * Compare deux schemas et produit des erreurs sémantiques.
 *
 * @param sub   Le schema source (ce qui est produit / received)
 * @param sup   Le schema cible (ce qui est attendu / expected)
 * @param path  Le chemin normalisé courant
 * @returns     Liste d'erreurs sémantiques
 */
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
	// Check sup.not: sub must not satisfy the not-schema for sub ⊆ sup.
	// Check sub.not: if sub has a not that sup doesn't, sub is more constrained (OK).
	//                if sup has a not that sub doesn't, sub may be too permissive.
	if (
		hasOwn(supSchema, "not") &&
		isPlainObj(supSchema.not) &&
		typeof supSchema.not !== "boolean"
	) {
		const notSchema = supSchema.not as JSONSchema7;
		const notFormatted = formatSchemaType(notSchema);

		if (!hasOwn(subSchema, "not")) {
			// sup excludes something, sub doesn't → sub is more permissive
			errors.push({
				key: path || "$root",
				expected: `not ${notFormatted}`,
				received: formatSchemaType(subSchema),
			});
		} else if (
			isPlainObj(subSchema.not) &&
			typeof subSchema.not !== "boolean"
		) {
			// Both have not — compare the not schemas
			// For sub ⊆ sup, sub.not must be at least as broad as sup.not
			// (i.e. sub excludes at least as much). We report if they differ.
			const subNotSchema = subSchema.not as JSONSchema7;
			if (!deepEqualPrimitive(subNotSchema, notSchema)) {
				errors.push({
					key: path || "$root",
					expected: `not ${notFormatted}`,
					received: `not ${formatSchemaType(subNotSchema)}`,
				});
			}
		}
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
				(v) => !supSchema.enum?.some((sv) => deepEqualPrimitive(v, sv)),
			);
			if (subExtra.length > 0) {
				errors.push({
					key: path || "$root",
					expected: formatEnumValues(supSchema.enum),
					received: formatEnumValues(subSchema.enum),
				});
			}
		} else if (hasOwn(subSchema, "const")) {
			// sub has const, sup has enum — check inclusion
			const constInEnum = supSchema.enum.some((v) =>
				deepEqualPrimitive(v, subSchema.const),
			);
			if (!constInEnum) {
				errors.push({
					key: path || "$root",
					expected: formatEnumValues(supSchema.enum),
					received: formatSchemaType(subSchema),
				});
			}
		} else {
			// sup has enum but sub is a plain type (no enum restriction)
			errors.push({
				key: path || "$root",
				expected: formatEnumValues(supSchema.enum),
				received: formatSchemaType(subSchema),
			});
		}
		return errors;
	}

	// ── Const comparison ──
	if (hasOwn(supSchema, "const") && hasOwn(subSchema, "const")) {
		if (!deepEqualPrimitive(supSchema.const, subSchema.const)) {
			errors.push({
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
		errors.push({
			key: path || "$root",
			expected: expectedStr,
			received: receivedStr,
		});
	}

	return errors;
}

// ─── Property Schema Comparison ──────────────────────────────────────────────

/**
 * Compare deux schemas de propriété et produit des erreurs.
 * Gère la récursion dans les objets imbriqués et les tableaux.
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
				(v) => !supSchema.enum?.some((sv) => deepEqualPrimitive(v, sv)),
			);
			if (subExtra.length > 0) {
				return [
					{
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
				deepEqualPrimitive(v, subSchema.const),
			);
			if (!constInEnum) {
				return [
					{
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
				key: path,
				expected: formatEnumValues(supSchema.enum),
				received: formatSchemaType(subSchema),
			},
		];
	}

	// ── Const comparison ──
	if (hasOwn(supSchema, "const") && hasOwn(subSchema, "const")) {
		if (!deepEqualPrimitive(supSchema.const, subSchema.const)) {
			return [
				{
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
 * Quand sup a des branches (anyOf/oneOf), tente de trouver la branche
 * la plus proche et génère les erreurs contre celle-ci.
 *
 * Stratégie : calculer les erreurs pour chaque branche et retourner
 * celles de la branche avec le moins d'erreurs (meilleur match).
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
				key: path || "$root",
				expected: formatSchemaType({ anyOf: branches } as JSONSchema7),
				received: formatSchemaType(sub),
			},
		]
	);
}

// ─── Primitive Deep Equal ────────────────────────────────────────────────────

/**
 * Comparaison d'égalité profonde pour des valeurs JSON primitives et tableaux.
 * Utilisé pour la comparaison d'enums et de consts.
 */
function deepEqualPrimitive(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;
	if (typeof a === "object") {
		if (Array.isArray(a)) {
			if (!Array.isArray(b)) return false;
			if (a.length !== b.length) return false;
			for (let i = 0; i < a.length; i++) {
				if (!deepEqualPrimitive(a[i], b[i])) return false;
			}
			return true;
		}
		if (Array.isArray(b)) return false;
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		if (aKeys.length !== Object.keys(bObj).length) return false;
		for (const key of aKeys) {
			if (!deepEqualPrimitive(aObj[key], bObj[key])) return false;
		}
		return true;
	}
	return false;
}
