import { JsonSchemaCompatibilityChecker } from "./src";

const checker = new JsonSchemaCompatibilityChecker();

console.log("=== Bug 1 — not + enum/const ===");

const r1 = checker.isSubset(
	{ type: "string", enum: ["active", "pending"] },
	{ type: "string", not: { const: "deleted" } },
);
console.log("Bug1 isSubset (enum + not const):", r1, "— expected: true");

const c1 = checker.check(
	{ type: "string", enum: ["active", "pending"] },
	{ type: "string", not: { const: "deleted" } },
);
console.log("Bug1 check:", c1.isSubset, "errors:", JSON.stringify(c1.errors));

const r1b = checker.isSubset(
	{ type: "string", enum: ["active", "pending"] },
	{ type: "string", not: { enum: ["deleted", "archived"] } },
);
console.log("Bug1b isSubset (enum + not enum):", r1b, "— expected: true");

const c1c = checker.check(
	{
		type: "object",
		properties: { status: { type: "string", enum: ["active"] } },
		required: ["status"],
	},
	{
		type: "object",
		properties: {
			status: { type: "string", not: { const: "banned" } },
		},
		required: ["status"],
	},
);
console.log(
	"Bug1c check (nested):",
	c1c.isSubset,
	"errors:",
	JSON.stringify(c1c.errors),
	"— expected: true, []",
);

console.log("\n=== Bug 2 — allOf + not ===");

const c2 = checker.check(
	{
		type: "object",
		properties: { role: { type: "string", enum: ["admin", "user"] } },
		required: ["role"],
	},
	{
		allOf: [
			{
				type: "object",
				properties: { role: { type: "string" } },
				required: ["role"],
			},
			{
				type: "object",
				properties: { role: { not: { const: "guest" } } },
			},
		],
	},
);
console.log(
	"Bug2 check (allOf + not):",
	c2.isSubset,
	"errors:",
	JSON.stringify(c2.errors),
	"— expected: true, []",
);

const r2 = checker.isSubset(
	{
		type: "object",
		properties: { role: { type: "string", enum: ["admin", "user"] } },
		required: ["role"],
	},
	{
		allOf: [
			{
				type: "object",
				properties: { role: { type: "string" } },
				required: ["role"],
			},
			{
				type: "object",
				properties: { role: { not: { const: "guest" } } },
			},
		],
	},
);
console.log("Bug2 isSubset:", r2, "— expected: true");

console.log("\n=== Bug 3 — dependencies ===");

const r3 = checker.isSubset(
	{
		type: "object",
		properties: {
			name: { type: "string" },
			email: { type: "string" },
		},
		required: ["name", "email"],
	},
	{
		type: "object",
		properties: {
			name: { type: "string" },
			email: { type: "string" },
		},
		required: ["name", "email"],
		dependencies: { name: ["email"] },
	},
);
console.log("Bug3 isSubset (deps all required):", r3, "— expected: true");

const c3 = checker.check(
	{
		type: "object",
		properties: {
			name: { type: "string" },
			email: { type: "string" },
		},
		required: ["name", "email"],
	},
	{
		type: "object",
		properties: {
			name: { type: "string" },
			email: { type: "string" },
		},
		required: ["name", "email"],
		dependencies: { name: ["email"] },
	},
);
console.log("Bug3 check:", c3.isSubset, "errors:", JSON.stringify(c3.errors));

const r3b = checker.isSubset(
	{
		type: "object",
		properties: { name: { type: "string" } },
		required: ["name"],
		additionalProperties: false,
	},
	{
		type: "object",
		properties: {
			name: { type: "string" },
			nickname: { type: "string" },
			avatar: { type: "string" },
		},
		required: ["name"],
		dependencies: { nickname: ["avatar"] },
	},
);
console.log(
	"Bug3b isSubset (trigger never produced):",
	r3b,
	"— expected: true",
);

console.log("\n=== Bug 4 — cross bounds ===");

const r4a = checker.isSubset(
	{ type: "number", exclusiveMinimum: 5 },
	{ type: "number", minimum: 5 },
);
console.log("Bug4a isSubset (exclusiveMin >= min):", r4a, "— expected: true");

const c4a = checker.check(
	{ type: "number", exclusiveMinimum: 5 },
	{ type: "number", minimum: 5 },
);
console.log(
	"Bug4a check:",
	c4a.isSubset,
	"errors:",
	JSON.stringify(c4a.errors),
);

const r4b = checker.isSubset(
	{ type: "number", exclusiveMaximum: 100 },
	{ type: "number", maximum: 100 },
);
console.log("Bug4b isSubset (exclusiveMax <= max):", r4b, "— expected: true");

const r4c = checker.isSubset(
	{ type: "number", exclusiveMinimum: 0, exclusiveMaximum: 100 },
	{ type: "number", minimum: 0, maximum: 100 },
);
console.log("Bug4c isSubset (both cross bounds):", r4c, "— expected: true");

const r4d = checker.isSubset(
	{ type: "number", minimum: 6 },
	{ type: "number", exclusiveMinimum: 5 },
);
console.log("Bug4d isSubset (min > exclusiveMin):", r4d, "— expected: true");

const r4e = checker.isSubset(
	{ type: "number", maximum: 99 },
	{ type: "number", exclusiveMaximum: 100 },
);
console.log("Bug4e isSubset (max < exclusiveMax):", r4e, "— expected: true");

// Negative cases — these should remain false
const r4f = checker.isSubset(
	{ type: "number", minimum: 5 },
	{ type: "number", exclusiveMinimum: 5 },
);
console.log(
	"Bug4f isSubset (min == exclusiveMin — NOT subset):",
	r4f,
	"— expected: false",
);

const r4g = checker.isSubset(
	{ type: "number", maximum: 100 },
	{ type: "number", exclusiveMaximum: 100 },
);
console.log(
	"Bug4g isSubset (max == exclusiveMax — NOT subset):",
	r4g,
	"— expected: false",
);

console.log("\n=== Summary ===");
const results = [
	["Bug1 enum+not.const", r1, true],
	["Bug1b enum+not.enum", r1b, true],
	["Bug1c nested", c1c.isSubset, true],
	["Bug2 allOf+not", c2.isSubset, true],
	["Bug3 deps required", r3, true],
	["Bug3b trigger absent", r3b, true],
	["Bug4a excl.min>=min", r4a, true],
	["Bug4b excl.max<=max", r4b, true],
	["Bug4c both", r4c, true],
	["Bug4d min>excl.min", r4d, true],
	["Bug4e max<excl.max", r4e, true],
	["Bug4f neg min==excl.min", r4f, false],
	["Bug4g neg max==excl.max", r4g, false],
] as const;

let passing = 0;
let failing = 0;
for (const [name, actual, expected] of results) {
	const ok = actual === expected;
	if (ok) passing++;
	else failing++;
	console.log(
		`${ok ? "✅" : "❌"} ${name}: got ${actual}, expected ${expected}`,
	);
}
console.log(`\n${passing} passed, ${failing} failed out of ${results.length}`);
