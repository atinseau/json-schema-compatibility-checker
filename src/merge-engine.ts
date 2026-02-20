import {
	createComparator,
	createMerger,
	createShallowAllOfMerge,
} from "@x0k/json-schema-merge";
import {
	createDeduplicator,
	createIntersector,
} from "@x0k/json-schema-merge/lib/array";

import type {
	JSONSchema7,
	JSONSchema7Definition,
	JSONSchema7Type,
} from "json-schema";
import get from "lodash/get";
import has from "lodash/has";
import isArray from "lodash/isArray";
import isEqual from "lodash/isEqual";
import isPlainObject from "lodash/isPlainObject";
import keys from "lodash/keys";
import some from "lodash/some";

import { isFormatSubset } from "./format-validator";

// ─── Merge Engine ────────────────────────────────────────────────────────────
//
// Encapsule la librairie `@x0k/json-schema-merge` et expose une API simple
// pour merger et comparer des JSON Schemas.
//
// Principe mathématique :
//   A ∩ B  =  allOf([A, B])  résolu via shallow merge
//   A ≡ B  ⟺  compare(A, B) === 0
//
// Pré-checks avant merge :
//   - `hasDeepConstConflict` : détecte les conflits de `const`/`enum`
//   - `hasAdditionalPropertiesConflict` : détecte les conflits `additionalProperties`
//   - `hasFormatConflict` : détecte les conflits de `format` entre deux schemas

// ─── Const conflict detection ────────────────────────────────────────────────

/**
 * Détecte un conflit de `const` entre deux schemas.
 *
 * Cas 1 — const vs const : les deux schemas ont un `const` avec des valeurs
 *   différentes → intersection vide.
 *
 * Cas 2 — const vs enum : un schema a `const`, l'autre a `enum`.
 *   Si la valeur de `const` n'est pas dans l'`enum` → intersection vide.
 *
 * Utilise `lodash/isEqual` pour la comparaison profonde (objets, tableaux).
 */
function hasConstConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (typeof a === "boolean" || typeof b === "boolean") return false;

	const aHasConst = has(a, "const");
	const bHasConst = has(b, "const");
	const aConst = get(a, "const");
	const bConst = get(b, "const");
	const aEnum: unknown[] | undefined = get(a, "enum");
	const bEnum: unknown[] | undefined = get(b, "enum");

	// Cas 1 — const vs const
	if (aHasConst && bHasConst) {
		return !isEqual(aConst, bConst);
	}

	// Cas 2 — const vs enum
	if (aHasConst && isArray(bEnum)) {
		return !bEnum.some((v) => isEqual(v, aConst));
	}
	if (bHasConst && isArray(aEnum)) {
		return !aEnum.some((v) => isEqual(v, bConst));
	}

	return false;
}

/** Mots-clés contenant un unique sous-schema à vérifier récursivement */
const SINGLE_SCHEMA_CONFLICT_KEYS = [
	"items",
	"additionalProperties",
	"contains",
	"propertyNames",
	"not",
] as const;

/** Mots-clés contenant un Record<string, JSONSchema7Definition> */
const PROPERTIES_MAP_CONFLICT_KEYS = [
	"properties",
	"patternProperties",
] as const;

/**
 * Détecte récursivement les conflits de `const` dans les sous-schemas.
 *
 * Quand la librairie de merge fait un shallow merge, les sous-schemas
 * imbriqués peuvent aussi avoir des conflits de `const` masqués
 * (elle utilise `identity` pour `const`).
 *
 * Récurse dans :
 *   - `properties`, `patternProperties` (clés communes)
 *   - `items` (single schema), tuple `items` (par index)
 *   - `additionalProperties`, `contains`, `propertyNames`, `not`
 */
function hasDeepConstConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (hasConstConflict(a, b)) return true;

	if (typeof a === "boolean" || typeof b === "boolean") return false;

	// ── Single sub-schema keywords ──
	if (
		some(SINGLE_SCHEMA_CONFLICT_KEYS, (key) => {
			const aVal = get(a, key) as JSONSchema7Definition | undefined;
			const bVal = get(b, key) as JSONSchema7Definition | undefined;
			return (
				isPlainObject(aVal) &&
				isPlainObject(bVal) &&
				hasDeepConstConflict(
					aVal as JSONSchema7Definition,
					bVal as JSONSchema7Definition,
				)
			);
		})
	)
		return true;

	// ── Properties-like maps (properties, patternProperties) ──
	if (
		some(PROPERTIES_MAP_CONFLICT_KEYS, (key) => {
			const aMap = get(a, key) as
				| Record<string, JSONSchema7Definition>
				| undefined;
			const bMap = get(b, key) as
				| Record<string, JSONSchema7Definition>
				| undefined;
			if (!isPlainObject(aMap) || !isPlainObject(bMap)) return false;
			const aMapSafe = aMap as Record<string, JSONSchema7Definition>;
			const bMapSafe = bMap as Record<string, JSONSchema7Definition>;
			return some(keys(aMapSafe), (propKey) => {
				const aVal = aMapSafe[propKey];
				const bVal = bMapSafe[propKey];
				return (
					aVal !== undefined &&
					bVal !== undefined &&
					has(bMap, propKey) &&
					hasDeepConstConflict(aVal, bVal)
				);
			});
		})
	)
		return true;

	// ── Tuple items (array of schemas, compared by index) ──
	if (isArray(a.items) && isArray(b.items)) {
		const bItems = b.items as JSONSchema7Definition[];
		if (
			some(a.items as JSONSchema7Definition[], (aItem, idx) => {
				const bItem = bItems[idx];
				return (
					bItem !== undefined &&
					idx < bItems.length &&
					hasDeepConstConflict(aItem, bItem)
				);
			})
		)
			return true;
	}

	return false;
}

// ─── additionalProperties conflict detection ─────────────────────────────────

/**
 * Détecte un conflit entre `additionalProperties` et les propriétés extra
 * **requises** de l'autre schema.
 *
 * ⚠️  Cette fonction est **ultra-conservatrice** : elle ne détecte que les
 * conflits où une propriété est à la fois :
 *   - INTERDITE par `additionalProperties: false` d'un côté
 *   - REQUISE (`required`) par l'autre côté
 *   - ABSENTE des `properties` du côté restrictif
 *   - ET le côté restrictif AUSSI a un `required` qui rend l'objet non-vide
 *     (sinon la librairie gère déjà le cas en excluant les propriétés extra)
 *
 * La librairie de merge (`@x0k/json-schema-merge`) gère DÉJÀ correctement
 * le cas `additionalProperties: false` avec des propriétés simplement DÉFINIES
 * (non requises) dans l'autre schema — elle les exclut du résultat.
 * On ne détecte donc QUE les contradictions `required` impossibles à résoudre.
 *
 * Cas gérés :
 *   1. `a` a `additionalProperties: false` et `b` REQUIERT des propriétés
 *      absentes de `a.properties`, ET ces propriétés sont dans `b.properties`
 *      → conflit certain (intersection vide car b exige, a interdit)
 *   2. Symétrique pour `b.additionalProperties: false`
 *   3. `additionalProperties` comme schema → vérifier la compatibilité de type
 *      des propriétés extra REQUISES uniquement
 *   4. Récursion dans les propriétés communes (sous-objets)
 *
 * ⚠️  Ne vérifie que les clés de `properties`, pas les `patternProperties`
 * (trop complexe à résoudre statiquement).
 *
 * Retourne `true` si un conflit évident est détecté, `false` sinon.
 * En cas de doute → `false` (conservateur, laisser le merge décider).
 *
 * Utilise `_.keys`, `_.some`, `_.every`, `_.has`, `_.get`, `_.isPlainObject`,
 * `_.includes` pour des vérifications concises.
 */
function hasAdditionalPropertiesConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (typeof a === "boolean" || typeof b === "boolean") return false;

	const aProps = isPlainObject(a.properties)
		? (a.properties as Record<string, JSONSchema7Definition>)
		: undefined;
	const bProps = isPlainObject(b.properties)
		? (b.properties as Record<string, JSONSchema7Definition>)
		: undefined;

	// Si aucun des deux n'a de properties, on ne peut rien déterminer
	if (!aProps && !bProps) return false;

	const aKeys = aProps ? keys(aProps) : [];
	const bKeys = bProps ? keys(bProps) : [];
	const aRequired = isArray(a.required) ? (a.required as string[]) : [];
	const bRequired = isArray(b.required) ? (b.required as string[]) : [];

	// ── Vérifier additionalProperties: false de a vs propriétés REQUISES extra de b ──
	// Condition stricte : b doit DÉFINIR la propriété dans b.properties ET la
	// REQUÉRIR dans b.required, ET cette propriété doit être ABSENTE de a.properties.
	// De plus, a doit lui-même avoir des propriétés (sinon on ne peut rien dire).
	if (a.additionalProperties === false && aProps && bProps) {
		const hasRequiredExtra = some(
			bRequired,
			(k) => !has(aProps, k) && has(bProps, k),
		);
		// Ne détecter le conflit que si a a aussi un required qui rend l'objet
		// structurellement contraint (pas un schema vague)
		if (hasRequiredExtra && aKeys.length > 0) return true;
	}

	// ── Vérification du cas additionalProperties comme schema ──
	// Si a.additionalProperties est un schema avec un type, et que b REQUIERT
	// une propriété extra dont le type est incompatible → conflit
	if (
		isPlainObject(a.additionalProperties) &&
		typeof a.additionalProperties !== "boolean" &&
		aProps &&
		bProps
	) {
		const addPropsSchema = a.additionalProperties as JSONSchema7;
		if (has(addPropsSchema, "type")) {
			const addPropsType = addPropsSchema.type;
			const hasTypeConflict = some(bRequired, (k) => {
				if (has(aProps, k)) return false;
				if (!has(bProps, k)) return false;
				const bPropDef = bProps[k];
				if (typeof bPropDef === "boolean") return false;
				const bProp = bPropDef as JSONSchema7;
				if (!has(bProp, "type")) return false;
				if (
					typeof addPropsType === "string" &&
					typeof bProp.type === "string"
				) {
					return (
						addPropsType !== bProp.type &&
						!(addPropsType === "number" && bProp.type === "integer") &&
						!(addPropsType === "integer" && bProp.type === "number")
					);
				}
				return false;
			});
			if (hasTypeConflict) return true;
		}
	}

	// ── Vérification symétrique : additionalProperties de b vs propriétés REQUISES extra de a ──
	if (b.additionalProperties === false && bProps && aProps) {
		const hasRequiredExtra = some(
			aRequired,
			(k) => !has(bProps, k) && has(aProps, k),
		);
		if (hasRequiredExtra && bKeys.length > 0) return true;
	}

	// Symétrique pour additionalProperties comme schema
	if (
		isPlainObject(b.additionalProperties) &&
		typeof b.additionalProperties !== "boolean" &&
		bProps &&
		aProps
	) {
		const addPropsSchema = b.additionalProperties as JSONSchema7;
		if (has(addPropsSchema, "type")) {
			const addPropsType = addPropsSchema.type;
			const hasTypeConflict = some(aRequired, (k) => {
				if (has(bProps, k)) return false;
				if (!has(aProps, k)) return false;
				const aPropDef = aProps[k];
				if (typeof aPropDef === "boolean") return false;
				const aProp = aPropDef as JSONSchema7;
				if (!has(aProp, "type")) return false;
				if (
					typeof addPropsType === "string" &&
					typeof aProp.type === "string"
				) {
					return (
						addPropsType !== aProp.type &&
						!(addPropsType === "number" && aProp.type === "integer") &&
						!(addPropsType === "integer" && aProp.type === "number")
					);
				}
				return false;
			});
			if (hasTypeConflict) return true;
		}
	}

	// ── Récursion dans les propriétés communes ──
	// Si les deux schemas ont des propriétés communes qui sont des objets,
	// vérifier récursivement les conflits additionalProperties
	if (aProps && bProps) {
		if (
			some(aKeys, (k) => {
				if (!has(bProps, k)) return false;
				const aPropDef = aProps[k];
				const bPropDef = bProps[k];
				if (typeof aPropDef === "boolean" || typeof bPropDef === "boolean")
					return false;
				return hasAdditionalPropertiesConflict(
					aPropDef as JSONSchema7Definition,
					bPropDef as JSONSchema7Definition,
				);
			})
		)
			return true;
	}

	return false;
}

// ─── Format conflict detection ───────────────────────────────────────────────

/**
 * Détecte un conflit de format entre deux schemas.
 *
 * ⚠️  Ne se déclenche QUE quand les DEUX schemas ont un `format`.
 * Si un seul schema a un `format`, il n'y a PAS de conflit — le merge
 * engine gère nativement ce cas (le format est conservé dans l'intersection,
 * et la comparaison `merged ≡ sub` détermine correctement la relation ⊆).
 *
 * Deux schemas avec des formats différents et sans relation d'inclusion
 * connue ont une intersection vide (ex: "email" ∩ "ipv4" = ∅).
 *
 * Utilise `isFormatSubset` de `format-validator.ts` pour vérifier la hiérarchie.
 *
 * Récurse dans les sous-schemas (`properties`, `items`, etc.) pour détecter
 * les conflits de format imbriqués.
 *
 * @returns `true` si un conflit de format est détecté, `false` sinon
 */
function hasFormatConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (typeof a === "boolean" || typeof b === "boolean") return false;

	// ── Seulement quand LES DEUX ont un format ──
	// Si un seul a un format → pas de conflit, le merge gère nativement
	if (has(a, "format") && has(b, "format")) {
		const aFormat = a.format as string;
		const bFormat = b.format as string;

		// Même format → pas de conflit
		if (aFormat !== bFormat) {
			// Vérifier si l'un est un sous-ensemble de l'autre via la hiérarchie
			const subsetCheck = isFormatSubset(aFormat, bFormat);
			if (subsetCheck !== true) {
				const reverseCheck = isFormatSubset(bFormat, aFormat);
				if (reverseCheck !== true) {
					// Formats différents sans relation connue → conflit
					return true;
				}
			}
		}
	}

	// ── Récursion dans les sous-schemas ──
	// Vérifier les conflits de format dans les propriétés communes
	if (isPlainObject(a.properties) && isPlainObject(b.properties)) {
		const aMap = a.properties as Record<string, JSONSchema7Definition>;
		const bMap = b.properties as Record<string, JSONSchema7Definition>;
		if (
			some(keys(aMap), (k) => {
				const aVal = aMap[k];
				const bVal = bMap[k];
				return (
					aVal !== undefined &&
					bVal !== undefined &&
					has(bMap, k) &&
					hasFormatConflict(aVal, bVal)
				);
			})
		)
			return true;
	}

	// Vérifier items (single schema)
	if (isPlainObject(a.items) && isPlainObject(b.items)) {
		if (
			hasFormatConflict(
				a.items as JSONSchema7Definition,
				b.items as JSONSchema7Definition,
			)
		)
			return true;
	}

	// Vérifier additionalProperties
	if (
		isPlainObject(a.additionalProperties) &&
		isPlainObject(b.additionalProperties)
	) {
		if (
			hasFormatConflict(
				a.additionalProperties as JSONSchema7Definition,
				b.additionalProperties as JSONSchema7Definition,
			)
		)
			return true;
	}

	return false;
}

// ─── MergeEngine class ───────────────────────────────────────────────────────

export class MergeEngine {
	private readonly compareFn: (
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	) => number;

	private readonly shallowAllOfMergeFn: (
		schema: JSONSchema7 & { allOf: JSONSchema7Definition[] },
	) => JSONSchema7Definition;

	constructor() {
		const { compareSchemaDefinitions, compareSchemaValues } =
			createComparator();

		// ── Null-safe wrapper for compareSchemaValues ──
		// The library's compareSchemaValues has a bug: when both a and b are null,
		// it returns -1 instead of 0 (the null check for `a` fires before checking
		// if `b` is also null). This causes createIntersector to lose null values
		// during enum intersection (the sort-merge join relies on compare(x,x)===0).
		const safeCompareSchemaValues = (
			a: JSONSchema7Type,
			b: JSONSchema7Type,
		): number => {
			if (a === null && b === null) return 0;
			return compareSchemaValues(a, b);
		};

		const { mergeArrayOfSchemaDefinitions } = createMerger({
			intersectJson: createIntersector(safeCompareSchemaValues),
			deduplicateJsonSchemaDef: createDeduplicator(compareSchemaDefinitions),
		});

		this.compareFn = compareSchemaDefinitions;
		this.shallowAllOfMergeFn = createShallowAllOfMerge(
			mergeArrayOfSchemaDefinitions,
		);
	}

	/**
	 * Merge deux schemas via `allOf([a, b])`.
	 * Retourne `null` si les schemas sont incompatibles.
	 *
	 * Post-merge : détecte les conflits de `const` que la librairie
	 * ne capture pas (elle utilise `identity` pour `const`).
	 */
	merge(
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	): JSONSchema7Definition | null {
		// Pré-check : conflit de const détectable avant le merge
		if (hasDeepConstConflict(a, b)) {
			return null;
		}

		// Pré-check : conflit de format (les DEUX ont un format incompatible)
		if (hasFormatConflict(a, b)) {
			return null;
		}

		// Pré-check : conflit additionalProperties vs propriétés REQUISES extra
		// Ne détecte que les cas où une propriété est à la fois interdite
		// (additionalProperties: false) et requise (required) → intersection vide.
		// Les cas où les propriétés sont simplement définies sans être requises
		// sont gérés correctement par la librairie de merge elle-même.
		if (hasAdditionalPropertiesConflict(a, b)) {
			return null;
		}

		try {
			return this.shallowAllOfMergeFn({ allOf: [a, b] });
		} catch {
			return null;
		}
	}

	/**
	 * Merge via `shallowAllOfMerge` — lève une exception si incompatible.
	 * Utile quand on veut capturer l'erreur pour le diagnostic.
	 *
	 * Post-merge : détecte les conflits de `const` et lève une exception.
	 */
	mergeOrThrow(
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	): JSONSchema7Definition {
		// Pré-check : conflit de const
		if (hasDeepConstConflict(a, b)) {
			throw new Error(
				"Incompatible const values: schemas have conflicting const constraints",
			);
		}

		// Pré-check : conflit de format
		if (hasFormatConflict(a, b)) {
			throw new Error(
				"Incompatible format values: schemas have conflicting format constraints",
			);
		}

		// Pré-check : conflit additionalProperties vs propriétés REQUISES extra
		if (hasAdditionalPropertiesConflict(a, b)) {
			throw new Error(
				"Incompatible additionalProperties: required properties conflict with additionalProperties constraint",
			);
		}

		return this.shallowAllOfMergeFn({ allOf: [a, b] });
	}

	/**
	 * Compare structurellement deux schema definitions.
	 * Retourne 0 si elles sont identiques, sinon un entier non nul.
	 */
	compare(a: JSONSchema7Definition, b: JSONSchema7Definition): number {
		return this.compareFn(a, b);
	}

	/**
	 * Vérifie l'égalité structurelle entre deux schema definitions.
	 */
	isEqual(a: JSONSchema7Definition, b: JSONSchema7Definition): boolean {
		return this.compareFn(a, b) === 0;
	}
}
