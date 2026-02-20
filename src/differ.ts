import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import flatMap from "lodash/flatMap";
import isArray from "lodash/isArray";
import isEqual from "lodash/isEqual";
import isPlainObject from "lodash/isPlainObject";
import keys from "lodash/keys";
import union from "lodash/union";
import type { SchemaDiff } from "./types";

// ─── Schema Differ ───────────────────────────────────────────────────────────
//
// Calcul des différences structurelles entre un schema original et son
// intersection (merged). Utilisé pour produire des diagnostics lisibles
// quand sub ⊄ sup.
//
// Utilise lodash massivement :
//   - `_.isEqual`       pour la comparaison profonde (remplace JSON.stringify — Point 9)
//   - `_.union`         pour fusionner les ensembles de clés
//   - `_.keys`          pour extraire les clés d'un objet
//   - `_.isPlainObject` pour détecter les sous-schemas récursables
//   - `_.isArray`       pour distinguer tableaux de strings vs schemas dans `dependencies`
//   - `_.has`           pour vérifier l'existence d'une clé
//   - `_.flatMap`       pour aplatir les diffs récursifs
//   - `_.forEach`       pour itérer sur les clés

// ─── Recursive diff keys ─────────────────────────────────────────────────────

/** Mots-clés dont la valeur est un sous-schema unique (récursion possible) */
const RECURSIVE_KEYS: ReadonlySet<string> = new Set([
	"items",
	"additionalProperties",
	"additionalItems",
	"contains",
	"propertyNames",
	"not",
	"if",
	"then",
	"else",
]);

/**
 * Mots-clés dont la valeur est un `Record<string, JSONSchema7Definition>`
 * — chaque entrée est un sous-schema dans lequel on doit récurser
 * individuellement (properties, patternProperties, dependencies).
 *
 * Point 2 — patternProperties ajouté ici.
 * Point 3 — dependencies ajouté ici (avec gestion spéciale forme tableau).
 */
const PROPERTIES_LIKE_KEYS: ReadonlySet<string> = new Set([
	"properties",
	"patternProperties",
	"dependencies",
]);

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Vérifie si un mot-clé pointe vers un sous-schema unique récursable.
 * Utilise `_.isPlainObject` pour s'assurer que les deux valeurs sont
 * des objets (pas des tableaux, pas null).
 */
function canRecurseInto(
	key: string,
	origVal: unknown,
	mergedVal: unknown,
): boolean {
	return (
		RECURSIVE_KEYS.has(key) &&
		isPlainObject(origVal) &&
		isPlainObject(mergedVal)
	);
}

/**
 * Vérifie si un mot-clé pointe vers un objet de propriétés
 * (`properties`, `patternProperties`, `dependencies`).
 *
 * Utilise `_.includes` sur le Set pour une vérification concise.
 */
function isPropertiesLikeObject(
	key: string,
	origVal: unknown,
	mergedVal: unknown,
): boolean {
	return (
		PROPERTIES_LIKE_KEYS.has(key) &&
		isPlainObject(origVal) &&
		isPlainObject(mergedVal)
	);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calcule les différences structurelles entre le schema original et le schema
 * mergé (intersection). Récurse dans properties, patternProperties,
 * dependencies et les sous-schemas.
 *
 * @param original  Le schema original (sub)
 * @param merged    Le schema résultant de l'intersection allOf(sub, sup)
 * @param path      Chemin JSON-path courant (vide à la racine)
 *
 * Point 9 — Utilise `_.isEqual` au lieu de `JSON.stringify` pour comparer
 * les valeurs, ce qui élimine la dépendance à l'ordre des clés.
 */
export function computeDiffs(
	original: JSONSchema7Definition,
	merged: JSONSchema7Definition,
	path: string,
): SchemaDiff[] {
	// Cas boolean schemas
	if (typeof original === "boolean" || typeof merged === "boolean") {
		if (original !== merged) {
			return [
				{
					path: path || "$",
					type: "changed",
					expected: original,
					actual: merged,
				},
			];
		}
		return [];
	}

	// Collecter toutes les clés des deux schemas via `_.union` + `_.keys`
	const allKeys = union(keys(original), keys(merged)) as (keyof JSONSchema7)[];

	return flatMap(allKeys, (key): SchemaDiff[] => {
		const currentPath = path ? `${path}.${key}` : key;
		const origVal = original[key];
		const mergedVal = merged[key];

		// Clé ajoutée par le merge
		if (origVal === undefined && mergedVal !== undefined) {
			return [
				{
					path: currentPath,
					type: "added",
					expected: undefined,
					actual: mergedVal,
				},
			];
		}

		// Clé supprimée par le merge
		if (origVal !== undefined && mergedVal === undefined) {
			return [
				{
					path: currentPath,
					type: "removed",
					expected: origVal,
					actual: undefined,
				},
			];
		}

		// Les deux sont définies — vérifier si elles diffèrent
		// Point 9 : `_.isEqual` remplace `JSON.stringify` pour une comparaison
		// profonde indépendante de l'ordre des clés
		if (
			origVal !== undefined &&
			mergedVal !== undefined &&
			!isEqual(origVal, mergedVal)
		) {
			// Récurser dans les sous-schemas uniques
			if (canRecurseInto(key, origVal, mergedVal)) {
				return computeDiffs(
					origVal as JSONSchema7Definition,
					mergedVal as JSONSchema7Definition,
					currentPath,
				);
			}

			// Récurser dans les objets de propriétés (properties, patternProperties, dependencies)
			if (isPropertiesLikeObject(key, origVal, mergedVal)) {
				return computePropertyDiffs(
					origVal as Record<string, JSONSchema7Definition>,
					mergedVal as Record<string, JSONSchema7Definition>,
					currentPath,
					key,
				);
			}

			// Valeur scalaire ou structure non-récursable
			return [
				{
					path: currentPath,
					type: "changed",
					expected: origVal,
					actual: mergedVal,
				},
			];
		}

		// Pas de diff pour cette clé
		return [];
	});
}

// ─── Property-level diffs ────────────────────────────────────────────────────

/**
 * Calcule les diffs pour un objet de type `properties` / `patternProperties` /
 * `dependencies`, en récursant dans chaque entrée via `computeDiffs`.
 *
 * Point 3 — Pour `dependencies`, gère les deux formes :
 *   - Forme 1 (tableau de strings) : comparaison directe via `_.isEqual`
 *   - Forme 2 (sous-schema) : récursion via `computeDiffs`
 *
 * Utilise `_.union` + `_.keys` pour fusionner les clés des deux côtés,
 * et `_.flatMap` pour produire un tableau aplati de diffs.
 */
function computePropertyDiffs(
	original: Record<string, JSONSchema7Definition | string[]>,
	merged: Record<string, JSONSchema7Definition | string[]>,
	basePath: string,
	parentKey: string,
): SchemaDiff[] {
	const allPropKeys = union(keys(original), keys(merged));

	return flatMap(allPropKeys, (key): SchemaDiff[] => {
		const currentPath = `${basePath}.${key}`;
		const origVal = original[key];
		const mergedVal = merged[key];

		if (origVal === undefined && mergedVal !== undefined) {
			return [
				{
					path: currentPath,
					type: "added",
					expected: undefined,
					actual: mergedVal,
				},
			];
		}

		if (origVal !== undefined && mergedVal === undefined) {
			return [
				{
					path: currentPath,
					type: "removed",
					expected: origVal,
					actual: undefined,
				},
			];
		}

		if (origVal !== undefined && mergedVal !== undefined) {
			// Pour `dependencies`, les valeurs peuvent être des tableaux de strings (forme 1)
			// On ne récurse que si les deux valeurs sont des objets (sous-schemas)
			if (
				parentKey === "dependencies" &&
				(isArray(origVal) || isArray(mergedVal))
			) {
				// Comparaison directe pour les tableaux de strings
				if (!isEqual(origVal, mergedVal)) {
					return [
						{
							path: currentPath,
							type: "changed",
							expected: origVal,
							actual: mergedVal,
						},
					];
				}
				return [];
			}

			// Récursion standard pour les sous-schemas
			return computeDiffs(
				origVal as JSONSchema7Definition,
				mergedVal as JSONSchema7Definition,
				currentPath,
			);
		}

		return [];
	});
}
