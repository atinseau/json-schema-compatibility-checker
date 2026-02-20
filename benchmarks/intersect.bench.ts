import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, run, summary } from "mitata";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Compatible numeric schemas ──────────────────────────────────────────────

const numericA: JSONSchema7 = { type: "number", minimum: 5, maximum: 10 };
const numericB: JSONSchema7 = { type: "number", minimum: 0, maximum: 100 };

const numericExclusive: JSONSchema7 = { type: "number", exclusiveMinimum: 0 };
const numericMinimum: JSONSchema7 = { type: "number", minimum: 1 };

const multipleOf6: JSONSchema7 = { type: "integer", multipleOf: 6 };
const multipleOf4: JSONSchema7 = { type: "integer", multipleOf: 4 };
const multipleOf3: JSONSchema7 = { type: "integer", multipleOf: 3 };

const numericRange: JSONSchema7 = { type: "number", minimum: 5 };
const numericMax: JSONSchema7 = { type: "number", maximum: 100 };

const numericTighterMinA: JSONSchema7 = { type: "number", minimum: 5 };
const numericTighterMinB: JSONSchema7 = { type: "number", minimum: 10 };

const numericTighterMaxA: JSONSchema7 = { type: "number", maximum: 100 };
const numericTighterMaxB: JSONSchema7 = { type: "number", maximum: 50 };

const exclusiveMinA: JSONSchema7 = { type: "number", exclusiveMinimum: 0 };
const exclusiveMinB: JSONSchema7 = { type: "number", exclusiveMinimum: 5 };

const exclusiveMaxA: JSONSchema7 = { type: "number", exclusiveMaximum: 100 };
const exclusiveMaxB: JSONSchema7 = { type: "number", exclusiveMaximum: 50 };

const multipleOfSingle: JSONSchema7 = { type: "integer", multipleOf: 5 };
const integerPlain: JSONSchema7 = { type: "integer" };

// ─── Compatible string schemas ───────────────────────────────────────────────

const stringMinLength: JSONSchema7 = { type: "string", minLength: 3 };
const stringMaxLength: JSONSchema7 = { type: "string", maxLength: 10 };

const stringPattern: JSONSchema7 = { type: "string", pattern: "^[A-Z]" };
const stringMinLengthOnly: JSONSchema7 = { type: "string", minLength: 1 };

const stringFormat: JSONSchema7 = { type: "string", format: "email" };
const stringPlain: JSONSchema7 = { type: "string" };

const stringAllKeywords: JSONSchema7 = {
	type: "string",
	minLength: 3,
	pattern: "^[a-z]+$",
};
const stringAllKeywords2: JSONSchema7 = {
	type: "string",
	maxLength: 20,
	format: "hostname",
};

const minLengthA: JSONSchema7 = { type: "string", minLength: 1 };
const minLengthB: JSONSchema7 = { type: "string", minLength: 5 };

const maxLengthA: JSONSchema7 = { type: "string", maxLength: 100 };
const maxLengthB: JSONSchema7 = { type: "string", maxLength: 50 };

// ─── Incompatible schemas ────────────────────────────────────────────────────

const stringSchema: JSONSchema7 = { type: "string" };
const numberSchema: JSONSchema7 = { type: "number" };
const integerSchema: JSONSchema7 = { type: "integer" };

// ─── Enum schemas ────────────────────────────────────────────────────────────

const enumA: JSONSchema7 = { type: "string", enum: ["a", "b", "c"] };
const enumB: JSONSchema7 = { type: "string", enum: ["b", "c", "d"] };
const enumDisjoint: JSONSchema7 = { enum: [1, 2] };
const enumDisjoint2: JSONSchema7 = { enum: [3, 4] };
const enumOverlap: JSONSchema7 = { enum: [1, 2, 3] };
const enumOverlap2: JSONSchema7 = { enum: [2, 3, 4] };
const enumLarge: JSONSchema7 = { enum: [1, 2, 3, 4] };
const enumSmall: JSONSchema7 = { enum: [3, 4, 5, 6] };

// ─── Const schemas ───────────────────────────────────────────────────────────

const constA: JSONSchema7 = { const: "x" };
const constB: JSONSchema7 = { const: "y" };
const constSame: JSONSchema7 = { const: "x" };
const constWithEnum: JSONSchema7 = { const: "a" };
const enumForConst: JSONSchema7 = { enum: ["a", "b", "c"] };
const constIncompatType: JSONSchema7 = { const: "hello" };

// ─── Object schemas ──────────────────────────────────────────────────────────

const objectA: JSONSchema7 = {
	type: "object",
	properties: { a: { type: "string" } },
	required: ["a"],
};

const objectB: JSONSchema7 = {
	type: "object",
	properties: { b: { type: "number" } },
	required: ["b"],
};

const objectOverlap: JSONSchema7 = {
	type: "object",
	properties: { x: { type: "string" } },
};

const objectOverlapConstraint: JSONSchema7 = {
	type: "object",
	properties: { x: { type: "string", minLength: 3 } },
};

const objectRequiredA: JSONSchema7 = {
	type: "object",
	required: ["a", "b"],
};

const objectRequiredB: JSONSchema7 = {
	type: "object",
	required: ["b", "c"],
};

const objectAdditionalPropsFalse: JSONSchema7 = {
	type: "object",
	properties: { name: { type: "string" } },
	additionalProperties: false,
};

const objectAdditionalPropsTrue: JSONSchema7 = {
	type: "object",
	additionalProperties: true,
};

const objectAdditionalPropsSchema: JSONSchema7 = {
	type: "object",
	additionalProperties: { type: "string" },
};

const objectAdditionalPropsSchemaConstrained: JSONSchema7 = {
	type: "object",
	additionalProperties: { type: "string", minLength: 1 },
};

const closedObjectWithRequired: JSONSchema7 = {
	type: "object",
	properties: { name: { type: "string" } },
	required: ["name"],
	additionalProperties: false,
};

const objectWithExtraRequired: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string" },
		age: { type: "number" },
	},
	required: ["name", "age"],
};

// ─── Pattern properties ──────────────────────────────────────────────────────

const patternPropA: JSONSchema7 = {
	type: "object",
	patternProperties: { "^S_": { type: "string", minLength: 1 } },
};

const patternPropB: JSONSchema7 = {
	type: "object",
	patternProperties: { "^S_": { type: "string", maxLength: 100 } },
};

const patternPropDiffA: JSONSchema7 = {
	type: "object",
	patternProperties: { "^A_": { type: "string" } },
};

const patternPropDiffB: JSONSchema7 = {
	type: "object",
	patternProperties: { "^B_": { type: "number" } },
};

// ─── minProperties / maxProperties ───────────────────────────────────────────

const minPropsA: JSONSchema7 = { type: "object", minProperties: 1 };
const minPropsB: JSONSchema7 = { type: "object", minProperties: 3 };

const maxPropsA: JSONSchema7 = { type: "object", maxProperties: 10 };
const maxPropsB: JSONSchema7 = { type: "object", maxProperties: 5 };

// ─── Array schemas ───────────────────────────────────────────────────────────

const arrayMinItems: JSONSchema7 = { type: "array", minItems: 1 };
const arrayMinItemsTight: JSONSchema7 = { type: "array", minItems: 3 };

const arrayMaxItems: JSONSchema7 = { type: "array", maxItems: 10 };
const arrayMaxItemsTight: JSONSchema7 = { type: "array", maxItems: 5 };

const arrayUniqueItems: JSONSchema7 = { type: "array", uniqueItems: true };
const arrayPlain: JSONSchema7 = { type: "array" };

const arrayItemsA: JSONSchema7 = {
	type: "array",
	items: { type: "string" },
};
const arrayItemsB: JSONSchema7 = {
	type: "array",
	items: { type: "string", minLength: 3 },
};

const arrayItemsAndConstraints: JSONSchema7 = {
	type: "array",
	items: { type: "number" },
};
const arrayConstraintsOnly: JSONSchema7 = {
	type: "array",
	minItems: 1,
	maxItems: 10,
	uniqueItems: true,
};

const tupleA: JSONSchema7 = {
	type: "array",
	items: [{ type: "string" }, { type: "number" }],
};
const tupleB: JSONSchema7 = {
	type: "array",
	items: [
		{ type: "string", minLength: 1 },
		{ type: "number", minimum: 0 },
	],
};

// ─── Type system ─────────────────────────────────────────────────────────────

const multiTypeA: JSONSchema7 = { type: ["string", "number", "boolean"] };
const multiTypeB: JSONSchema7 = { type: ["string", "number"] };
const multiTypeDisjointA: JSONSchema7 = { type: ["string", "boolean"] };
const multiTypeDisjointB: JSONSchema7 = { type: ["number", "null"] };
const multiTypeSingle: JSONSchema7 = { type: ["string", "number"] };

// ─── Boolean schemas ─────────────────────────────────────────────────────────

const boolTrue = true;
const boolFalse = false;
const schemaWithMinLength: JSONSchema7 = { type: "string", minLength: 1 };

// ─── Dependencies ────────────────────────────────────────────────────────────

const depsArrayA: JSONSchema7 = {
	type: "object",
	dependencies: { a: ["b"] },
};
const depsArrayB: JSONSchema7 = {
	type: "object",
	dependencies: { a: ["c"] },
};

const depsSchemaA: JSONSchema7 = {
	type: "object",
	dependencies: { a: { required: ["b"] } },
};
const depsSchemaB: JSONSchema7 = {
	type: "object",
	dependencies: { a: { required: ["c"] } },
};

const depsDisjointA: JSONSchema7 = {
	type: "object",
	dependencies: { a: ["b"] },
};
const depsDisjointB: JSONSchema7 = {
	type: "object",
	dependencies: { x: ["y"] },
};

// ─── Contains ────────────────────────────────────────────────────────────────

const containsA: JSONSchema7 = {
	type: "array",
	contains: { type: "string" },
};
const containsB: JSONSchema7 = {
	type: "array",
	contains: { type: "string", minLength: 3 },
};

// ─── Complex realistic schemas ───────────────────────────────────────────────

const complexObjectA: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string", minLength: 1 },
		tags: { type: "array", items: { type: "string" }, minItems: 1 },
	},
	required: ["name"],
};

const complexObjectB: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string", maxLength: 100 },
		age: { type: "integer", minimum: 0 },
	},
	required: ["name", "age"],
};

const nestedObjectA: JSONSchema7 = {
	type: "object",
	properties: {
		user: {
			type: "object",
			properties: { email: { type: "string", format: "email" } },
			required: ["email"],
		},
	},
	required: ["user"],
};

const nestedObjectB: JSONSchema7 = {
	type: "object",
	properties: {
		user: {
			type: "object",
			properties: {
				email: { type: "string" },
				name: { type: "string" },
			},
			required: ["email", "name"],
		},
	},
	required: ["user"],
};

const arrayOfObjectsA: JSONSchema7 = {
	type: "array",
	items: {
		type: "object",
		properties: { id: { type: "integer" } },
		required: ["id"],
	},
	minItems: 1,
};

const arrayOfObjectsB: JSONSchema7 = {
	type: "array",
	items: {
		type: "object",
		properties: { id: { type: "integer", minimum: 1 } },
	},
	maxItems: 100,
	uniqueItems: true,
};

// ─── Logical composition ─────────────────────────────────────────────────────

const anyOfSchema: JSONSchema7 = {
	anyOf: [{ type: "string" }, { type: "number" }],
};

const notSchema: JSONSchema7 = { not: { type: "string" } };
const notTarget: JSONSchema7 = { type: "number" };

const allOfSchema: JSONSchema7 = {
	allOf: [{ type: "string" }, { minLength: 1 }],
};
const allOfTarget: JSONSchema7 = { type: "string", maxLength: 10 };

// ─── Format schemas ──────────────────────────────────────────────────────────

const formatEmailA: JSONSchema7 = { type: "string", format: "email" };
const formatEmailB: JSONSchema7 = { type: "string", format: "email" };
const formatIpv4: JSONSchema7 = { type: "string", format: "ipv4" };
const formatEmailWithMin: JSONSchema7 = { type: "string", format: "email" };
const stringMin5: JSONSchema7 = { type: "string", minLength: 5 };

// ─── Idempotent (self-merge) ─────────────────────────────────────────────────

const selfMergeSchema: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string", minLength: 1 },
		age: { type: "integer", minimum: 0 },
	},
	required: ["name"],
	additionalProperties: false,
};

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("numeric: compatible ranges", () =>
			checker.intersect(numericA, numericB),
		);
		bench("numeric: min from one + max from other", () =>
			checker.intersect(numericRange, numericMax),
		);
		bench("numeric: tighter minimum wins", () =>
			checker.intersect(numericTighterMinA, numericTighterMinB),
		);
		bench("numeric: tighter maximum wins", () =>
			checker.intersect(numericTighterMaxA, numericTighterMaxB),
		);
		bench("numeric: exclusiveMinimum tighter wins", () =>
			checker.intersect(exclusiveMinA, exclusiveMinB),
		);
		bench("numeric: exclusiveMaximum tighter wins", () =>
			checker.intersect(exclusiveMaxA, exclusiveMaxB),
		);
		bench("numeric: exclusiveMin + minimum (both kept)", () =>
			checker.intersect(numericExclusive, numericMinimum),
		);
		bench("numeric: multipleOf(6) ∩ multipleOf(3)", () =>
			checker.intersect(multipleOf6, multipleOf3),
		);
		bench("numeric: multipleOf(6) ∩ multipleOf(4) → LCM", () =>
			checker.intersect(multipleOf6, multipleOf4),
		);
		bench("numeric: multipleOf from one side only", () =>
			checker.intersect(multipleOfSingle, integerPlain),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("string: minLength + maxLength", () =>
			checker.intersect(stringMinLength, stringMaxLength),
		);
		bench("string: pattern + minLength", () =>
			checker.intersect(stringPattern, stringMinLengthOnly),
		);
		bench("string: format + plain", () =>
			checker.intersect(stringFormat, stringPlain),
		);
		bench("string: all keywords combined", () =>
			checker.intersect(stringAllKeywords, stringAllKeywords2),
		);
		bench("string: tighter minLength wins", () =>
			checker.intersect(minLengthA, minLengthB),
		);
		bench("string: tighter maxLength wins", () =>
			checker.intersect(maxLengthA, maxLengthB),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("type: incompatible (string ∩ number) → null", () =>
			checker.intersect(stringSchema, numberSchema),
		);
		bench("type: integer ∩ number → integer", () =>
			checker.intersect(integerSchema, numberSchema),
		);
		bench("type: number ∩ integer → integer (commutative)", () =>
			checker.intersect(numberSchema, integerSchema),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("enum: overlapping → common values", () =>
			checker.intersect(enumA, enumB),
		);
		bench("enum: disjoint → null", () =>
			checker.intersect(enumDisjoint, enumDisjoint2),
		);
		bench("enum: large overlap", () =>
			checker.intersect(enumOverlap, enumOverlap2),
		);
		bench("enum: commutative check", () =>
			checker.intersect(enumLarge, enumSmall),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("const: same value → preserved", () =>
			checker.intersect(constA, constSame),
		);
		bench("const: different → null", () => checker.intersect(constA, constB));
		bench("const: compatible type → const + type", () =>
			checker.intersect(constIncompatType, stringSchema),
		);
		bench("const: incompatible type → null", () =>
			checker.intersect(constIncompatType, numberSchema),
		);
		bench("const ∩ enum containing const", () =>
			checker.intersect(constWithEnum, enumForConst),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("object: disjoint properties combined", () =>
			checker.intersect(objectA, objectB),
		);
		bench("object: overlapping property merged", () =>
			checker.intersect(objectOverlap, objectOverlapConstraint),
		);
		bench("object: required union", () =>
			checker.intersect(objectRequiredA, objectRequiredB),
		);
		bench("object: additionalProperties false ∩ true", () =>
			checker.intersect(objectAdditionalPropsFalse, objectAdditionalPropsTrue),
		);
		bench("object: additionalProperties schema ∩ schema", () =>
			checker.intersect(
				objectAdditionalPropsSchema,
				objectAdditionalPropsSchemaConstrained,
			),
		);
		bench("object: closed + extra required → null", () =>
			checker.intersect(closedObjectWithRequired, objectWithExtraRequired),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("patternProperties: same pattern → merged", () =>
			checker.intersect(patternPropA, patternPropB),
		);
		bench("patternProperties: different patterns → both kept", () =>
			checker.intersect(patternPropDiffA, patternPropDiffB),
		);
		bench("minProperties: tighter wins", () =>
			checker.intersect(minPropsA, minPropsB),
		);
		bench("maxProperties: tighter wins", () =>
			checker.intersect(maxPropsA, maxPropsB),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("array: minItems tighter wins", () =>
			checker.intersect(arrayMinItems, arrayMinItemsTight),
		);
		bench("array: maxItems tighter wins", () =>
			checker.intersect(arrayMaxItems, arrayMaxItemsTight),
		);
		bench("array: uniqueItems true wins", () =>
			checker.intersect(arrayUniqueItems, arrayPlain),
		);
		bench("array: items schemas merged", () =>
			checker.intersect(arrayItemsA, arrayItemsB),
		);
		bench("array: items + constraints from other", () =>
			checker.intersect(arrayItemsAndConstraints, arrayConstraintsOnly),
		);
		bench("array: tuple items merged by index", () =>
			checker.intersect(tupleA, tupleB),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("type array: common types preserved", () =>
			checker.intersect(multiTypeA, multiTypeB),
		);
		bench("type array: disjoint → null", () =>
			checker.intersect(multiTypeDisjointA, multiTypeDisjointB),
		);
		bench("type array: multi ∩ single", () =>
			checker.intersect(multiTypeSingle, stringSchema),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("boolean: true ∩ true", () => checker.intersect(boolTrue, boolTrue));
		bench("boolean: false ∩ false → false", () =>
			checker.intersect(boolFalse, boolFalse),
		);
		bench("boolean: true ∩ schema → schema", () =>
			checker.intersect(boolTrue, schemaWithMinLength),
		);
		bench("boolean: false ∩ schema → false", () =>
			checker.intersect(boolFalse, stringSchema),
		);
		bench("boolean: true ∩ false → false", () =>
			checker.intersect(boolTrue, boolFalse),
		);
		bench("empty: {} ∩ typed → typed", () =>
			checker.intersect({}, schemaWithMinLength),
		);
		bench("empty: {} ∩ {} → {}", () => checker.intersect({}, {}));
	});
});

summary(() => {
	boxplot(() => {
		bench("dependencies: array form merged", () =>
			checker.intersect(depsArrayA, depsArrayB),
		);
		bench("dependencies: schema form merged", () =>
			checker.intersect(depsSchemaA, depsSchemaB),
		);
		bench("dependencies: disjoint keys → both kept", () =>
			checker.intersect(depsDisjointA, depsDisjointB),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("contains: schemas merged", () =>
			checker.intersect(containsA, containsB),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("logical: anyOf ∩ compatible type", () =>
			checker.intersect(anyOfSchema, stringSchema),
		);
		bench("logical: not preserved through merge", () =>
			checker.intersect(notSchema, notTarget),
		);
		bench("logical: allOf flattened into merge", () =>
			checker.intersect(allOfSchema, allOfTarget),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("format: same format → preserved", () =>
			checker.intersect(formatEmailA, formatEmailB),
		);
		bench("format: incompatible → null", () =>
			checker.intersect(formatEmailA, formatIpv4),
		);
		bench("format: one format + constraints", () =>
			checker.intersect(formatEmailWithMin, stringMin5),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("complex: full object merge", () =>
			checker.intersect(complexObjectA, complexObjectB),
		);
		bench("complex: nested objects both contribute", () =>
			checker.intersect(nestedObjectA, nestedObjectB),
		);
		bench("complex: array of typed objects", () =>
			checker.intersect(arrayOfObjectsA, arrayOfObjectsB),
		);
		bench("idempotent: schema ∩ itself", () =>
			checker.intersect(selfMergeSchema, selfMergeSchema),
		);
	});
});

// ─── Commutativity ───────────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("commutativity: numeric A∩B", () =>
			checker.intersect(numericA, numericB),
		);
		bench("commutativity: numeric B∩A", () =>
			checker.intersect(numericB, numericA),
		);
		bench("commutativity: string A∩B", () =>
			checker.intersect(stringMinLength, stringMaxLength),
		);
		bench("commutativity: string B∩A", () =>
			checker.intersect(stringMaxLength, stringMinLength),
		);
		bench("commutativity: object A∩B", () =>
			checker.intersect(objectA, objectB),
		);
		bench("commutativity: object B∩A", () =>
			checker.intersect(objectB, objectA),
		);
		bench("commutativity: enum A∩B", () =>
			checker.intersect(enumOverlap, enumOverlap2),
		);
		bench("commutativity: enum B∩A", () =>
			checker.intersect(enumOverlap2, enumOverlap),
		);
	});
});

await run();
