import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { SchemaDiff } from "./types";
import { deepEqual, isPlainObj, unionStrings } from "./utils";

// ─── Schema Differ ───────────────────────────────────────────────────────────
//
// Calcul des différences structurelles entre un schema original et son
// intersection (merged). Utilisé pour produire des diagnostics lisibles
// quand sub ⊄ sup.
//
// Utilise des méthodes natives JS pour des performances optimales.

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
 * Mots-clés dont la valeur est un `Record<string, JSONSchema7Definition>`.
 * Chaque propriété est un sous-schema → récursion au niveau des clés.
 *
 * `dependencies` est inclus ici avec une gestion spéciale (forme tableau
 * vs forme schema) dans
 `computePropertyDiffs`.
 *
 * Point 3 — dependencies ajouté ici (avec gestion spéciale forme tableau).
 */
const PROPERTIES_LIKE_KEYS: ReadonlySet<string> = new Set([
	"properties",
	"patternProperties",
	"dependencies",
]);

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Vérifie si on peut récurser dans un mot-clé single-schema :
 * la clé doit être dans RECURSIVE_KEYS et les deux valeurs doivent être
 * des objets (pas des tableaux, pas null).
 */
function canRecurseInto(
	key: string,
	origVal: unknown,
	mergedVal: unknown,
): boolean {
	return (
		RECURSIVE_KEYS.has(key) && isPlainObj(origVal) && isPlainObj(mergedVal)
	);
}

/**
 * Vérifie si un mot-clé est un objet de propriétés récursable.
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
		isPlainObj(origVal) &&
		isPlainObj(mergedVal)
	);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compare un schema original avec sa version mergée et retourne la liste
 * des différences structurelles.
 *
 * @param original  Le schema sub tel qu'il était avant le merge
 * @param merged    Le schema résultant de l'intersection allOf(sub, sup)
 * @param path      Chemin JSON-path courant (vide à la racine)
 *
 * Point 9 — Utilise `deepEqual` au lieu de `JSON.stringify` pour comparer
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

	// Collecter toutes les clés des deux schemas
	const allKeys = unionStrings(
		Object.keys(original),
		Object.keys(merged),
	) as (keyof JSONSchema7)[];

	const result: SchemaDiff[] = [];
	for (const key of allKeys) {
		const currentPath = path ? `${path}.${key}` : key;
		const origVal = original[key];
		const mergedVal = merged[key];

		// Clé ajoutée par le merge
		if (origVal === undefined && mergedVal !== undefined) {
			result.push({
				path: currentPath,
				type: "added",
				expected: undefined,
				actual: mergedVal,
			});
			continue;
		}

		// Clé supprimée par le merge
		if (origVal !== undefined && mergedVal === undefined) {
			result.push({
				path: currentPath,
				type: "removed",
				expected: origVal,
				actual: undefined,
			});
			continue;
		}

		// Les deux sont définies — vérifier si elles diffèrent
		// Point 9 : deepEqual pour une comparaison profonde indépendante de l'ordre des clés
		if (
			origVal !== undefined &&
			mergedVal !== undefined &&
			!deepEqual(origVal, mergedVal)
		) {
			// Récurser dans les sous-schemas uniques
			if (canRecurseInto(key, origVal, mergedVal)) {
				const sub = computeDiffs(
					origVal as JSONSchema7Definition,
					mergedVal as JSONSchema7Definition,
					currentPath,
				);
				for (const d of sub) result.push(d);
				continue;
			}

			// Récurser dans les objets de propriétés (properties, patternProperties, dependencies)
			if (isPropertiesLikeObject(key, origVal, mergedVal)) {
				const sub = computePropertyDiffs(
					origVal as Record<string, JSONSchema7Definition>,
					mergedVal as Record<string, JSONSchema7Definition>,
					currentPath,
					key,
				);
				for (const d of sub) result.push(d);
				continue;
			}

			// Valeur scalaire ou structure non-récursable
			result.push({
				path: currentPath,
				type: "changed",
				expected: origVal,
				actual: mergedVal,
			});
		}
	}

	return result;
}

// ─── Property-level diffs ────────────────────────────────────────────────────

/**
 * Calcule les diffs au niveau des propriétés d'un objet `properties`,
 * `patternProperties`, ou `dependencies`.
 *
 * Pour `dependencies` (Point 3), gère les deux formes :
 *   - Forme 1 (tableau de strings) : comparaison directe via `deepEqual`
 *   - Forme 2 (sous-schema) : récursion via `computeDiffs`
 *
 * Fusionne les clés des deux côtés et produit un tableau aplati de diffs.
 */
function computePropertyDiffs(
	original: Record<string, JSONSchema7Definition | string[]>,
	merged: Record<string, JSONSchema7Definition | string[]>,
	basePath: string,
	parentKey: string,
): SchemaDiff[] {
	const allPropKeys = unionStrings(Object.keys(original), Object.keys(merged));

	const result: SchemaDiff[] = [];
	for (const key of allPropKeys) {
		const currentPath = `${basePath}.${key}`;
		const origVal = original[key];
		const mergedVal = merged[key];

		if (origVal === undefined && mergedVal !== undefined) {
			result.push({
				path: currentPath,
				type: "added",
				expected: undefined,
				actual: mergedVal,
			});
			continue;
		}

		if (origVal !== undefined && mergedVal === undefined) {
			result.push({
				path: currentPath,
				type: "removed",
				expected: origVal,
				actual: undefined,
			});
			continue;
		}

		if (origVal !== undefined && mergedVal !== undefined) {
			// Pour `dependencies`, les valeurs peuvent être des tableaux de strings (forme 1)
			// On ne récurse que si les deux valeurs sont des objets (sous-schemas)
			if (
				parentKey === "dependencies" &&
				(Array.isArray(origVal) || Array.isArray(mergedVal))
			) {
				// Comparaison directe pour les tableaux de strings
				if (!deepEqual(origVal, mergedVal)) {
					result.push({
						path: currentPath,
						type: "changed",
						expected: origVal,
						actual: mergedVal,
					});
				}
				continue;
			}

			// Récursion standard pour les sous-schemas
			const sub = computeDiffs(
				origVal as JSONSchema7Definition,
				mergedVal as JSONSchema7Definition,
				currentPath,
			);
			for (const d of sub) result.push(d);
		}
	}

	return result;
}
