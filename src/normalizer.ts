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
// Optimisations :
//   - WeakMap cache pour éviter de re-normaliser le même objet
//   - Lazy copy-on-write : ne crée une copie que si des mutations sont nécessaires
//   - Retourne l'original si rien n'a changé (évite les allocations)

// ─── Normalization Cache ─────────────────────────────────────────────────────

/**
 * Cache WeakMap pour les résultats de normalisation.
 * Évite de re-normaliser le même objet schema plusieurs fois.
 * WeakMap permet au GC de collecter les schemas qui ne sont plus référencés.
 */
const normalizeCache = new WeakMap<object, JSONSchema7Definition>();

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

	// First pass: detect if anything changes (sub-schemas get cached)
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (key === undefined) continue;
		const original = props[key];
		const normalized = normalize(original as JSONSchema7Definition);
		if (normalized !== original) {
			changed = true;
			break;
		}
	}

	if (!changed) return props;

	// Build result only when something changed (sub normalize calls hit cache)
	const result: Record<string, JSONSchema7Definition> = {};
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (key === undefined) continue;
		result[key] = normalize(props[key] as JSONSchema7Definition);
	}

	return result;
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
 * Optimisations :
 *   - WeakMap cache : retourne le résultat mis en cache en O(1)
 *   - Lazy copy-on-write : ne crée une copie shallow que quand la première
 *     mutation est nécessaire, via `ensureCopy()`
 *   - Les sous-structures ne sont remplacées que si effectivement changées
 */
export function normalize(def: JSONSchema7Definition): JSONSchema7Definition {
	if (typeof def === "boolean") return def;

	// ── Cache lookup (O(1) fast path) ──
	const cached = normalizeCache.get(def);
	if (cached !== undefined) return cached;

	// ── Lazy copy-on-write ──
	// We delay creating a shallow copy until the first actual mutation.
	// `schema` starts as `def` and only becomes a copy when `ensureCopy()` is called.
	let schema = def as JSONSchema7 & Record<string, unknown>;
	let copied = false;

	function ensureCopy(): JSONSchema7 & Record<string, unknown> {
		if (!copied) {
			schema = { ...(def as JSONSchema7) } as JSONSchema7 &
				Record<string, unknown>;
			copied = true;
		}
		return schema;
	}

	// ── Inférer type depuis const ──
	const typeFromConst = inferTypeFromConst(schema);
	if (typeFromConst) {
		ensureCopy().type = typeFromConst;
	}

	// ── Inférer type depuis enum ──
	const typeFromEnum = inferTypeFromEnum(schema);
	if (typeFromEnum) {
		ensureCopy().type = typeFromEnum;
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
		const s = ensureCopy();
		s.const = schema.enum[0];
		delete s.enum;
	}

	// ── Strip redundant enum when const is present ──
	// Si `const: X` et `enum: [... X ...]` coexistent, `const` est plus
	// restrictif → `enum` est redondant. Le merge engine peut produire
	// cette combinaison lors de l'intersection const ∩ enum.
	if (hasOwn(schema, "const") && Array.isArray(schema.enum)) {
		if (schema.enum.some((v) => deepEqual(v, schema.const))) {
			delete ensureCopy().enum;
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
				ensureCopy()[keyword] = normalized as JSONSchema7["properties"];
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
			ensureCopy().dependencies = newDeps;
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
				ensureCopy().items = newItems;
			}
		} else if (isPlainObj(schema.items)) {
			// Single items schema
			const normalized = normalize(schema.items as JSONSchema7Definition);
			if (normalized !== schema.items) {
				ensureCopy().items = normalized;
			}
		}
	}

	// ── Récurser dans les mots-clés single-schema ──
	for (const key of SINGLE_SCHEMA_KEYWORDS) {
		const val = schema[key];
		if (val !== undefined && typeof val !== "boolean") {
			const normalized = normalize(val as JSONSchema7Definition);
			if (normalized !== val) {
				(ensureCopy() as Record<string, JSONSchema7Definition>)[key] =
					normalized;
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
			const s = ensureCopy();
			// Retirer `not` du schema courant
			delete s.not;
			// Fusionner le contenu interne dans le schema courant
			const innerKeys = Object.keys(innerSchema);
			for (let i = 0; i < innerKeys.length; i++) {
				const ik = innerKeys[i];
				if (ik === undefined) continue;
				(s as Record<string, unknown>)[ik] = (
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
				ensureCopy()[key] = newArr;
			}
		}
	}

	// ── Determine result ──
	// If nothing changed (copied === false), return the original def.
	// Otherwise, return the mutated copy.
	const result = (copied ? schema : def) as JSONSchema7Definition;

	// ── Cache the result ──
	normalizeCache.set(def, result);

	return result;
}
