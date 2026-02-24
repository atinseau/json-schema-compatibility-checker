import type { SemanticDiff } from "./semantic-diff/types";
import type { SubsetResult } from "./types";

// ─── Result Formatter ────────────────────────────────────────────────────────
//
// Formate un `SubsetResult` en chaîne lisible pour logs / debug.
// Supporte les diffs structurelles (legacy) et les diffs sémantiques.

// ─── Semantic diff icons ─────────────────────────────────────────────────────

/** Icône associée à chaque type de diff sémantique */
const SEMANTIC_ICONS: Readonly<Record<string, string>> = {
	"missing-required-property": "🔴",
	"property-not-guaranteed": "🟡",
	"type-mismatch": "🔴",
	"type-too-wide": "🟠",
	"enum-not-subset": "🟠",
	"const-mismatch": "🔴",
	"constraint-too-loose": "🟡",
	"additional-properties-conflict": "🟠",
	"property-not-allowed": "🔴",
	"format-mismatch": "🟡",
	"pattern-not-subset": "🟡",
	"incompatible-items": "🟠",
	"schema-incompatible": "🔴",
};

// ─── Structural diff formatting (legacy) ─────────────────────────────────────

/**
 * Formate un diff structurel individuel en ligne lisible avec préfixe iconique.
 *
 * @param d  Le diff à formater
 * @returns  Ligne formatée avec +, - ou ~ selon le type
 */
function formatStructuralDiffLine(d: {
	type: string;
	path: string;
	sourceValue: unknown;
	mergedValue: unknown;
}): string {
	switch (d.type) {
		case "added":
			return `  + ${d.path}: ${JSON.stringify(d.mergedValue)}`;
		case "removed":
			return `  - ${d.path}: was ${JSON.stringify(d.sourceValue)}`;
		default:
			return `  ~ ${d.path}: ${JSON.stringify(d.sourceValue)} → ${JSON.stringify(d.mergedValue)}`;
	}
}

// ─── Semantic diff formatting ────────────────────────────────────────────────

/**
 * Formate un diff sémantique en ligne lisible avec icône et message.
 *
 * @param d  Le diff sémantique à formater
 * @returns  Ligne formatée avec icône, type et message
 */
function formatSemanticDiffLine(d: SemanticDiff): string {
	const icon = SEMANTIC_ICONS[d.type] ?? "⚪";
	return `  ${icon} [${d.type}] ${d.message}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Formate un SubsetResult en chaîne lisible (utile pour logs/debug).
 *
 * Affiche les diffs sémantiques en priorité (si disponibles),
 * avec un fallback sur les diffs structurelles.
 *
 * @param label   Label descriptif du check (ex: "strict ⊆ loose")
 * @param result  Le résultat du check à formater
 * @returns       Chaîne multi-lignes formatée avec icônes et diffs
 *
 * @example
 * ```
 * ✅ strict ⊆ loose: true
 * ```
 *
 * @example
 * ```
 * ❌ loose ⊆ strict: false
 *    Diffs:
 *      🔴 [missing-required-property] Target requires property 'meetingId' (string) which source does not provide
 * ```
 */
export function formatResult(label: string, result: SubsetResult): string {
	const icon = result.isSubset ? "✅" : "❌";
	const lines: string[] = [`${icon} ${label}: ${result.isSubset}`];

	if (!result.isSubset) {
		// Prefer semantic diffs over structural diffs
		if (result.semanticDiffs && result.semanticDiffs.length > 0) {
			lines.push("   Diffs:");
			for (const d of result.semanticDiffs) {
				lines.push(`     ${formatSemanticDiffLine(d)}`);
			}
		} else if (result.diffs.length > 0) {
			lines.push("   Diffs (structural):");
			for (const d of result.diffs) {
				lines.push(`     ${formatStructuralDiffLine(d)}`);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Formate uniquement les diffs sémantiques en chaîne lisible.
 *
 * Utile quand on veut afficher les diagnostics sans le résultat global.
 *
 * @param diffs  Les diffs sémantiques à formater
 * @returns      Chaîne multi-lignes, ou chaîne vide si pas de diffs
 */
export function formatSemanticDiffs(diffs: SemanticDiff[]): string {
	if (diffs.length === 0) return "";
	return diffs.map(formatSemanticDiffLine).join("\n");
}
