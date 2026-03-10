import type { SubsetResult } from "./types.ts";

// ─── Result Formatter ────────────────────────────────────────────────────────
//
// Formats a `SubsetResult` into a human-readable string for logs / debug.

/**
 * Formats a semantic error into a readable line.
 *
 * @param e  The error to format
 * @returns  Formatted line with path, expected and received
 */
function formatErrorLine(e: {
	key: string;
	expected: string;
	received: string;
}): string {
	return `  ✗ ${e.key}: expected ${e.expected}, received ${e.received}`;
}

/**
 * Formats a SubsetResult into a readable string (useful for logs/debug).
 *
 * @param label   Descriptive label of the check (e.g. "strict ⊆ loose")
 * @param result  The check result to format
 * @returns       Multi-line formatted string with icons and errors
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
