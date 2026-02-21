import type { JSONSchema7Definition } from "json-schema";

// ─── Shared Utilities ────────────────────────────────────────────────────────
//
// Fonctions utilitaires natives partagées entre tous les modules.
// Centralisées ici pour éviter la duplication et permettre à V8
// d'optimiser une seule instance de chaque fonction hot-path.

/**
 * Vérifie si une valeur est un plain object (pas null, pas un array).
 */
export function isPlainObj(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Vérifie si un objet possède une propriété propre.
 */
export function hasOwn(obj: object, key: string): boolean {
	return Object.hasOwn(obj, key);
}

/**
 * Compare deux valeurs en profondeur (deep equality).
 *
 * Optimisations :
 *   - Reference equality short-circuit (a === b)
 *   - Length checks avant l'itération (arrays et objects)
 *   - Pas de support pour Date, RegExp, Map, Set (pas nécessaire pour JSON Schema)
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (typeof a === "object") {
		if (Array.isArray(a)) {
			if (!Array.isArray(b)) return false;
			const len = a.length;
			if (len !== b.length) return false;
			for (let i = 0; i < len; i++) {
				if (!deepEqual(a[i], b[i])) return false;
			}
			return true;
		}
		if (Array.isArray(b)) return false;

		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		for (const key of aKeys) {
			if (!(key in bObj) || !deepEqual(aObj[key], bObj[key])) return false;
		}
		return true;
	}

	return false;
}

/**
 * Crée une copie d'un objet sans les clés spécifiées.
 *
 * Optimisé pour le cas courant (1-2 clés à omettre) :
 *   - Utilise un Set uniquement si > 2 clés
 *   - Itère une seule fois sur l'objet source
 *   - Retourne l'original si aucune clé à omettre n'est présente dans l'objet
 */
export function omitKeys<T extends Record<string, unknown>>(
	obj: T,
	keysToOmit: string[],
): T {
	// Fast path: check if any key to omit actually exists in the object
	if (keysToOmit.length <= 2) {
		const k0 = keysToOmit[0];
		const k1 = keysToOmit[1];
		const has0 = k0 !== undefined && k0 in obj;
		const has1 = k1 !== undefined && k1 in obj;
		if (!has0 && !has1) return obj;

		const result: Record<string, unknown> = {};
		for (const key of Object.keys(obj)) {
			if (key !== k0 && key !== k1) {
				result[key] = obj[key];
			}
		}
		return result as T;
	}

	const omitSet = new Set(keysToOmit);

	// Check if any key to omit exists
	let hasAny = false;
	for (const key of keysToOmit) {
		if (key in obj) {
			hasAny = true;
			break;
		}
	}
	if (!hasAny) return obj;

	const result: Record<string, unknown> = {};
	for (const key of Object.keys(obj)) {
		if (!omitSet.has(key)) {
			result[key] = obj[key];
		}
	}
	return result as T;
}

/**
 * Fusionne deux tableaux de strings en éliminant les doublons.
 * Retourne un tableau avec les éléments uniques des deux sources.
 *
 * Optimisé avec fast paths pour les cas courants :
 *   - Si b est vide → retourne a directement
 *   - Si a est vide → retourne b directement
 *   - Pour les petits tableaux (≤ 8 éléments total), utilise
 *     une boucle avec includes au lieu de créer un Set
 */
export function unionStrings(a: string[], b: string[]): string[] {
	const aLen = a.length;
	const bLen = b.length;

	// Fast paths for empty arrays
	if (bLen === 0) return a;
	if (aLen === 0) return b;

	// Fast path for small arrays: avoid Set allocation overhead
	if (aLen + bLen <= 8) {
		const result = a.slice();
		for (let i = 0; i < bLen; i++) {
			const item = b[i];
			if (item !== undefined && !result.includes(item)) {
				result.push(item);
			}
		}
		// If nothing was added from b (all items already in a), return a
		return result.length === aLen ? a : result;
	}

	// General case: use Set for larger arrays
	const set = new Set(a);
	const initialSize = set.size;
	for (let i = 0; i < bLen; i++) {
		const item = b[i];
		if (item !== undefined) set.add(item);
	}

	// If nothing new was added, return a directly
	if (set.size === initialSize && initialSize === aLen) return a;

	return Array.from(set);
}

/**
 * Vérifie l'égalité structurelle entre deux JSONSchema7Definition.
 * Wrapper typé autour de deepEqual pour les schemas.
 */
export function schemaDeepEqual(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	return deepEqual(a, b);
}
