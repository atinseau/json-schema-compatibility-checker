import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { resolveConditions } from "./condition-resolver";
import { formatResult } from "./formatter";
import { MergeEngine } from "./merge-engine";
import { normalize } from "./normalizer";
import {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
} from "./pattern-subset";
import type { BranchResult, BranchType } from "./subset-checker";
import {
	checkAtomic,
	checkBranchedSub,
	checkBranchedSup,
	getBranchesTyped,
	isAtomicSubsetOf,
} from "./subset-checker";
import type {
	ConnectionResult,
	ResolvedConditionResult,
	SchemaDiff,
	SubsetResult,
} from "./types";

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type {
	SchemaDiff,
	SubsetResult,
	ConnectionResult,
	ResolvedConditionResult,
	BranchType,
	BranchResult,
};

export {
	normalize,
	resolveConditions,
	formatResult,
	MergeEngine,
	isPatternSubset,
	arePatternsEquivalent,
	isTrivialPattern,
};

// ─── Main Class ──────────────────────────────────────────────────────────────
//
// Façade légère qui orchestre les sous-modules pour vérifier la compatibilité
// entre JSON Schemas (Draft-07).
//
// Principe mathématique :
//   A ⊆ B  ⟺  A ∩ B ≡ A
//
// En JSON Schema :
//   - A ∩ B  =  allOf([A, B])  résolu via merge
//   - ≡      =  comparaison structurelle
//
// @example
// ```ts
// const checker = new JsonSchemaCompatibilityChecker();
//
// checker.isSubset(strict, loose);             // true
// checker.check(loose, strict);                // { isSubset: false, diffs: [...] }
// checker.canConnect(nodeA.output, nodeB.input); // ConnectionResult
// ```

export class JsonSchemaCompatibilityChecker {
	private readonly engine: MergeEngine;

	constructor() {
		this.engine = new MergeEngine();
	}

	// ── Subset check (boolean) ─────────────────────────────────────────────

	/**
	 * Vérifie si `sub ⊆ sup`.
	 * Toute valeur valide pour sub est-elle aussi valide pour sup ?
	 *
	 * Point 6 — Utilise `getBranchesTyped` pour distinguer `anyOf` de `oneOf`
	 * en interne, bien que le résultat boolean ne reflète pas la distinction.
	 */
	isSubset(sub: JSONSchema7Definition, sup: JSONSchema7Definition): boolean {
		// ── Identity short-circuit ──
		// If sub and sup are the same reference, sub ⊆ sup is trivially true.
		// This avoids the entire normalize + merge + compare pipeline.
		if (sub === sup) return true;

		const nSub = normalize(sub);
		const nSup = normalize(sup);

		// ── Structural identity short-circuit ──
		// After normalization, if the two schemas are structurally equal,
		// sub ⊆ sup without needing a merge. Uses the engine's comparator
		// which is faster than a full merge + compare cycle.
		if (this.engine.isEqual(nSub, nSup)) return true;

		const { branches: subBranches } = getBranchesTyped(nSub);

		if (subBranches.length > 1 || subBranches[0] !== nSub) {
			return subBranches.every((branch) =>
				isAtomicSubsetOf(branch, nSup, this.engine),
			);
		}

		return isAtomicSubsetOf(nSub, nSup, this.engine);
	}

	// ── Subset check (detailed) ────────────────────────────────────────────

	/**
	 * Vérifie `sub ⊆ sup` et retourne un diagnostic complet
	 * avec les diffs structurels.
	 *
	 * Point 6 — Utilise `getBranchesTyped` pour distinguer `anyOf` de `oneOf`
	 * dans les paths de diff (ex: `anyOf[0]` vs `oneOf[0]`).
	 */
	check(sub: JSONSchema7Definition, sup: JSONSchema7Definition): SubsetResult {
		// ── Identity short-circuit ──
		// Same reference → no diffs, no merge needed.
		if (sub === sup) {
			return { isSubset: true, merged: sub, diffs: [] };
		}

		const nSub = normalize(sub);
		const nSup = normalize(sup);

		// ── Structural identity short-circuit ──
		// Normalized schemas are equal → subset with no diffs.
		if (this.engine.isEqual(nSub, nSup)) {
			return { isSubset: true, merged: nSub, diffs: [] };
		}

		const { branches: subBranches, type: subBranchType } =
			getBranchesTyped(nSub);
		const { branches: supBranches, type: supBranchType } =
			getBranchesTyped(nSup);

		// anyOf/oneOf dans sub
		if (subBranches.length > 1 || subBranches[0] !== nSub) {
			return checkBranchedSub(subBranches, nSup, this.engine, subBranchType);
		}

		// anyOf/oneOf dans sup uniquement
		if (supBranches.length > 1 || supBranches[0] !== nSup) {
			return checkBranchedSup(nSub, supBranches, this.engine, supBranchType);
		}

		// Cas standard
		return checkAtomic(nSub, nSup, this.engine);
	}

	// ── Connection check ───────────────────────────────────────────────────

	/**
	 * Vérifie si la sortie d'un nœud source peut alimenter l'entrée d'un nœud cible.
	 *
	 * Sémantique : `sourceOutput ⊆ targetInput`
	 * → Toute donnée produite par source sera acceptée par target.
	 */
	canConnect(
		sourceOutput: JSONSchema7Definition,
		targetInput: JSONSchema7Definition,
	): ConnectionResult {
		const result = this.check(sourceOutput, targetInput);
		return { ...result, direction: "sourceOutput ⊆ targetInput" };
	}

	// ── Equality ───────────────────────────────────────────────────────────

	/**
	 * Vérifie l'égalité structurelle entre deux schemas.
	 */
	isEqual(a: JSONSchema7Definition, b: JSONSchema7Definition): boolean {
		return this.engine.isEqual(normalize(a), normalize(b));
	}

	// ── Intersection ───────────────────────────────────────────────────────

	/**
	 * Calcule l'intersection de deux schemas (allOf merge).
	 * Retourne null si les schemas sont incompatibles.
	 *
	 * Le résultat est normalisé pour éliminer les artefacts structurels
	 * du merge (ex: `enum` redondant quand `const` est présent).
	 */
	intersect(
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	): JSONSchema7Definition | null {
		const merged = this.engine.merge(normalize(a), normalize(b));
		return merged !== null ? normalize(merged) : null;
	}

	// ── Condition resolution ───────────────────────────────────────────────

	/**
	 * Résout les `if/then/else` d'un schema en évaluant le `if` contre
	 * des données partielles (discriminants).
	 */
	resolveConditions(
		schema: JSONSchema7,
		data: Record<string, unknown>,
	): ResolvedConditionResult {
		return resolveConditions(schema, data, this.engine);
	}

	// ── Resolved check ────────────────────────────────────────────────────

	/**
	 * Raccourci : résout les conditions des deux schemas puis vérifie sub ⊆ sup.
	 *
	 * Utile quand le superset contient des if/then/else et que tu connais
	 * les valeurs discriminantes que le subset va produire.
	 */
	checkResolved(
		sub: JSONSchema7,
		sup: JSONSchema7,
		subData: Record<string, unknown>,
		supData?: Record<string, unknown>,
	): SubsetResult & {
		resolvedSub: ResolvedConditionResult;
		resolvedSup: ResolvedConditionResult;
	} {
		const resolvedSub = resolveConditions(sub, subData, this.engine);
		const resolvedSup = resolveConditions(sup, supData ?? subData, this.engine);
		const result = this.check(resolvedSub.resolved, resolvedSup.resolved);

		return { ...result, resolvedSub, resolvedSup };
	}

	// ── Normalization ──────────────────────────────────────────────────────

	/**
	 * Normalise un schema : infère `type` depuis `const`/`enum`,
	 * et normalise récursivement tous les sous-schemas.
	 */
	normalize(def: JSONSchema7Definition): JSONSchema7Definition {
		return normalize(def);
	}

	// ── Formatting ─────────────────────────────────────────────────────────

	/**
	 * Formate un SubsetResult en chaîne lisible (utile pour logs/debug).
	 */
	formatResult(label: string, result: SubsetResult): string {
		return formatResult(label, result);
	}
}
