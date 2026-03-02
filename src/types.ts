import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

// ─── Public types ────────────────────────────────────────────────────────────

export interface SchemaError {
	/** Chemin normalisé vers la propriété concernée (ex: "user.name", "users[].name", "accountId") */
	key: string;
	/** Type ou valeur attendu(e) par le schema cible (sup) */
	expected: string;
	/** Type ou valeur reçu(e) depuis le schema source (sub) */
	received: string;
}

export interface SubsetResult {
	/** true si sub ⊆ sup (toute valeur valide pour sub est valide pour sup) */
	isSubset: boolean;
	/** Le schema résultant de l'intersection allOf(sub, sup), ou null si incompatible */
	merged: JSONSchema7Definition | null;
	/** Erreurs sémantiques décrivant les incompatibilités entre les deux schemas */
	errors: SchemaError[];
}

/**
 * Options pour résoudre les if/then/else avant un check de subset.
 * Si `subData` est fourni, les conditions du sub sont résolues.
 * Si `supData` est aussi fourni, il est utilisé pour résoudre le sup ;
 * sinon `subData` est utilisé pour les deux.
 */
export interface CheckConditionsOptions {
	/** Runtime data for the sub schema — used for condition resolution and enum narrowing */
	subData: unknown;
	/** Runtime data for the sup schema (defaults to subData) — used for condition resolution and enum narrowing */
	supData?: unknown;
}

/**
 * Résultat étendu de `check()` quand des options de conditions sont fournies.
 * Inclut les résultats de résolution pour sub et sup en plus du SubsetResult.
 */
export interface ResolvedSubsetResult extends SubsetResult {
	resolvedSub: ResolvedConditionResult;
	resolvedSup: ResolvedConditionResult;
}

export interface ResolvedConditionResult {
	/** Le schema avec les if/then/else résolus (aplatis) */
	resolved: JSONSchema7;
	/** La branche qui a été appliquée ("then" | "else" | null si pas de condition) */
	branch: "then" | "else" | null;
	/** Le discriminant utilisé pour résoudre */
	discriminant: Record<string, unknown>;
}
