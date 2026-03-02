// ─── CJS Import Test (Node.js / Bun) ────────────────────────────────────────
// This script is executed by Node.js or Bun to verify that the CommonJS build
// can be imported and used correctly via require().

const {
	JsonSchemaCompatibilityChecker,
	MergeEngine,
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
	formatSchemaType,
} = require("../../dist/cjs/index.js");

const errors = [];

function assert(condition, message) {
	if (!condition) {
		errors.push(`FAIL: ${message}`);
	}
}

// ─── Verify exports exist ────────────────────────────────────────────────────

assert(
	typeof JsonSchemaCompatibilityChecker === "function",
	"JsonSchemaCompatibilityChecker should be a constructor function",
);
assert(
	typeof MergeEngine === "function",
	"MergeEngine should be a constructor function",
);
assert(
	typeof arePatternsEquivalent === "function",
	"arePatternsEquivalent should be a function",
);
assert(
	typeof isPatternSubset === "function",
	"isPatternSubset should be a function",
);
assert(
	typeof isTrivialPattern === "function",
	"isTrivialPattern should be a function",
);
assert(
	typeof formatSchemaType === "function",
	"formatSchemaType should be a function",
);

// ─── Verify instantiation ────────────────────────────────────────────────────

const checker = new JsonSchemaCompatibilityChecker();
assert(
	checker instanceof JsonSchemaCompatibilityChecker,
	"new JsonSchemaCompatibilityChecker() should return an instance of JsonSchemaCompatibilityChecker",
);

const engine = new MergeEngine();
assert(
	engine instanceof MergeEngine,
	"new MergeEngine() should return an instance of MergeEngine",
);

// ─── Verify isSubset ─────────────────────────────────────────────────────────

assert(
	checker.isSubset({ type: "string", minLength: 1 }, { type: "string" }) ===
		true,
	"isSubset should return true when sub is a strict subset of sup",
);

assert(
	checker.isSubset({ type: "string" }, { type: "integer" }) === false,
	"isSubset should return false for incompatible types",
);

assert(
	checker.isSubset({ type: "string" }, { type: "string" }) === true,
	"isSubset should return true for identical schemas",
);

// ─── Verify check (detailed) ────────────────────────────────────────────────

const checkResult = checker.check(
	{ type: "string" },
	{ type: "string", minLength: 5 },
);
assert(
	checkResult.isSubset === false,
	"check should return isSubset: false when sub is not a subset",
);
assert(
	Array.isArray(checkResult.errors),
	"check should return an errors array",
);
assert(
	checkResult.errors.length > 0,
	"check should return at least one error for incompatible schemas",
);

const checkResultOk = checker.check(
	{ type: "string", minLength: 5 },
	{ type: "string" },
);
assert(
	checkResultOk.isSubset === true,
	"check should return isSubset: true when sub is a subset",
);
assert(
	checkResultOk.errors.length === 0,
	"check should return no errors for valid subset",
);

// ─── Verify canConnect ───────────────────────────────────────────────────────

const connectionResult = checker.canConnect(
	{
		type: "object",
		properties: { id: { type: "string" }, name: { type: "string" } },
		required: ["id", "name"],
	},
	{
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
);
assert(
	connectionResult.isSubset === true,
	"canConnect should return isSubset: true when source output fits target input",
);
assert(
	connectionResult.direction === "sourceOutput ⊆ targetInput",
	`canConnect should include direction, got: ${JSON.stringify(connectionResult.direction)}`,
);

// ─── Verify isEqual ──────────────────────────────────────────────────────────

assert(
	checker.isEqual({ type: "string" }, { type: "string" }) === true,
	"isEqual should return true for identical schemas",
);
assert(
	checker.isEqual({ type: "string" }, { type: "number" }) === false,
	"isEqual should return false for different schemas",
);

// ─── Verify normalize ────────────────────────────────────────────────────────

const normalized = checker.normalize({ const: 42 });
assert(normalized != null, "normalize should return a non-null result");

// ─── Verify formatResult ────────────────────────────────────────────────────

const failResult = checker.check(
	{ type: "string" },
	{ type: "string", minLength: 5 },
);
const formatted = checker.formatResult("string ⊆ strict-string", failResult);
assert(typeof formatted === "string", "formatResult should return a string");
assert(
	formatted.includes("❌"),
	"formatResult for failing check should contain ❌",
);

const passResult = checker.check(
	{ type: "string", minLength: 5 },
	{ type: "string" },
);
const formattedPass = checker.formatResult("strict ⊆ loose", passResult);
assert(
	formattedPass.includes("✅"),
	"formatResult for passing check should contain ✅",
);

// ─── Verify resolveConditions ────────────────────────────────────────────────

const conditionalSchema = {
	type: "object",
	properties: {
		kind: { type: "string", enum: ["email", "phone"] },
		value: { type: "string" },
	},
	if: { properties: { kind: { const: "email" } } },
	then: { properties: { value: { format: "email" } } },
	else: { properties: { value: { pattern: "^\\+?[0-9]+" } } },
};

const resolvedThen = checker.resolveConditions(conditionalSchema, {
	kind: "email",
	value: "test@example.com",
});
assert(
	resolvedThen.branch === "then",
	`resolveConditions should return branch 'then' for email kind, got: ${resolvedThen.branch}`,
);

const resolvedElse = checker.resolveConditions(conditionalSchema, {
	kind: "phone",
	value: "+33612345678",
});
assert(
	resolvedElse.branch === "else",
	`resolveConditions should return branch 'else' for phone kind, got: ${resolvedElse.branch}`,
);

// ─── Verify intersect ───────────────────────────────────────────────────────

const intersection = checker.intersect(
	{ type: "string", minLength: 3 },
	{ type: "string", maxLength: 10 },
);
assert(
	intersection != null,
	"intersect should return a non-null result for compatible schemas",
);

const nullIntersection = checker.intersect(
	{ type: "string" },
	{ type: "integer" },
);
assert(
	nullIntersection === null || nullIntersection === false,
	"intersect should return null or false for incompatible schemas",
);

// ─── Verify pattern-subset utilities ─────────────────────────────────────────

assert(
	typeof isTrivialPattern(".*") === "boolean",
	"isTrivialPattern should return a boolean",
);

// ─── Verify MergeEngine ─────────────────────────────────────────────────────

const mergeResult = engine.merge(
	{ type: "string", minLength: 1 },
	{ type: "string", maxLength: 100 },
);
assert(
	mergeResult != null,
	"MergeEngine.merge should return a non-null result for compatible schemas",
);

assert(
	engine.isEqual({ type: "string" }, { type: "string" }) === true,
	"MergeEngine.isEqual should return true for identical schemas",
);

// ─── Verify complex real-world scenario ──────────────────────────────────────

const apiOutput = {
	type: "object",
	properties: {
		status: { type: "integer", minimum: 200, maximum: 299 },
		data: {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							email: { type: "string", format: "email" },
						},
						required: ["id", "email"],
					},
				},
			},
			required: ["users"],
		},
	},
	required: ["status", "data"],
};

const expectedInput = {
	type: "object",
	properties: {
		status: { type: "integer" },
		data: {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
						},
						required: ["id"],
					},
				},
			},
			required: ["users"],
		},
	},
	required: ["data"],
};

const realWorldResult = checker.canConnect(apiOutput, expectedInput);
assert(
	realWorldResult.isSubset === true,
	"Real-world API output should be a subset of the expected input schema",
);

// ─── Report ──────────────────────────────────────────────────────────────────

if (errors.length > 0) {
	console.error(`[CJS] ${errors.length} assertion(s) failed:`);
	for (const e of errors) {
		console.error(`  ${e}`);
	}
	process.exit(1);
} else {
	console.log("[CJS] All assertions passed ✓");
}
