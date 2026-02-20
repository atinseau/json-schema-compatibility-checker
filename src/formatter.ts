import isEmpty from "lodash/isEmpty";
import map from "lodash/map";
import type { SubsetResult } from "./types";

// ─── Result Formatter ────────────────────────────────────────────────────────
//
// Formate un `SubsetResult` en chaîne lisible pour logs / debug.
//
// Utilise lodash :
//   - `_.map`     pour transformer les diffs en lignes formatées
//   - `_.isEmpty` pour vérifier la présence de diffs

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

	if (!result.isSubset && !isEmpty(result.diffs)) {
		lines.push("   Diffs:");

		// Utilise `_.map` pour transformer chaque diff en ligne formatée
		const diffLines = map(result.diffs, (d) => `     ${formatDiffLine(d)}`);
		lines.push(...diffLines);
	}

	return lines.join("\n");
}
