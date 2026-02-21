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
		for (let i = 0; i < aKeys.length; i++) {
			const key = aKeys[i]!;
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
 */
export function omitKeys<T extends Record<string, unknown>>(
	obj: T,
	keysToOmit: string[],
): T {
	const result: Record<string, unknown> = {};

	if (keysToOmit.length <= 2) {
		// Fast path pour 1-2 clés (cas le plus fréquent)
		const k0 = keysToOmit[0];
		const k1 = keysToOmit[1];
		for (const key of Object.keys(obj)) {
			if (key !== k0 && key !== k1) {
				result[key] = obj[key];
			}
		}
	} else {
		const omitSet = new Set(keysToOmit);
		for (const key of Object.keys(obj)) {
			if (!omitSet.has(key)) {
				result[key] = obj[key];
			}
		}
	}

	return result as T;
}

/**
 * Fusionne deux tableaux de strings en éliminant les doublons.
 * Retourne un tableau avec les éléments uniques des deux sources.
 */
export function unionStrings(a: string[], b: string[]): string[] {
	const set = new Set(a);
	for (const item of b) set.add(item);
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
