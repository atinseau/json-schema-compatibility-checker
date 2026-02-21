import type { SubsetResult } from "./types";

// ─── Result Formatter ────────────────────────────────────────────────────────
//
// Formate un `SubsetResult` en chaîne lisible pour logs / debug.

/**
 * Formate un diff individuel en ligne lisible avec préfixe iconique.
 *
 * @param d  Le diff à formater
 * @returns  Ligne formatée avec +, - ou ~ selon le type
 */
function formatDiffLine(d: {
	type: string;
	path: string;
	expected: unknown;
	actual: unknown;
}): string {
	switch (d.type) {
		case "added":
			return `  + ${d.path}: ${JSON.stringify(d.actual)}`;
		case "removed":
			return `  - ${d.path}: was ${JSON.stringify(d.expected)}`;
		default:
			return `  ~ ${d.path}: ${JSON.stringify(d.expected)} → ${JSON.stringify(d.actual)}`;
	}
}

/**
 * Formate un SubsetResult en chaîne lisible (utile pour logs/debug).
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
 *      ~ required: ["name"] → ["name","age"]
 *      + properties.age: {"type":"number"}
 * ```
 */
export function formatResult(label: string, result: SubsetResult): string {
	const icon = result.isSubset ? "✅" : "❌";
	const lines: string[] = [`${icon} ${label}: ${result.isSubset}`];

	if (!result.isSubset && result.diffs.length > 0) {
		lines.push("   Diffs:");

		for (const d of result.diffs) {
			lines.push(`     ${formatDiffLine(d)}`);
		}
	}

	return lines.join("\n");
}
