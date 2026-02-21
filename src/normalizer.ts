import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { deepEqual, hasOwn, isPlainObj } from "./utils";

// ─── Schema Normalizer ───────────────────────────────────────────────────────
//
// Fonctions pures pour normaliser un JSON Schema :
//   - Inférer `type` depuis `const` ou `enum`
//   - Récurser dans toutes les sous-structures (properties, items, anyOf, etc.)
//   - Résoudre la double négation `not.not` → aplatir en contenu direct
//   - Récurser dans `patternProperties` (Point 2)
//   - Récurser dans `dependencies` forme schema (Point 3)
//
// Utilise des méthodes natives JS pour des performances optimales.
// Les mutations sont faites in-place sur une copie shallow du schema d'entrée
// pour éviter les allocations inutiles de spreads répétés.

// ─── Type inference ──────────────────────────────────────────────────────────

/**
 * Infère le type JSON Schema d'une valeur JavaScript.
 */
export function inferType(value: unknown): string | undefined {
	if (value === null) return "null";
	switch (typeof value) {
		case "string":
			return "string";
		case "number":
			return Number.isInteger(value) ? "integer" : "number";
		case "boolean":
			return "boolean";
		case "object":
			return Array.isArray(value) ? "array" : "object";
		default:
			return undefined;
	}
}

// ─── Sub-schema keywords ─────────────────────────────────────────────────────

/** Mots-clés contenant un unique sous-schema */
const SINGLE_SCHEMA_KEYWORDS = [
	"additionalProperties",
	"additionalItems",
	"contains",
	"propertyNames",
	"not",
	"if",
	"then",
	"else",
] as const;

/**
 * Vérifie si un schema ne contient qu'un seul mot-clé `not` (et aucun
 * autre mot-clé significatif). Utilisé pour la résolution de double négation.
 *
 * Un schema « pur not » est de la forme `{ not: X }` sans aucune autre
 * contrainte. Dans ce cas, `{ not: { not: Y } }` ≡ `Y`.
 *
 * Les mots-clés de métadonnée (`$id`, `$schema`, `$comment`, `title`,
 * `description`, `default`, `examples`, `definitions`, `$defs`) ne sont
 * PAS considérés comme significatifs pour cette détection.
 */
const METADATA_KEYWORDS = new Set([
	"$id",
	"$schema",
	"$comment",
	"title",
	"description",
	"default",
	"examples",
	"definitions",
	"$defs",
]);

/**
 * Vérifie si un objet schema ne contient que le mot-clé `not`
 * (plus éventuellement des métadonnées non significatives).
 */
function isPureNotSchema(schema: JSONSchema7): boolean {
	const schemaKeys = Object.keys(schema);
	return schemaKeys.every((k) => k === "not" || METADATA_KEYWORDS.has(k));
}

/** Mots-clés contenant un tableau de sous-schemas */
const ARRAY_SCHEMA_KEYWORDS = ["anyOf", "oneOf", "allOf"] as const;

/**
 * Mots-clés contenant un Record<string, JSONSchema7Definition>
 * (chaque valeur est un sous-schema à normaliser récursivement).
 */
const PROPERTIES_LIKE_KEYWORDS = ["properties", "patternProperties"] as const;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Normalise un `Record<string, JSONSchema7Definition>` en appliquant
 * `normalize` à chaque valeur.
 * Retourne l'objet original si rien n'a changé (évite les allocations).
 */
function normalizePropertiesMap(
	props: Record<string, JSONSchema7Definition>,
): Record<string, JSONSchema7Definition> {
	const keys = Object.keys(props);
	let changed = false;
	const result: Record<string, JSONSchema7Definition> = {};

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (key === undefined) continue;
		const original = props[key];
		const normalized = normalize(original as JSONSchema7Definition);
		result[key] = normalized;
		if (normalized !== original) changed = true;
	}

	return changed ? result : props;
}

/**
 * Infère le `type` depuis `const` si absent.
 * Retourne le type inféré ou undefined si non applicable.
 */
function inferTypeFromConst(
	schema: JSONSchema7,
): JSONSchema7["type"] | undefined {
	if (!hasOwn(schema, "const") || schema.type !== undefined) return undefined;
	const t = inferType(schema.const);
	return t ? (t as JSONSchema7["type"]) : undefined;
}

/**
 * Infère le `type` depuis `enum` si absent.
 * Retourne le type inféré (single ou array) ou undefined si non applicable.
 */
function inferTypeFromEnum(
	schema: JSONSchema7,
): JSONSchema7["type"] | undefined {
	if (!Array.isArray(schema.enum) || schema.type !== undefined)
		return undefined;

	const typesSet = new Set<string>();
	for (const v of schema.enum) {
		const t = inferType(v);
		if (t) typesSet.add(t);
	}

	const count = typesSet.size;
	if (count === 0) return undefined;

	const types = Array.from(typesSet);
	if (count === 1) return types[0] as JSONSchema7["type"];
	return types as JSONSchema7["type"];
}

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Normalise un schema : infère `type` depuis `const`/`enum`,
 * et normalise récursivement tous les sous-schemas.
 *
 * Récurse dans :
 *   - `properties` et `patternProperties` (Point 2)
 *   - `dependencies` forme schema (Point 3) — les valeurs tableau (forme 1)
 *     sont laissées intactes
 *   - `items` (single ou tuple)
 *   - Mots-clés single-schema (`additionalProperties`, `not`, `if`, etc.)
 *   - Mots-clés array-of-schema (`anyOf`, `oneOf`, `allOf`)
 *
 * Optimisation : on fait une seule copie shallow au début, puis on mute
 * in-place au lieu de créer un nouvel objet à chaque modification.
 * Les sous-structures (properties, items, etc.) ne sont remplacées
 * que si elles ont effectivement changé.
 */
export function normalize(def: JSONSchema7Definition): JSONSchema7Definition {
	if (typeof def === "boolean") return def;

	// Single shallow copy — all mutations happen on this object
	const schema = { ...def } as JSONSchema7 & Record<string, unknown>;

	// ── Inférer type depuis const ──
	const typeFromConst = inferTypeFromConst(schema);
	if (typeFromConst) {
		schema.type = typeFromConst;
	}

	// ── Inférer type depuis enum ──
	const typeFromEnum = inferTypeFromEnum(schema);
	if (typeFromEnum) {
		schema.type = typeFromEnum;
	}

	// ── Convertir enum à un seul élément en const ──
	// Sémantiquement, { enum: [X] } ≡ { const: X }.
	// Cette normalisation garantit que la comparaison structurelle
	// (isEqual) ne produit pas de faux négatifs quand un schema utilise
	// enum et l'autre utilise const pour la même valeur.
	if (
		Array.isArray(schema.enum) &&
		schema.enum.length === 1 &&
		!hasOwn(schema, "const")
	) {
		schema.const = schema.enum[0];
		delete schema.enum;
	}

	// ── Strip redundant enum when const is present ──
	// Si `const: X` et `enum: [... X ...]` coexistent, `const` est plus
	// restrictif → `enum` est redondant. Le merge engine peut produire
	// cette combinaison lors de l'intersection const ∩ enum.
	if (hasOwn(schema, "const") && Array.isArray(schema.enum)) {
		if (schema.enum.some((v) => deepEqual(v, schema.const))) {
			delete schema.enum;
		}
	}

	// ── Récurser dans properties & patternProperties (Point 2) ──
	for (const keyword of PROPERTIES_LIKE_KEYWORDS) {
		const val = schema[keyword];
		if (isPlainObj(val)) {
			const normalized = normalizePropertiesMap(
				val as Record<string, JSONSchema7Definition>,
			);
			if (normalized !== val) {
				schema[keyword] = normalized as JSONSchema7["properties"];
			}
		}
	}

	// ── Récurser dans dependencies (Point 3) ──
	// `dependencies` peut contenir :
	//   - Forme 1 (property deps) : { foo: ["bar", "baz"] } → tableau de strings, on skip
	//   - Forme 2 (schema deps) : { foo: { required: [...] } } → objet schema, on normalise
	if (isPlainObj(schema.dependencies)) {
		const deps = schema.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const depsKeys = Object.keys(deps);
		let depsChanged = false;
		const newDeps: Record<string, JSONSchema7Definition | string[]> = {};

		for (let i = 0; i < depsKeys.length; i++) {
			const key = depsKeys[i];
			if (key === undefined) continue;
			const val = deps[key];
			if (val === undefined) continue;
			if (Array.isArray(val)) {
				// Forme 1 : tableau de strings → laisser tel quel
				newDeps[key] = val;
			} else if (isPlainObj(val)) {
				// Forme 2 : sous-schema → normaliser récursivement
				const normalized = normalize(val as JSONSchema7Definition);
				newDeps[key] = normalized;
				if (normalized !== val) depsChanged = true;
			} else {
				newDeps[key] = val as JSONSchema7Definition;
			}
		}

		if (depsChanged) {
			schema.dependencies = newDeps;
		}
	}

	// ── Récurser dans items (tuple ou single) ──
	if (schema.items) {
		if (Array.isArray(schema.items)) {
			// Tuple : normaliser chaque élément
			const items = schema.items as JSONSchema7Definition[];
			let itemsChanged = false;
			const newItems: JSONSchema7Definition[] = new Array(items.length);

			for (let i = 0; i < items.length; i++) {
				const original = items[i];
				if (original === undefined) continue;
				const normalized = normalize(original);
				newItems[i] = normalized;
				if (normalized !== original) itemsChanged = true;
			}

			if (itemsChanged) {
				schema.items = newItems;
			}
		} else if (isPlainObj(schema.items)) {
			// Single items schema
			const normalized = normalize(schema.items as JSONSchema7Definition);
			if (normalized !== schema.items) {
				schema.items = normalized;
			}
		}
	}

	// ── Récurser dans les mots-clés single-schema ──
	for (const key of SINGLE_SCHEMA_KEYWORDS) {
		const val = schema[key];
		if (val !== undefined && typeof val !== "boolean") {
			const normalized = normalize(val as JSONSchema7Definition);
			if (normalized !== val) {
				(schema as Record<string, JSONSchema7Definition>)[key] = normalized;
			}
		}
	}

	// ── Résoudre la double négation not(not(X)) → X ──
	// Après la récursion dans les sous-schemas, `schema.not` est normalisé.
	// Si `schema.not` est un objet qui ne contient QUE `not` (un « pur not »),
	// alors `{ ...rest, not: { not: X } }` ≡ `{ ...rest, ...X }`.
	//
	// Logique propositionnelle : ¬¬P ≡ P
	//
	// On ne résout que le cas « pur » (schema.not n'a que `not` comme clé
	// significative) pour éviter les faux-positifs dans les cas complexes.
	if (
		hasOwn(schema, "not") &&
		isPlainObj(schema.not) &&
		typeof schema.not !== "boolean"
	) {
		const notSchema = schema.not as JSONSchema7;
		if (
			hasOwn(notSchema, "not") &&
			isPureNotSchema(notSchema) &&
			isPlainObj(notSchema.not) &&
			typeof notSchema.not !== "boolean"
		) {
			// Extraire le contenu de not.not et le fusionner avec le reste du schema
			const innerSchema = notSchema.not as JSONSchema7;
			// Retirer `not` du schema courant
			delete schema.not;
			// Fusionner le contenu interne dans le schema courant
			const innerKeys = Object.keys(innerSchema);
			for (let i = 0; i < innerKeys.length; i++) {
				const ik = innerKeys[i];
				if (ik === undefined) continue;
				(schema as Record<string, unknown>)[ik] = (
					innerSchema as Record<string, unknown>
				)[ik];
			}
		}
	}

	// ── Récurser dans les mots-clés array-of-schema ──
	for (const key of ARRAY_SCHEMA_KEYWORDS) {
		const val = schema[key];
		if (Array.isArray(val)) {
			const arr = val as JSONSchema7Definition[];
			let arrChanged = false;
			const newArr: JSONSchema7Definition[] = new Array(arr.length);

			for (let i = 0; i < arr.length; i++) {
				const original = arr[i];
				if (original === undefined) continue;
				const normalized = normalize(original);
				newArr[i] = normalized;
				if (normalized !== original) arrChanged = true;
			}

			if (arrChanged) {
				schema[key] = newArr;
			}
		}
	}

	return schema as JSONSchema7Definition;
}
