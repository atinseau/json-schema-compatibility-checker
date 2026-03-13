export { resolveConditions } from "./condition-resolver.ts";
export { JsonSchemaCompatibilityChecker } from "./json-schema-compatibility-checker.ts";
export { MergeEngine } from "./merge-engine.ts";
export {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
} from "./pattern-subset.ts";
export { formatSchemaType } from "./semantic-errors.ts";
export type {
	CheckerOptions,
	CheckRuntimeOptions,
	Constraint,
	Constraints,
	ConstraintValidationResult,
	ConstraintValidator,
	ConstraintValidatorRegistry,
	ResolvedConditionResult,
	ResolvedSubsetResult,
	SchemaError,
	SubsetResult,
	ValidateTargetOptions,
	ValidateTargets,
} from "./types.ts";
export { SchemaErrorType } from "./types.ts";
