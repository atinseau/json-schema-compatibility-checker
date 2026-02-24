import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { SemanticDiff } from "./semantic-diff/types";

// ─── Public types ────────────────────────────────────────────────────────────

export interface SchemaDiff {
	/** Chemin JSON-path-like vers la divergence (ex: "properties.user.required") */
	path: string;
	/** Type de divergence */
	type: "added" | "removed" | "changed";
	/** Valeur dans le schema original (sub / source) */
	sourceValue: unknown;
	/** Valeur dans le schema mergé (intersection) */
	mergedValue: unknown;
}

export interface SubsetResult {
	/** true si sub ⊆ sup (toute valeur valide pour sub est valide pour sup) */
	isSubset: boolean;
	/** Le schema résultant de l'intersection allOf(sub, sup), ou null si incompatible */
	merged: JSONSchema7Definition | null;
	/** Différences structurelles détectées entre sub et l'intersection */
	diffs: SchemaDiff[];
	/** Diagnostics sémantiques lisibles décrivant POURQUOI les schemas sont incompatibles */
	semanticDiffs: SemanticDiff[];
}

export interface ConnectionResult extends SubsetResult {
	/** Direction lisible du check */
	direction: string;
}

export interface ResolvedConditionResult {
	/** Le schema avec les if/then/else résolus (aplatis) */
	resolved: JSONSchema7;
	/** La branche qui a été appliquée ("then" | "else" | null si pas de condition) */
	branch: "then" | "else" | null;
	/** Le discriminant utilisé pour résoudre */
	discriminant: Record<string, unknown>;
}
