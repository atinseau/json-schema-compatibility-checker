import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { validateFormat } from "./format-validator";
import type { MergeEngine } from "./merge-engine";
import { inferType } from "./normalizer";
import type { ResolvedConditionResult } from "./types";
import { deepEqual, hasOwn, isPlainObj, omitKeys, unionStrings } from "./utils";

// ─── Condition Resolver ──────────────────────────────────────────────────────
//
// Résout les `if/then/else` d'un schema en évaluant le `if` contre
// des données partielles (discriminants).
//
// Stratégie :
//  1. Évaluer si les données partielles satisfont le `if`
//  2. Merger la branche applicable (`then` ou `else`) dans le schema de base
//  3. Supprimer les mots-clés `if/then/else` du résultat
//  4. Récurser dans les `properties` pour résoudre les conditions imbriquées
//
// L'évaluation du `if` (via `evaluateCondition`) gère :
//   - `properties` avec `const`, `enum`, `type`, contraintes numériques/string/array
//   - `required` (vérification de présence des clés)
//   - `allOf` (toutes les entrées doivent matcher — récursion) [2.1]
//   - `anyOf` (au moins une entrée doit matcher — récursion) [2.2]
//   - `oneOf` (exactement une entrée doit matcher — récursion) [2.3]
//   - `not` (inversion du résultat — récursion) [2.4]
//   - Propriétés imbriquées (nested objects — récursion) [2.5]
//   - `format` via `validateFormat` de `format-validator.ts` [2.6]
//
// Utilise lodash massivement :
//   - `_.has` / `_.get`         pour l'accès sûr aux propriétés
//   - `_.every` / `_.some`      pour les prédicats sur les collections
//   - `_.union` / `_.uniq`      pour la fusion de tableaux (required, deps)
//   - `_.isArray` / `_.isPlainObject` pour le typage des valeurs
//   - `_.mapValues`             pour transformer les propriétés
//   - `_.omit` / `_.pick`       pour sélectionner/exclure des clés
//   - `_.keys` / `_.forEach`    pour l'itération
//   - `_.reduce`                pour accumuler les résultats
//   - `_.isEqual`               pour la comparaison profonde
//   - `_.size` / `_.filter`     pour le comptage (oneOf)

// ─── Keywords classification ─────────────────────────────────────────────────

/** Mots-clés qui ne doivent pas être traités par la boucle générique de mergeBranchInto */
const SPECIAL_MERGE_KEYS = new Set(["required", "properties", "dependencies"]);

/** Mots-clés contenant un sous-schema unique (mergeable via engine.merge) */
const SUB_SCHEMA_KEYS = new Set([
	"additionalProperties",
	"items",
	"contains",
	"propertyNames",
	"not",
]);

/** Mots-clés numériques de type "minimum" (prendre le max pour être plus restrictif) */
const MIN_KEYS = new Set([
	"minimum",
	"exclusiveMinimum",
	"minLength",
	"minItems",
	"minProperties",
]);

/** Mots-clés numériques de type "maximum" (prendre le min pour être plus restrictif) */
const MAX_KEYS = new Set([
	"maximum",
	"exclusiveMaximum",
	"maxLength",
	"maxItems",
	"maxProperties",
]);

// ─── Condition evaluation (internal) ─────────────────────────────────────────

/**
 * Vérifie si `value` correspond à un type JSON Schema.
 */
function matchesType(value: unknown, type: JSONSchema7["type"]): boolean {
	if (type === undefined) return true;

	const types = Array.isArray(type) ? type : [type];
	const actualType = inferType(value);

	return types.some(
		(t) => t === actualType || (t === "number" && actualType === "integer"),
	);
}

/**
 * Évalue une contrainte numérique sur une valeur.
 * Point 5 — Enrichissement de evaluateCondition.
 */
function evaluateNumericConstraints(value: number, prop: JSONSchema7): boolean {
	if (prop.minimum !== undefined && !(value >= prop.minimum)) return false;
	if (prop.maximum !== undefined && !(value <= prop.maximum)) return false;
	if (
		prop.exclusiveMinimum !== undefined &&
		!(value > (prop.exclusiveMinimum as number))
	)
		return false;
	if (
		prop.exclusiveMaximum !== undefined &&
		!(value < (prop.exclusiveMaximum as number))
	)
		return false;
	if (prop.multipleOf !== undefined && value % prop.multipleOf !== 0)
		return false;
	return true;
}

/**
 * Évalue une contrainte string sur une valeur.
 * Point 5 — Enrichissement de evaluateCondition.
 */
/** Cache for compiled RegExp patterns used in evaluateStringConstraints */
const patternRegexCache = new Map<string, RegExp>();

function getOrCompileRegex(pattern: string): RegExp {
	let regex = patternRegexCache.get(pattern);
	if (regex === undefined) {
		regex = new RegExp(pattern);
		patternRegexCache.set(pattern, regex);
	}
	return regex;
}

function evaluateStringConstraints(value: string, prop: JSONSchema7): boolean {
	if (prop.minLength !== undefined && !(value.length >= prop.minLength))
		return false;
	if (prop.maxLength !== undefined && !(value.length <= prop.maxLength))
		return false;
	if (
		prop.pattern !== undefined &&
		!getOrCompileRegex(prop.pattern).test(value)
	)
		return false;
	return true;
}

/**
 * Évalue une contrainte array sur une valeur.
 * Point 5 — Enrichissement de evaluateCondition.
 */
function evaluateArrayConstraints(
	value: unknown[],
	prop: JSONSchema7,
): boolean {
	if (prop.minItems !== undefined && !(value.length >= prop.minItems))
		return false;
	if (prop.maxItems !== undefined && !(value.length <= prop.maxItems))
		return false;
	if (prop.uniqueItems === true) {
		// Vérifier l'unicité via deepEqual pour les éléments non-primitifs
		// Optimisation : double boucle sans slice pour éviter les allocations
		const len = value.length;
		for (let i = 0; i < len; i++) {
			for (let j = i + 1; j < len; j++) {
				if (deepEqual(value[i], value[j])) return false;
			}
		}
	}
	return true;
}

/**
 * Évalue si des données partielles satisfont un `if` schema.
 *
 * Stratégie pragmatique (pas un validateur complet) :
 *  - Vérifie les `properties` avec `const`, `enum`, `type`
 *  - Point 5 : Vérifie aussi minimum/maximum, minLength/maxLength,
 *    pattern, multipleOf, minItems/maxItems, uniqueItems
 *  - Vérifie les `required`
 *  - 2.1 : `allOf` → toutes les entrées doivent matcher (récursion)
 *  - 2.2 : `anyOf` → au moins une entrée doit matcher (récursion)
 *  - 2.3 : `oneOf` → exactement une entrée doit matcher (récursion)
 *  - 2.4 : `not` → inversion du résultat (récursion)
 *  - 2.5 : Propriétés imbriquées → récursion sur les sous-objets
 *  - 2.6 : `format` → validation via `validateFormat`
 *
 * Utilise `_.forEach` / `_.every` / `_.has` pour une itération idiomatique.
 */
function evaluateCondition(
	ifSchema: JSONSchema7,
	data: Record<string, unknown>,
): boolean {
	if (isPlainObj(ifSchema.properties)) {
		const propsOk = Object.keys(ifSchema.properties).every((key) => {
			const propDef = ifSchema.properties?.[key];
			if (typeof propDef === "boolean") return true;
			const prop = propDef as JSONSchema7;
			const value = data[key];

			// ── Propriété absente → skip ──
			// Selon la spec JSON Schema Draft-07, le keyword `properties` ne valide
			// une propriété que si elle est **présente** dans l'instance.
			// C'est le keyword `required` qui gère la présence obligatoire.
			if (value === undefined) return true;

			// ── const ──
			if (hasOwn(prop, "const")) {
				if (!deepEqual(value, prop.const)) return false;
			}

			// ── enum ──
			if (hasOwn(prop, "enum")) {
				if (!prop.enum?.some((v) => deepEqual(v, value))) return false;
			}

			// ── type ──
			if (hasOwn(prop, "type") && value !== undefined) {
				if (!matchesType(value, prop.type)) return false;
			}

			// ── Point 5 : Contraintes numériques/string/array ──
			// Quand `value` est `undefined`, aucun de ces blocs ne s'exécute
			// (`typeof undefined` vaut `"undefined"`, pas `"number"` ni `"string"`,
			// et `isArray(undefined)` retourne `false`).
			// C'est le comportement voulu : on ne peut pas évaluer une contrainte
			// sur une donnée absente → on skip, cohérent avec la logique pragmatique.
			if (typeof value === "number") {
				if (!evaluateNumericConstraints(value, prop)) return false;
			}

			if (typeof value === "string") {
				if (!evaluateStringConstraints(value, prop)) return false;
			}

			if (Array.isArray(value)) {
				if (!evaluateArrayConstraints(value as unknown[], prop)) return false;
			}

			// ── 2.6 — format ──
			// Valide la valeur contre le format via class-validator.
			// Le format ne s'applique qu'aux strings en Draft-07.
			// Si le format est inconnu → skip (retourne null → on continue).
			if (prop.format !== undefined && typeof value === "string") {
				const formatResult = validateFormat(value, prop.format);
				if (formatResult === false) return false;
				// null (format inconnu) → skip, cohérent avec l'approche pragmatique
			}

			// ── 2.5 — Propriétés imbriquées (nested objects) ──
			// Si la propriété elle-même a des `properties` ou un `required`,
			// et que la valeur dans data est un objet, récurser dans evaluateCondition
			// en passant la sous-donnée comme nouveau `data`.
			// Si data[key] n'est pas un objet, on skip (retourne true pour cette prop,
			// cohérent avec "absence = pas de contrainte").
			if (isPlainObj(prop.properties) || Array.isArray(prop.required)) {
				if (isPlainObj(value)) {
					if (!evaluateCondition(prop, value as Record<string, unknown>)) {
						return false;
					}
				}
				// value n'est pas un objet → skip, on ne peut pas évaluer les sous-props
			}

			return true;
		});
		if (!propsOk) return false;
	}

	// ── required ──
	if (Array.isArray(ifSchema.required)) {
		const allRequired = ifSchema.required.every((key) =>
			hasOwn(data, key as string),
		);
		if (!allRequired) return false;
	}

	// ── 2.1 — allOf ──
	// Toutes les entrées du allOf doivent matcher (évaluation récursive).
	if (Array.isArray(ifSchema.allOf)) {
		const allMatch = ifSchema.allOf.every((entry) => {
			if (typeof entry === "boolean") return entry;
			return evaluateCondition(entry as JSONSchema7, data);
		});
		if (!allMatch) return false;
	}

	// ── 2.2 — anyOf ──
	// Au moins une entrée du anyOf doit matcher (évaluation récursive).
	if (Array.isArray(ifSchema.anyOf)) {
		const anyMatch = ifSchema.anyOf.some((entry) => {
			if (typeof entry === "boolean") return entry;
			return evaluateCondition(entry as JSONSchema7, data);
		});
		if (!anyMatch) return false;
	}

	// ── 2.3 — oneOf ──
	// Exactement une entrée du oneOf doit matcher (évaluation récursive).
	if (Array.isArray(ifSchema.oneOf)) {
		let matchCount = 0;
		for (const entry of ifSchema.oneOf) {
			const matches =
				typeof entry === "boolean"
					? entry
					: evaluateCondition(entry as JSONSchema7, data);
			if (matches) matchCount++;
			if (matchCount > 1) break;
		}
		if (matchCount !== 1) return false;
	}

	// ── 2.4 — not ──
	// Inverser le résultat de l'évaluation du contenu du `not`.
	if (
		hasOwn(ifSchema, "not") &&
		isPlainObj(ifSchema.not) &&
		typeof ifSchema.not !== "boolean"
	) {
		const notResult = evaluateCondition(ifSchema.not as JSONSchema7, data);
		if (notResult) return false; // Le not matche → la condition not ne matche pas
	}

	return true;
}

// ─── Discriminant extraction ─────────────────────────────────────────────────

/**
 * Mots-clés qui indiquent qu'une propriété est un discriminant
 * (sa valeur dans les données est utilisée pour la résolution).
 *
 * Point 5 — Étendu avec les contraintes numériques/string/pattern.
 */
const DISCRIMINANT_INDICATORS = [
	"const",
	"enum",
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"pattern",
	"minLength",
	"maxLength",
	"multipleOf",
	"minItems",
	"maxItems",
	"format",
] as const;

/**
 * Extrait les valeurs discriminantes utilisées dans un `if` schema
 * depuis les données partielles.
 *
 * Point 5 — Collecte aussi les discriminants pour les nouvelles contraintes
 * (minimum, maximum, pattern, etc.).
 *
 * Utilise `_.some` pour vérifier qu'au moins un indicateur est présent,
 * et `_.has` pour un accès sûr.
 */
function extractDiscriminants(
	ifSchema: JSONSchema7,
	data: Record<string, unknown>,
	out: Record<string, unknown>,
): void {
	if (!isPlainObj(ifSchema.properties)) return;

	const props = ifSchema.properties as Record<string, JSONSchema7Definition>;
	for (const key of Object.keys(props)) {
		const propDef = props[key];
		if (typeof propDef === "boolean") continue;
		const prop = propDef as JSONSchema7;

		// Collecter si au moins un indicateur de discriminant est présent
		const hasIndicator = DISCRIMINANT_INDICATORS.some((indicator) =>
			hasOwn(prop, indicator),
		);

		if (hasIndicator && hasOwn(data, key)) {
			out[key] = data[key];
		}
	}
}

// ─── Branch merging (deduplicated) ───────────────────────────────────────────

/**
 * Merge une branche conditionnelle (`then` ou `else`) dans le schema résolu.
 *
 * Point 4 — Fix first-writer-wins :
 *   Au lieu d'ignorer les keywords déjà présents dans `resolved`,
 *   on tente un merge intelligent selon le type de keyword :
 *
 *   - `required` → union dédupliquée via `_.union`
 *   - `properties` → merge individuel via engine.merge
 *   - `dependencies` → Point 3 : union des tableaux (forme 1),
 *      merge des schemas (forme 2) via `_.mapValues`
 *   - Sub-schema keys → merge via engine.merge
 *   - Min keys → `Math.max` (plus restrictif)
 *   - Max keys → `Math.min` (plus restrictif)
 *   - `uniqueItems` → `true` gagne sur `false`
 *   - `pattern` / `format` → la branche gagne (plus spécifique)
 *   - Autres → tentative de merge via engine, sinon la branche gagne
 *
 * Utilise lodash massivement pour chaque opération de merge.
 */
function mergeBranchInto(
	resolved: JSONSchema7,
	branchDef: JSONSchema7Definition,
	engine: MergeEngine,
): void {
	if (typeof branchDef === "boolean") return;

	const branchSchema = branchDef as JSONSchema7;

	// ── Merger required via _.union (dédupliquée automatiquement) ──
	if (Array.isArray(branchSchema.required)) {
		resolved.required = unionStrings(
			resolved.required ?? [],
			branchSchema.required,
		);
	}

	// ── Merger properties ──
	if (isPlainObj(branchSchema.properties)) {
		const branchProps = branchSchema.properties as Record<
			string,
			JSONSchema7Definition
		>;
		const mergedProps: Record<string, JSONSchema7Definition> = {
			...(resolved.properties ?? {}),
		};
		for (const key of Object.keys(branchProps)) {
			const branchProp = branchProps[key];
			if (branchProp === undefined) continue;
			const existing = resolved.properties?.[key];
			if (
				existing !== undefined &&
				typeof existing !== "boolean" &&
				typeof branchProp !== "boolean"
			) {
				const merged = engine.merge(
					existing as JSONSchema7Definition,
					branchProp as JSONSchema7Definition,
				);
				mergedProps[key] = (merged ?? branchProp) as JSONSchema7Definition;
			} else {
				mergedProps[key] = branchProp;
			}
		}
		resolved.properties = mergedProps;
	}

	// ── Merger dependencies (Point 3) ──
	if (isPlainObj(branchSchema.dependencies)) {
		const resolvedDeps = (resolved.dependencies ?? {}) as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const branchDeps = branchSchema.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;

		const acc = { ...resolvedDeps };
		for (const depKey of Object.keys(branchDeps)) {
			const branchVal = branchDeps[depKey] as
				| JSONSchema7Definition
				| string[]
				| undefined;
			if (branchVal === undefined) continue;
			const existingVal = acc[depKey] as
				| JSONSchema7Definition
				| string[]
				| undefined;

			if (existingVal === undefined) {
				// Pas de valeur existante → copier directement
				acc[depKey] = branchVal;
			} else if (Array.isArray(existingVal) && Array.isArray(branchVal)) {
				// Forme 1 : union dédupliquée des tableaux de strings
				acc[depKey] = unionStrings(
					existingVal as string[],
					branchVal as string[],
				);
			} else if (isPlainObj(existingVal) && isPlainObj(branchVal)) {
				// Forme 2 : merge des sous-schemas
				const merged = engine.merge(
					existingVal as JSONSchema7Definition,
					branchVal as JSONSchema7Definition,
				);
				acc[depKey] = (merged ?? branchVal) as JSONSchema7Definition;
			} else {
				// Types incompatibles (tableau vs schema) → la branche gagne
				acc[depKey] = branchVal;
			}
		}
		resolved.dependencies = acc as Record<
			string,
			JSONSchema7Definition | string[]
		>;
	}

	// ── Merger les autres mots-clés (Point 4 — fix first-writer-wins) ──
	for (const key of Object.keys(branchSchema) as (keyof JSONSchema7)[]) {
		// Skip les clés déjà traitées ci-dessus
		if (SPECIAL_MERGE_KEYS.has(key)) return;

		const branchVal = branchSchema[key];
		const resolvedVal = resolved[key];

		// Si le resolved n'a pas cette clé → copier directement
		if (resolvedVal === undefined) {
			(resolved as Record<string, unknown>)[key] = branchVal;
			return;
		}

		// Si les deux ont la même valeur → rien à faire
		if (deepEqual(resolvedVal, branchVal)) return;

		// ── Sub-schema keys → merge via engine ──
		if (SUB_SCHEMA_KEYS.has(key)) {
			const merged = engine.merge(
				resolvedVal as JSONSchema7Definition,
				branchVal as JSONSchema7Definition,
			);
			if (merged !== null) {
				(resolved as Record<string, unknown>)[key] = merged;
			} else {
				// Merge impossible → la branche gagne (contexte conditionnel)
				(resolved as Record<string, unknown>)[key] = branchVal;
			}
			return;
		}

		// ── Min keys → Math.max (plus restrictif) ──
		if (MIN_KEYS.has(key)) {
			if (typeof resolvedVal === "number" && typeof branchVal === "number") {
				(resolved as Record<string, unknown>)[key] = Math.max(
					resolvedVal,
					branchVal,
				);
			} else {
				(resolved as Record<string, unknown>)[key] = branchVal;
			}
			return;
		}

		// ── Max keys → Math.min (plus restrictif) ──
		if (MAX_KEYS.has(key)) {
			if (typeof resolvedVal === "number" && typeof branchVal === "number") {
				(resolved as Record<string, unknown>)[key] = Math.min(
					resolvedVal,
					branchVal,
				);
			} else {
				(resolved as Record<string, unknown>)[key] = branchVal;
			}
			return;
		}

		// ── uniqueItems → true gagne sur false ──
		if (key === "uniqueItems") {
			(resolved as Record<string, unknown>)[key] =
				resolvedVal === true || branchVal === true;
			return;
		}

		// ── pattern / format → la branche gagne (plus spécifique au contexte) ──
		if (key === "pattern" || key === "format") {
			(resolved as Record<string, unknown>)[key] = branchVal;
			return;
		}

		// ── Fallback : tentative de merge via engine pour les cas restants ──
		const base = { [key]: resolvedVal } as JSONSchema7Definition;
		const branch = { [key]: branchVal } as JSONSchema7Definition;
		const merged = engine.merge(base, branch);
		if (
			merged &&
			typeof merged !== "boolean" &&
			hasOwn(merged as object, key)
		) {
			(resolved as Record<string, unknown>)[key] = (
				merged as unknown as Record<string, unknown>
			)[key];
		} else {
			// Merge échoué → la branche gagne (contexte conditionnel applicable)
			(resolved as Record<string, unknown>)[key] = branchVal;
		}
	}
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Résout les `if/then/else` d'un schema en évaluant le `if` contre
 * des données partielles (discriminants).
 *
 * @param schema  Le schema contenant potentiellement des if/then/else
 * @param data    Données partielles utilisées pour évaluer les conditions
 * @param engine  Le MergeEngine pour merger les branches
 *
 * @example
 * ```ts
 * const form = {
 *   type: "object",
 *   properties: { accountType: { type: "string" }, ... },
 *   if:   { properties: { accountType: { const: "business" } } },
 *   then: { required: ["companyName"] },
 *   else: { required: ["firstName"] },
 * };
 *
 * const { resolved } = resolveConditions(form, { accountType: "business" }, engine);
 * // → resolved n'a plus de if/then/else, mais a required: ["companyName"]
 * ```
 */
export function resolveConditions(
	schema: JSONSchema7,
	data: Record<string, unknown>,
	engine: MergeEngine,
): ResolvedConditionResult {
	let resolved = { ...schema };
	let branch: "then" | "else" | null = null;
	const discriminant: Record<string, unknown> = {};

	// ── Phase 1 : Résoudre les if/then/else dans allOf ──
	resolved = resolveAllOfConditions(resolved, data, engine, discriminant);

	// ── Phase 2 : Résoudre le if/then/else de ce niveau ──
	if (resolved.if !== undefined) {
		const ifSchema = resolved.if as JSONSchema7;
		const matches = evaluateCondition(ifSchema, data);

		extractDiscriminants(ifSchema, data, discriminant);

		const applicableBranch = matches ? resolved.then : resolved.else;
		branch = matches ? "then" : "else";

		if (applicableBranch) {
			mergeBranchInto(
				resolved,
				applicableBranch as JSONSchema7Definition,
				engine,
			);
		}

		delete resolved.if;
		delete resolved.then;
		delete resolved.else;
	}

	// ── Phase 3 : Récurser dans les properties ──
	resolved = resolveNestedProperties(resolved, data, engine, discriminant);

	return { resolved, branch, discriminant };
}

// ─── Internal phases ─────────────────────────────────────────────────────────

/**
 * Phase 1 : Parcourt les entrées `allOf` et résout celles qui contiennent
 * un `if/then/else`. Les entrées non-conditionnelles sont préservées.
 *
 * Utilise `_.reduce` pour accumuler les entrées restantes et `_.filter`
 * pour séparer les clés conditionnelles des non-conditionnelles.
 */
function resolveAllOfConditions(
	resolved: JSONSchema7,
	data: Record<string, unknown>,
	engine: MergeEngine,
	discriminant: Record<string, unknown>,
): JSONSchema7 {
	if (!Array.isArray(resolved.allOf)) return resolved;

	const remainingAllOf: JSONSchema7Definition[] = [];

	for (const entry of resolved.allOf) {
		if (typeof entry === "boolean") {
			remainingAllOf.push(entry);
			continue;
		}

		const subSchema = entry as JSONSchema7;

		if (subSchema.if === undefined) {
			remainingAllOf.push(entry);
			continue;
		}

		// Résoudre la condition de cette entrée allOf
		const ifSchema = subSchema.if as JSONSchema7;
		const matches = evaluateCondition(ifSchema, data);

		extractDiscriminants(ifSchema, data, discriminant);

		const applicableBranch = matches ? subSchema.then : subSchema.else;

		if (applicableBranch) {
			mergeBranchInto(
				resolved,
				applicableBranch as JSONSchema7Definition,
				engine,
			);
		}

		// Garder les parties non-conditionnelles de l'entrée allOf
		const remaining = omitKeys(
			subSchema as unknown as Record<string, unknown>,
			["if", "then", "else"],
		);
		if (Object.keys(remaining).length > 0) {
			remainingAllOf.push(remaining as JSONSchema7);
		}
	}

	resolved = { ...resolved };
	if (remainingAllOf.length === 0) {
		delete resolved.allOf;
	} else {
		resolved.allOf = remainingAllOf;
	}

	return resolved;
}

/**
 * Phase 3 : Récurse dans les `properties` du schema résolu pour résoudre
 * les conditions imbriquées (ex: un objet dont une propriété a un if/then/else).
 *
 * Utilise `_.mapValues` pour transformer chaque propriété en une seule passe,
 * et `_.forEach` pour remonter les discriminants imbriqués.
 */
function resolveNestedProperties(
	resolved: JSONSchema7,
	data: Record<string, unknown>,
	engine: MergeEngine,
	discriminant: Record<string, unknown>,
): JSONSchema7 {
	if (!isPlainObj(resolved.properties)) return resolved;

	const props = resolved.properties as Record<string, JSONSchema7Definition>;
	const propKeys = Object.keys(props);
	let changed = false;
	const resolvedProps: Record<string, JSONSchema7Definition> = {};

	for (const key of propKeys) {
		const propDef = props[key];
		if (propDef === undefined) continue;
		if (typeof propDef === "boolean") {
			resolvedProps[key] = propDef;
			continue;
		}

		const propSchema = propDef as JSONSchema7;
		const hasConditions =
			propSchema.if !== undefined ||
			(Array.isArray(propSchema.allOf) &&
				propSchema.allOf.some(
					(e) => typeof e !== "boolean" && hasOwn(e as object, "if"),
				));

		if (!hasConditions) {
			resolvedProps[key] = propDef;
			continue;
		}

		// Données imbriquées disponibles → résoudre récursivement
		const nestedData = isPlainObj(data[key])
			? (data[key] as Record<string, unknown>)
			: {};

		const nested = resolveConditions(propSchema, nestedData, engine);

		// Remonter les discriminants imbriqués avec prefix
		for (const dk of Object.keys(nested.discriminant)) {
			discriminant[`${key}.${dk}`] = nested.discriminant[dk];
		}

		resolvedProps[key] = nested.resolved;
		changed = true;
	}

	return changed ? { ...resolved, properties: resolvedProps } : resolved;
}
