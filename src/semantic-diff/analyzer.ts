import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { SchemaDiff } from "../types";
import {
	createFallbackDiff,
	detectAdditionalPropertiesConflict,
	detectConstDiffs,
	detectConstraintDiffs,
	detectEnumDiffs,
	detectFormatDiffs,
	detectItemsDiffs,
	detectMissingRequiredProperties,
	detectPatternDiffs,
	detectPropertiesNotAllowed,
	detectPropertiesNotGuaranteed,
	detectTypeDiffs,
} from "./detectors";
import type { SemanticDiff } from "./types";

// ─── Semantic Diff Analyzer ──────────────────────────────────────────────────
//
// Orchestrateur principal qui transforme des diffs structurelles brutes
// (original vs merged) en diffs sémantiques lisibles et actionnables.
//
// Architecture :
//   1. Les détecteurs s'exécutent dans un ordre précis (priorité décroissante)
//   2. Chaque détecteur marque les diffs structurelles qu'il a "consommées"
//   3. Les diffs non consommées tombent dans le fallback `schema-incompatible`
//
// L'ordre des détecteurs est important :
//   - Les property detectors passent en premier pour regrouper les diffs
//     `properties.X added` + `required changed` en un seul diagnostic
//   - Les type/value/constraint detectors traitent les diffs restantes
//   - Le fallback attrape tout ce qui n'a pas été classifié

// ─── Detector pipeline ───────────────────────────────────────────────────────

/**
 * Pipeline de détecteurs, exécutés dans l'ordre.
 *
 * Chaque détecteur reçoit :
 *   - sub : le schema source (original)
 *   - sup : le schema target
 *   - diffs : toutes les diffs structurelles
 *   - consumed : Set d'indices des diffs déjà traitées
 *
 * Et retourne un tableau de SemanticDiff.
 *
 * L'ordre est crucial :
 *   1. Property-level (regroupe required + property diffs)
 *   2. Type-level
 *   3. Value-level (enum, const)
 *   4. Constraint-level (min/max/length/items/etc.)
 *   5. Structure-level (additionalProperties, items)
 *   6. Format-level (format, pattern)
 */
type DetectorFn = (
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
) => SemanticDiff[];

const DETECTOR_PIPELINE: readonly DetectorFn[] = [
	// Phase 1 — Property detectors (order matters: missing before not-guaranteed)
	detectMissingRequiredProperties,
	detectPropertiesNotGuaranteed,
	detectPropertiesNotAllowed,

	// Phase 2 — Type detectors
	detectTypeDiffs,

	// Phase 3 — Value detectors
	detectEnumDiffs,
	detectConstDiffs,

	// Phase 4 — Constraint detectors
	detectConstraintDiffs,

	// Phase 5 — Structure detectors
	detectAdditionalPropertiesConflict,
	detectItemsDiffs,

	// Phase 6 — Format detectors
	detectFormatDiffs,
	detectPatternDiffs,
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Transforme les diffs structurelles en diffs sémantiques.
 *
 * @param sub   Le schema source (sourceOutput)
 * @param sup   Le schema target (targetInput)
 * @param structuralDiffs  Les diffs brutes produites par `computeDiffs`
 * @returns     Tableau de SemanticDiff lisibles et actionnables
 *
 * @example
 * ```ts
 * const semanticDiffs = computeSemanticDiffs(sourceSchema, targetSchema, rawDiffs);
 * // [
 * //   {
 * //     type: 'missing-required-property',
 * //     path: 'properties.meetingId',
 * //     message: "Target requires property 'meetingId' (string) which source does not provide",
 * //     details: { property: 'meetingId', targetSchema: { type: 'string' } }
 * //   }
 * // ]
 * ```
 */
export function computeSemanticDiffs(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	structuralDiffs: SchemaDiff[],
): SemanticDiff[] {
	// Pas de diffs structurelles → pas de diffs sémantiques
	if (structuralDiffs.length === 0) return [];

	// Boolean schemas : pas assez de structure pour détecter des patterns
	// → fallback direct
	if (typeof sub === "boolean" || typeof sup === "boolean") {
		return handleBooleanSchemas(sub, sup, structuralDiffs);
	}

	const result: SemanticDiff[] = [];
	const consumed = new Set<number>();

	// Exécuter chaque détecteur dans l'ordre du pipeline
	for (const detector of DETECTOR_PIPELINE) {
		const detected = detector(sub, sup, structuralDiffs, consumed);
		for (const diff of detected) {
			result.push(diff);
		}
	}

	// Phase finale — Fallback pour les diffs non consommées
	collectUnconsumedDiffs(structuralDiffs, consumed, result);

	return result;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Gère les boolean schemas (true/false).
 *
 * `true` = accepte tout, `false` = rejette tout.
 * Pas assez de structure pour les détecteurs spécifiques,
 * donc on produit un `schema-incompatible` générique.
 */
function handleBooleanSchemas(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	structuralDiffs: SchemaDiff[],
): SemanticDiff[] {
	if (sub === false) {
		return [
			{
				type: "schema-incompatible",
				path: "$",
				message: "Source schema rejects all values (false schema)",
				details: { reason: "source is false schema" },
			},
		];
	}

	if (sup === false) {
		return [
			{
				type: "schema-incompatible",
				path: "$",
				message: "Target schema rejects all values (false schema)",
				details: { reason: "target is false schema" },
			},
		];
	}

	// sub === true et sup est un objet, ou vice versa
	// Le diff structurel devrait décrire le problème
	return structuralDiffs.map(createFallbackDiff);
}

/**
 * Collecte les diffs structurelles non consommées par aucun détecteur
 * et les convertit en `schema-incompatible` (fallback).
 *
 * Garantit qu'aucune diff structurelle n'est silencieusement ignorée.
 */
function collectUnconsumedDiffs(
	structuralDiffs: SchemaDiff[],
	consumed: Set<number>,
	result: SemanticDiff[],
): void {
	for (let i = 0; i < structuralDiffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = structuralDiffs[i];
		if (diff === undefined) continue;
		result.push(createFallbackDiff(diff));
	}
}
