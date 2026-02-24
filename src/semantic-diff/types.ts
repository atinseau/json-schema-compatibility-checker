// ─── Semantic Diff Types ─────────────────────────────────────────────────────
//
// Types pour les diffs sémantiques : diagnostics lisibles et actionnables
// qui expliquent POURQUOI deux schemas sont incompatibles, plutôt que
// de décrire les différences structurelles brutes du merge.
//
// Chaque SemanticDiff répond à la question :
//   "Pourquoi ces deux nodes ne peuvent pas se connecter ?"

// ─── Semantic diff type union ────────────────────────────────────────────────

/**
 * Types de diffs sémantiques possibles.
 *
 * Chaque type correspond à une catégorie d'incompatibilité
 * entre un schema source et un schema target.
 */
export type SemanticDiffType =
	/** Target exige une propriété que source ne fournit pas du tout */
	| "missing-required-property"
	/** La propriété existe dans source mais est optionnelle, target l'exige */
	| "property-not-guaranteed"
	/** Même propriété, types complètement incompatibles (string vs number) */
	| "type-mismatch"
	/** Source produit un type plus large que ce que target accepte (string|number vs string) */
	| "type-too-wide"
	/** Source autorise des valeurs enum que target n'accepte pas */
	| "enum-not-subset"
	/** Valeurs const incompatibles */
	| "const-mismatch"
	/** Source a des contraintes plus larges (min/max/length/items/etc.) */
	| "constraint-too-loose"
	/** Source autorise des propriétés supplémentaires, target les interdit */
	| "additional-properties-conflict"
	/** Source fournit une propriété que target interdit (additionalProperties: false) */
	| "property-not-allowed"
	/** Contrainte de format incompatible */
	| "format-mismatch"
	/** Pattern regex du source pas inclus dans celui du target */
	| "pattern-not-subset"
	/** Schema des items d'un array incompatible */
	| "incompatible-items"
	/** Incompatibilité générique (catch-all pour les cas non couverts) */
	| "schema-incompatible";

// ─── Semantic diff interface ─────────────────────────────────────────────────

/**
 * Un diagnostic sémantique décrivant une incompatibilité entre deux schemas.
 *
 * Contrairement aux `SchemaDiff` structurels (qui comparent original vs merged),
 * les `SemanticDiff` décrivent le problème en termes compréhensibles :
 *   - Quel est le problème (`type`)
 *   - Où il se situe (`path`)
 *   - Pourquoi c'est incompatible (`message`)
 *   - Données structurées pour l'exploiter programmatiquement (`details`)
 *
 * @example
 * ```
 * {
 *   type: 'missing-required-property',
 *   path: 'properties.meetingId',
 *   message: "Target requires property 'meetingId' (string) which source does not provide",
 *   details: { property: 'meetingId', targetSchema: { type: 'string' } }
 * }
 * ```
 */
export interface SemanticDiff {
	/** Catégorie sémantique de l'incompatibilité */
	type: SemanticDiffType;

	/** Chemin JSON-path vers l'élément problématique (ex: "properties.meetingId") */
	path: string;

	/** Message humain lisible décrivant le problème */
	message: string;

	/**
	 * Données structurées associées au diagnostic.
	 *
	 * Le contenu varie selon le `type` :
	 *
	 * - `missing-required-property` → `{ property, targetSchema }`
	 * - `property-not-guaranteed`   → `{ property }`
	 * - `type-mismatch`             → `{ property?, sourceType, targetType }`
	 * - `type-too-wide`             → `{ property?, sourceType, targetType }`
	 * - `enum-not-subset`           → `{ property?, sourceValues, targetValues, extraValues }`
	 * - `const-mismatch`            → `{ property?, sourceConst, targetConst }`
	 * - `constraint-too-loose`      → `{ property?, constraint, sourceValue, targetValue }`
	 * - `additional-properties-conflict` → `{ sourceAllows, targetAllows }`
	 * - `property-not-allowed`      → `{ property }`
	 * - `format-mismatch`           → `{ property?, sourceFormat, targetFormat }`
	 * - `pattern-not-subset`        → `{ property?, sourcePattern, targetPattern }`
	 * - `incompatible-items`        → `{ reason }`
	 * - `schema-incompatible`       → `{ reason }`
	 */
	details: Record<string, unknown>;
}
