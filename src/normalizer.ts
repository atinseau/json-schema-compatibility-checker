import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import compact from "lodash/compact";
import first from "lodash/first";
import has from "lodash/has";
import isArray from "lodash/isArray";
import isEmpty from "lodash/isEmpty";
import isEqual from "lodash/isEqual";
import isPlainObject from "lodash/isPlainObject";
import keys from "lodash/keys";
import map from "lodash/map";
import mapValues from "lodash/mapValues";
import omit from "lodash/omit";
import reduce from "lodash/reduce";
import size from "lodash/size";
import some from "lodash/some";
import uniq from "lodash/uniq";

// ─── Schema Normalizer ───────────────────────────────────────────────────────
//
// Fonctions pures pour normaliser un JSON Schema :
//   - Inférer `type` depuis `const` ou `enum`
//   - Récurser dans toutes les sous-structures (properties, items, anyOf, etc.)
//   - Résoudre la double négation `not.not` → aplatir en contenu direct
//   - Récurser dans `patternProperties` (Point 2)
//   - Récurser dans `dependencies` forme schema (Point 3)
//
// Utilise lodash massivement pour réduire la complexité et améliorer
// la lisibilité des transformations sur les objets et tableaux.

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
			return isArray(value) ? "array" : "object";
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
	const schemaKeys = keys(schema);
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
 * `normalize` à chaque valeur via `lodash/mapValues`.
 */
function normalizePropertiesMap(
	props: Record<string, JSONSchema7Definition>,
): Record<string, JSONSchema7Definition> {
	return mapValues(props, (v) => normalize(v as JSONSchema7Definition));
}

/**
 * Infère le `type` depuis `const` si absent.
 * Retourne le type inféré ou undefined si non applicable.
 */
function inferTypeFromConst(
	schema: JSONSchema7,
): JSONSchema7["type"] | undefined {
	if (!has(schema, "const") || schema.type !== undefined) return undefined;
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
	if (!isArray(schema.enum) || schema.type !== undefined) return undefined;

	const types = uniq(compact(map(schema.enum, (v) => inferType(v))));
	const count = size(types);

	if (count === 1) return first(types) as JSONSchema7["type"];
	if (count > 1) return types as JSONSchema7["type"];
	return undefined;
}

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Normalise un schema : infère `type` depuis `const`/`enum`,
 * et normalise récursivement tous les sous-schemas.
 *
 * Récurse dans :
 *   - `properties` et `patternProperties` (Point 2) via `_.mapValues`
 *   - `dependencies` forme schema (Point 3) — les valeurs tableau (forme 1)
 *     sont laissées intactes
 *   - `items` (single ou tuple)
 *   - Mots-clés single-schema (`additionalProperties`, `not`, `if`, etc.)
 *   - Mots-clés array-of-schema (`anyOf`, `oneOf`, `allOf`)
 */
export function normalize(def: JSONSchema7Definition): JSONSchema7Definition {
	if (typeof def === "boolean") return def;

	let schema = { ...def };

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
		isArray(schema.enum) &&
		size(schema.enum) === 1 &&
		!has(schema, "const")
	) {
		schema = {
			...(omit(schema, ["enum"]) as JSONSchema7),
			const: schema.enum[0],
		};
	}

	// ── Strip redundant enum when const is present ──
	// Si `const: X` et `enum: [... X ...]` coexistent, `const` est plus
	// restrictif → `enum` est redondant. Le merge engine peut produire
	// cette combinaison lors de l'intersection const ∩ enum.
	if (has(schema, "const") && isArray(schema.enum)) {
		if (some(schema.enum, (v) => isEqual(v, schema.const))) {
			schema = omit(schema, ["enum"]) as JSONSchema7;
		}
	}

	// ── Récurser dans properties & patternProperties (Point 2) ──
	// Utilise `_.mapValues` pour transformer chaque sous-schema en une seule passe
	for (const keyword of PROPERTIES_LIKE_KEYWORDS) {
		const val = schema[keyword];
		if (isPlainObject(val)) {
			schema = {
				...schema,
				[keyword]: normalizePropertiesMap(
					val as Record<string, JSONSchema7Definition>,
				),
			};
		}
	}

	// ── Récurser dans dependencies (Point 3) ──
	// `dependencies` peut contenir :
	//   - Forme 1 (property deps) : { foo: ["bar", "baz"] } → tableau de strings, on skip
	//   - Forme 2 (schema deps) : { foo: { required: [...] } } → objet schema, on normalise
	if (isPlainObject(schema.dependencies)) {
		schema = {
			...schema,
			dependencies: mapValues(
				schema.dependencies as Record<string, JSONSchema7Definition | string[]>,
				(val) => {
					// Forme 1 : tableau de strings → laisser tel quel
					if (isArray(val)) return val;
					// Forme 2 : sous-schema → normaliser récursivement
					if (isPlainObject(val))
						return normalize(val as JSONSchema7Definition);
					return val;
				},
			),
		};
	}

	// ── Récurser dans items (tuple ou single) ──
	if (schema.items) {
		if (isArray(schema.items)) {
			// Tuple : normaliser chaque élément via `_.map`
			schema = {
				...schema,
				items: map(schema.items as JSONSchema7Definition[], (it) =>
					normalize(it),
				),
			};
		} else if (isPlainObject(schema.items)) {
			// Single items schema
			schema = {
				...schema,
				items: normalize(schema.items as JSONSchema7Definition),
			};
		}
	}

	// ── Récurser dans les mots-clés single-schema ──
	// Utilise `_.reduce` pour accumuler les transformations en une seule passe
	schema = reduce(
		SINGLE_SCHEMA_KEYWORDS,
		(acc, key) => {
			const val = acc[key];
			if (val !== undefined && typeof val !== "boolean") {
				return {
					...acc,
					[key]: normalize(val as JSONSchema7Definition),
				};
			}
			return acc;
		},
		schema,
	);

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
		has(schema, "not") &&
		isPlainObject(schema.not) &&
		typeof schema.not !== "boolean"
	) {
		const notSchema = schema.not as JSONSchema7;
		if (
			has(notSchema, "not") &&
			isPureNotSchema(notSchema) &&
			isPlainObject(notSchema.not) &&
			typeof notSchema.not !== "boolean"
		) {
			// Extraire le contenu de not.not et le fusionner avec le reste du schema
			const innerSchema = notSchema.not as JSONSchema7;
			// Retirer `not` du schema courant et spreader le contenu interne
			const withoutNot = omit(schema, ["not"]) as JSONSchema7;
			// Si le schema courant n'avait QUE `not` → remplacer entièrement par le contenu interne
			if (isEmpty(keys(withoutNot))) {
				schema = { ...innerSchema };
			} else {
				// Le schema a d'autres contraintes → fusionner (allOf implicite)
				schema = { ...withoutNot, ...innerSchema };
			}
		}
	}

	// ── Récurser dans les mots-clés array-of-schema ──
	// Utilise `_.reduce` + `_.map` pour transformer chaque branche
	schema = reduce(
		ARRAY_SCHEMA_KEYWORDS,
		(acc, key) => {
			const val = acc[key];
			if (isArray(val)) {
				return {
					...acc,
					[key]: map(val as JSONSchema7Definition[], (s) => normalize(s)),
				};
			}
			return acc;
		},
		schema,
	);

	return schema;
}
