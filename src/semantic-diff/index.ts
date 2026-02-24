// ─── Semantic Diff — Public API ──────────────────────────────────────────────
//
// Point d'entrée unique pour le module semantic-diff.
// Ré-exporte les types et la fonction principale d'analyse.

export { computeSemanticDiffs } from "./analyzer";
export { formatType } from "./detectors";
export type { SemanticDiff, SemanticDiffType } from "./types";
