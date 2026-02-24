export { formatSemanticDiffs } from "./formatter";
export { JsonSchemaCompatibilityChecker } from "./json-schema-compatibility-checker";
export { MergeEngine } from "./merge-engine";
export {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
} from "./pattern-subset";
export type { SemanticDiff, SemanticDiffType } from "./semantic-diff";
export { computeSemanticDiffs } from "./semantic-diff";
export type {
	ConnectionResult,
	ResolvedConditionResult,
	SchemaDiff,
	SubsetResult,
} from "./types";
