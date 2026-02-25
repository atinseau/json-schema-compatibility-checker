import type { SubsetResult } from "./types";

// ─── Result Formatter ────────────────────────────────────────────────────────
//
// Formate un `SubsetResult` en chaîne lisible pour logs / debug.

/**
 * Formate une erreur sémantique en ligne lisible.
 *
 * @param e  L'erreur à formater
 * @returns  Ligne formatée avec le chemin, expected et received
 */
function formatErrorLine(e: {
	key: string;
	expected: string;
	received: string;
}): string {
	return `  ✗ ${e.key}: expected ${e.expected}, received ${e.received}`;
}

/**
 * Formate un SubsetResult en chaîne lisible (utile pour logs/debug).
 *
 * @param label   Label descriptif du check (ex: "strict ⊆ loose")
 * @param result  Le résultat du check à formater
 * @returns       Chaîne multi-lignes formatée avec icônes et erreurs
 *
 * @example
 * ```
 * ✅ strict ⊆ loose: true
 * ```
 *
 * @example
 * ```
 * ❌ loose ⊆ strict: false
 *    Errors:
 *      ✗ accountId: expected string, received undefined
 *      ✗ meetingId: expected not optional, received optional
 * ```
 */
export function formatResult(label: string, result: SubsetResult): string {
	const icon = result.isSubset ? "✅" : "❌";
	const lines: string[] = [`${icon} ${label}: ${result.isSubset}`];

	if (!result.isSubset && result.errors.length > 0) {
		lines.push("   Errors:");

		for (const e of result.errors) {
			lines.push(`     ${formatErrorLine(e)}`);
		}
	}

	return lines.join("\n");
}
