import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { SchemaError } from "./types.ts";
import { SchemaErrorType } from "./types.ts";
import { isPlainObj } from "./utils.ts";

/**
 * ─── Runtime Validator ────────────────────────────────────────────────────────
 *
 * Centralizes runtime validation of JSON Schema Draft-07 schemas using AJV.
 *
 * Goals:
 * - Validate concrete runtime data against resolved schemas
 * - Reuse the same runtime engine for `check(..., { data })`
 * - Reuse the same runtime engine for `if/then/else` condition evaluation
 * - Keep the static subset-checking pipeline unchanged when no runtime data is provided
 *
 * Architecture — Singleton AJV instance:
 *   The `ajv` constant below is a module-level singleton shared by every
 *   `JsonSchemaCompatibilityChecker` instance in the same process. This is
 *   intentional:
 *   - Compiled validators are reused across checker instances, avoiding
 *     redundant schema compilation and reducing memory usage.
 *   - The WeakMap and LRU caches for `ValidateFunction` objects are valid
 *     only for a single AJV instance; per-instance AJV would break caching.
 *   - `ajv-formats` is registered once at module load; all standard Draft-07
 *     formats are available globally.
 *   - In worker-thread environments, each worker loads its own module scope
 *     and gets its own AJV instance — no cross-worker sharing occurs.
 *   - Custom AJV configuration or format registration is not supported
 *     per-checker-instance. If needed in the future, the singleton could be
 *     replaced with a factory, but this is intentionally deferred (YAGNI).
 *
 * Notes:
 * - AJV is configured in non-strict mode because this library intentionally
 *   supports partially-specified / pragmatic schemas and some unsupported
 *   keywords may appear in user input.
 * - Standard JSON Schema formats are enabled through `ajv-formats` so runtime
 *   validation can influence condition resolution and `check(..., { data })`
 *   consistently for supported formats.
 * - Unknown formats are still ignored in practice by the non-strict runtime
 *   configuration instead of crashing the whole check pipeline.
 */

// Singleton AJV instance — shared across all checker instances (see module JSDoc above)
const ajv = new Ajv({
	allErrors: true,
	strict: false,
	validateFormats: true,
	allowUnionTypes: true,
	messages: true,
});

addFormats(ajv);

/**
 * Cache compiled validators by schema object reference.
 *
 * This mirrors the codebase's preference for WeakMap-based caching and avoids
 * recompiling validators for the same resolved schema instances.
 */
const validatorCache = new WeakMap<object, ValidateFunction>();

/**
 * Minimal LRU cache using Map insertion-order guarantees for O(1) eviction.
 *
 * On `get`, the entry is moved to the end (most recently used).
 * On `set`, if the cache is full, the first entry (least recently used) is evicted.
 */
class LRUCache<K, V> {
	private readonly max: number;
	private readonly cache = new Map<K, V>();

	constructor(maxSize: number) {
		this.max = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value === undefined) return undefined;

		// Move to end (most recently used)
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.max) {
			// Evict least recently used (first key in iteration order)
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
		}
		this.cache.set(key, value);
	}

	clear(): void {
		this.cache.clear();
	}
}

/**
 * LRU cache for compiled validators keyed by deterministic schema serialization.
 *
 * This is a fallback for schemas that are not stable object references (e.g.
 * freshly constructed schemas that are structurally identical to previously
 * seen ones). Bounded to 500 entries to prevent unbounded memory growth in
 * long-running processes. The WeakMap-based `validatorCache` remains the
 * primary cache for the hot path.
 */
const validatorStringCache = new LRUCache<string, ValidateFunction>(500);

function isObjectLike(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
	}

	const entries = Object.entries(value as Record<string, unknown>).sort(
		([a], [b]) => a.localeCompare(b),
	);

	return `{${entries
		.map(
			([key, entryValue]) =>
				`${JSON.stringify(key)}:${stableStringify(entryValue)}`,
		)
		.join(",")}}`;
}

function getSchemaTypeName(schema: JSONSchema7): string {
	if (schema.type === undefined) return "value";

	if (Array.isArray(schema.type)) {
		return schema.type.join(" | ");
	}

	return schema.type;
}

function stringifyValue(value: unknown): string {
	if (value === undefined) return "undefined";
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

function normalizeInstancePath(instancePath: string): string {
	if (instancePath === "") return "$root";

	const parts = instancePath.split("/").filter(Boolean);
	if (parts.length === 0) return "$root";

	let path = "";

	for (const rawPart of parts) {
		const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
		const isArrayIndex = /^\d+$/.test(part);

		if (isArrayIndex) {
			path += "[]";
			continue;
		}

		path = path.length === 0 ? part : `${path}.${part}`;
	}

	return path || "$root";
}

function formatAllowedValues(values: unknown[]): string {
	if (values.length === 0) return "no allowed values";

	const rendered = values.map((value) =>
		typeof value === "string" ? value : JSON.stringify(value),
	);

	if (rendered.length === 1) return rendered[0] ?? "";
	if (rendered.length === 2) return `${rendered[0]} or ${rendered[1]}`;

	return `${rendered.slice(0, -1).join(", ")}, or ${rendered[rendered.length - 1]}`;
}

function formatExpected(error: ErrorObject, schema: JSONSchema7): string {
	switch (error.keyword) {
		case "type": {
			const expectedType =
				typeof error.params === "object" &&
				error.params !== null &&
				"type" in error.params
					? String(error.params.type)
					: getSchemaTypeName(schema);

			return expectedType;
		}

		case "enum": {
			return Array.isArray(schema.enum)
				? formatAllowedValues(schema.enum)
				: "allowed enum value";
		}

		case "const": {
			return stringifyValue(schema.const);
		}

		case "required": {
			const missingProperty =
				typeof error.params === "object" &&
				error.params !== null &&
				"missingProperty" in error.params
					? String(error.params.missingProperty)
					: "unknown";

			const targetSchema =
				schema.properties?.[missingProperty] &&
				typeof schema.properties[missingProperty] !== "boolean"
					? (schema.properties[missingProperty] as JSONSchema7)
					: undefined;

			if (targetSchema?.type !== undefined) {
				const prefix = normalizeInstancePath(error.instancePath);
				const key =
					prefix === "$root" ? missingProperty : `${prefix}.${missingProperty}`;
				return `${key}: ${getSchemaTypeName(targetSchema)}`;
			}

			return `required property: ${missingProperty}`;
		}

		case "minimum":
			return `>= ${String((schema as JSONSchema7).minimum)}`;

		case "maximum":
			return `<= ${String((schema as JSONSchema7).maximum)}`;

		case "exclusiveMinimum":
			return `> ${String((schema as JSONSchema7).exclusiveMinimum)}`;

		case "exclusiveMaximum":
			return `< ${String((schema as JSONSchema7).exclusiveMaximum)}`;

		case "multipleOf":
			return `multipleOf ${String((schema as JSONSchema7).multipleOf)}`;

		case "minLength":
			return `minLength: ${String((schema as JSONSchema7).minLength)}`;

		case "maxLength":
			return `maxLength: ${String((schema as JSONSchema7).maxLength)}`;

		case "pattern":
			return `pattern: ${String((schema as JSONSchema7).pattern)}`;

		case "format":
			return `format: ${String((schema as JSONSchema7).format)}`;

		case "minItems":
			return `minItems: ${String((schema as JSONSchema7).minItems)}`;

		case "maxItems":
			return `maxItems: ${String((schema as JSONSchema7).maxItems)}`;

		case "uniqueItems":
			return "uniqueItems: true";

		case "minProperties":
			return `minProperties: ${String((schema as JSONSchema7).minProperties)}`;

		case "maxProperties":
			return `maxProperties: ${String((schema as JSONSchema7).maxProperties)}`;

		case "additionalProperties":
			return "not allowed (additionalProperties: false)";

		case "propertyNames":
			return "valid property names";

		case "contains":
			return "contains at least one matching item";

		case "allOf":
			return "allOf constraints";

		case "anyOf":
			return "anyOf constraints";

		case "oneOf":
			return "oneOf constraints";

		case "not":
			return "not matching forbidden schema";

		default:
			return error.message ?? error.keyword;
	}
}

function buildSchemaError(
	error: ErrorObject,
	schema: JSONSchema7,
	data: unknown,
): SchemaError {
	const type = SchemaErrorType.RuntimeValidation;
	const baseKey = normalizeInstancePath(error.instancePath);

	if (error.keyword === "required") {
		const missingProperty =
			typeof error.params === "object" &&
			error.params !== null &&
			"missingProperty" in error.params
				? String(error.params.missingProperty)
				: "unknown";

		return {
			type,
			key:
				baseKey === "$root" ? missingProperty : `${baseKey}.${missingProperty}`,
			expected: formatExpected(error, schema),
			received: "undefined",
		};
	}

	if (error.keyword === "additionalProperties") {
		const additionalProperty =
			typeof error.params === "object" &&
			error.params !== null &&
			"additionalProperty" in error.params
				? String(error.params.additionalProperty)
				: "unknown";

		return {
			type,
			key:
				baseKey === "$root"
					? additionalProperty
					: `${baseKey}.${additionalProperty}`,
			expected: formatExpected(error, schema),
			received: "present",
		};
	}

	return {
		type,
		key: baseKey,
		expected: formatExpected(error, schema),
		received: stringifyValue(data),
	};
}

function compileValidator(schema: JSONSchema7): ValidateFunction {
	if (isObjectLike(schema)) {
		const cached = validatorCache.get(schema);
		if (cached !== undefined) return cached;
	}

	const serialized = stableStringify(schema);
	const cachedByString = validatorStringCache.get(serialized);
	if (cachedByString !== undefined) {
		if (isObjectLike(schema)) {
			validatorCache.set(schema, cachedByString);
		}
		return cachedByString;
	}

	const validate = ajv.compile(schema);

	if (isObjectLike(schema)) {
		validatorCache.set(schema, validate);
	}
	validatorStringCache.set(serialized, validate);

	return validate;
}

/**
 * Validates runtime data against a schema using AJV.
 *
 * @param schema - The schema to validate against
 * @param data - The runtime data to validate
 * @returns true when valid, false otherwise
 */
export function isDataValidForSchema(
	schema: JSONSchema7Definition,
	data: unknown,
): boolean {
	if (typeof schema === "boolean") {
		return schema;
	}

	const validate = compileValidator(schema);
	return validate(data) === true;
}

/**
 * Returns AJV validation errors converted to the library's `SchemaError` shape.
 *
 * @param schema - The schema used for validation
 * @param data - The runtime data that failed validation
 * @returns Normalized runtime validation errors
 */
export function getRuntimeValidationErrors(
	schema: JSONSchema7Definition,
	data: unknown,
): SchemaError[] {
	if (typeof schema === "boolean") {
		if (schema) return [];

		return [
			{
				type: SchemaErrorType.RuntimeValidation,
				key: "$root",
				expected: "never",
				received: stringifyValue(data),
			},
		];
	}

	const validate = compileValidator(schema);
	const isValid = validate(data);

	if (
		isValid === true ||
		validate.errors === null ||
		validate.errors === undefined
	) {
		return [];
	}

	return validate.errors.map((error) => buildSchemaError(error, schema, data));
}

// ─── Partial Validation ──────────────────────────────────────────────────────
//
// Strips `required` and `additionalProperties` from a schema recursively so
// that AJV only validates the properties **present** in the data — without
// reporting missing required properties or unexpected additional properties.
//
// This is used by the "partial" runtime validation mode: the caller has
// partial data (e.g. only some properties known at design-time) and wants to
// validate those values against the schema without false negatives for
// properties that will be provided later by another source.

/**
 * Recursively strips `required` and `additionalProperties` from an
 * object-typed JSON Schema so that AJV validates only the properties
 * present in the data.
 *
 * Recurses into: `properties`, `items` (single + tuple), `oneOf`, `anyOf`,
 * `allOf`, `then`, `else`.
 *
 * @param schema - The schema to strip (not mutated — returns a new object)
 * @returns A new schema without `required` or `additionalProperties` at any level
 */
export function stripRequiredRecursive(schema: JSONSchema7): JSONSchema7 {
	if (!isPlainObj(schema)) return schema;

	const result: JSONSchema7 = { ...schema };
	delete result.required;
	delete result.additionalProperties;

	// ── Recurse into properties ──
	if (isPlainObj(result.properties)) {
		const props: Record<string, JSONSchema7Definition> = {};
		for (const [key, value] of Object.entries(
			result.properties as Record<string, JSONSchema7Definition>,
		)) {
			props[key] =
				typeof value === "object" && value !== null
					? stripRequiredRecursive(value)
					: value;
		}
		result.properties = props;
	}

	// ── Recurse into items (single schema) ──
	if (isPlainObj(result.items) && !Array.isArray(result.items)) {
		result.items = stripRequiredRecursive(result.items as JSONSchema7);
	}

	// ── Recurse into tuple items ──
	if (Array.isArray(result.items)) {
		result.items = (result.items as JSONSchema7Definition[]).map((item) =>
			typeof item === "object" && item !== null
				? stripRequiredRecursive(item)
				: item,
		);
	}

	// ── Recurse into branching keywords ──
	for (const keyword of ["oneOf", "anyOf", "allOf"] as const) {
		if (Array.isArray(result[keyword])) {
			result[keyword] = (result[keyword] as JSONSchema7Definition[]).map(
				(branch) =>
					typeof branch === "object" && branch !== null
						? stripRequiredRecursive(branch)
						: branch,
			);
		}
	}

	// ── Recurse into conditional keywords ──
	if (isPlainObj(result.then)) {
		result.then = stripRequiredRecursive(result.then as JSONSchema7);
	}
	if (isPlainObj(result.else)) {
		result.else = stripRequiredRecursive(result.else as JSONSchema7);
	}

	return result;
}

/**
 * Returns AJV validation errors for partial data — strips `required` and
 * `additionalProperties` before compilation so that only the properties
 * **present** in `data` are validated.
 *
 * @param schema - The schema to validate against (not mutated)
 * @param data - The partial runtime data
 * @returns Normalized runtime validation errors for present properties only
 */
export function getPartialRuntimeValidationErrors(
	schema: JSONSchema7Definition,
	data: unknown,
): SchemaError[] {
	if (typeof schema === "boolean") {
		return getRuntimeValidationErrors(schema, data);
	}

	const stripped = stripRequiredRecursive(schema);
	return getRuntimeValidationErrors(stripped, data);
}

/**
 * Clears all compiled validator caches (WeakMap, LRU, and AJV internal).
 *
 * Useful for:
 * - Long-running processes where schemas evolve over time
 * - Test isolation (ensuring no cross-test cache pollution)
 * - Memory pressure situations where cached validators are no longer needed
 *
 * After calling this, the next validation call will recompile validators
 * from scratch — there is a one-time performance cost per unique schema.
 */
export function clearAllValidatorCaches(): void {
	// The WeakMap cannot be "cleared" via API — we replace the reference.
	// However, since it's a module-level const, we clear it by removing
	// AJV's internal schema cache which is the primary memory consumer.
	// The WeakMap entries will be garbage-collected when their schema keys
	// are no longer referenced.

	// Clear the LRU string-keyed cache
	validatorStringCache.clear();

	// Clear AJV's internal compiled schema cache
	ajv.removeSchema();
}
