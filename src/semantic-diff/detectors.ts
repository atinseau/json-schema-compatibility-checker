import type { JSONSchema7 } from "json-schema";
import type { SchemaDiff } from "../types";
import type { SemanticDiff } from "./types";

// ─── Semantic Diff Detectors ─────────────────────────────────────────────────
//
// Fonctions de détection par catégorie d'incompatibilité.
// Chaque détecteur analyse les diffs structurels et les schemas originaux
// pour produire des SemanticDiff lisibles et actionnables.
//
// Organisation :
//   1. Property detectors  — missing, optional, not-allowed
//   2. Type detectors      — mismatch, too-wide
//   3. Value detectors     — enum, const
//   4. Constraint detectors — min/max/length/items/etc.
//   5. Structure detectors — additionalProperties, items
//   6. Format detectors    — format, pattern
//   7. Fallback            — schema-incompatible (catch-all)

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formate un type JSON Schema pour l'affichage (string, array → "string | number") */
export function formatType(type: unknown): string {
	if (Array.isArray(type)) {
		return type.join(" | ");
	}
	if (type === undefined || type === null) {
		return "any";
	}
	return String(type);
}

/**
 * Extrait le type lisible d'un sous-schema pour les messages.
 * Gère les cas const, enum, type, et boolean schemas.
 */
function extractTypeLabel(schema: unknown): string {
	if (typeof schema === "boolean") {
		return schema ? "any" : "never";
	}
	if (typeof schema !== "object" || schema === null) {
		return "unknown";
	}
	const s = schema as JSONSchema7;
	if (s.const !== undefined) {
		return `const(${JSON.stringify(s.const)})`;
	}
	if (s.enum) {
		return `enum(${JSON.stringify(s.enum)})`;
	}
	if (s.type) {
		return formatType(s.type);
	}
	return "object";
}

// ─── 1. Property Detectors ──────────────────────────────────────────────────

/**
 * Détecte les propriétés requises par le target que le source ne fournit pas.
 *
 * Condition : la propriété est dans `sup.required` mais n'existe pas
 * dans `sub.properties`.
 *
 * Regroupe les diffs structurels `properties.X added` + `required changed`
 * en un seul diagnostic.
 */
export function detectMissingRequiredProperties(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	const subProps = sub.properties || {};
	const supProps = sup.properties || {};
	const supRequired = new Set(sup.required || []);

	// Chercher les propriétés ajoutées par le merge qui sont requises par le target
	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;

		const match = diff.path.match(/^properties\.([^.]+)$/);
		if (!match) continue;

		const propName = match[1];
		if (propName === undefined) continue;

		// Propriété ajoutée par le merge ET requise par le target ET absente du source
		if (
			diff.type === "added" &&
			supRequired.has(propName) &&
			!(propName in subProps)
		) {
			const targetSchema = supProps[propName];
			result.push({
				type: "missing-required-property",
				path: `properties.${propName}`,
				message: `Target requires property '${propName}' (${extractTypeLabel(targetSchema)}) which source does not provide`,
				details: {
					property: propName,
					targetSchema: targetSchema ?? null,
				},
			});
			consumed.add(i);
		}
	}

	// Si on a trouvé des missing-required, consommer aussi le diff `required`
	if (result.length > 0) {
		for (let i = 0; i < diffs.length; i++) {
			if (consumed.has(i)) continue;
			const diff = diffs[i];
			if (diff === undefined) continue;
			if (diff.path === "required" && diff.type === "changed") {
				consumed.add(i);
				break;
			}
		}
	}

	return result;
}

/**
 * Détecte les propriétés optionnelles dans le source mais requises par le target.
 *
 * Condition : la propriété existe dans `sub.properties` (mais pas dans
 * `sub.required`), et elle est dans `sup.required`.
 *
 * Ne se déclenche que si la propriété n'a pas déjà été détectée comme
 * `missing-required-property`.
 */
export function detectPropertiesNotGuaranteed(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	const subRequired = new Set(sub.required || []);
	const supRequired = new Set(sup.required || []);
	const subProps = sub.properties || {};

	// Compare les schemas directement plutôt que de chercher le diff `required`.
	// Le diff `required` peut déjà avoir été consommé par `detectMissingRequiredProperties`,
	// mais l'incompatibilité d'optionalité reste valide et doit être détectée.

	// Pour chaque propriété requise par le target mais pas par le source
	for (const propName of supRequired) {
		if (subRequired.has(propName)) continue;

		// La propriété existe dans le source mais est optionnelle
		if (propName in subProps) {
			result.push({
				type: "property-not-guaranteed",
				path: `properties.${propName}`,
				message: `Property '${propName}' is optional in source but required by target`,
				details: {
					property: propName,
				},
			});
		}
	}

	// Consommer le diff `required` s'il est encore disponible
	if (result.length > 0) {
		for (let i = 0; i < diffs.length; i++) {
			if (consumed.has(i)) continue;
			const diff = diffs[i];
			if (diff === undefined) continue;
			if (diff.path === "required" && diff.type === "changed") {
				consumed.add(i);
				break;
			}
		}
	}

	return result;
}

/**
 * Détecte les propriétés fournies par le source que le target interdit.
 *
 * Condition : la propriété existe dans `sub.properties` mais pas dans
 * `sup.properties`, et `sup.additionalProperties === false`.
 */
export function detectPropertiesNotAllowed(
	_sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	if (sup.additionalProperties !== false) return result;

	const supProps = sup.properties || {};

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;

		const match = diff.path.match(/^properties\.([^.]+)$/);
		if (!match) continue;

		const propName = match[1];
		if (propName === undefined) continue;

		// Propriété retirée par le merge (source l'a, target l'interdit)
		if (diff.type === "removed" && !(propName in supProps)) {
			result.push({
				type: "property-not-allowed",
				path: `properties.${propName}`,
				message: `Source provides property '${propName}' which target does not allow`,
				details: {
					property: propName,
				},
			});
			consumed.add(i);
		}
	}

	return result;
}

// ─── 2. Type Detectors ──────────────────────────────────────────────────────

/**
 * Détecte les incompatibilités de type sur les propriétés ou à la racine.
 *
 * Distingue deux cas :
 *   - `type-mismatch`  : types complètement différents (string vs number)
 *   - `type-too-wide`  : source est un superset du target (string|number vs string)
 */
export function detectTypeDiffs(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;
		if (diff.type !== "changed" && diff.type !== "added") continue;

		// Match root "type" or "properties.X.type"
		const rootTypeMatch = diff.path === "type";
		const propTypeMatch = diff.path.match(/^properties\.([^.]+)\.type$/);

		if (!rootTypeMatch && !propTypeMatch) continue;

		const propName = propTypeMatch ? (propTypeMatch[1] ?? null) : null;
		const basePath = propName ? `properties.${propName}` : "";

		// Récupérer les types source et target depuis les schemas originaux
		const sourceType = propName ? getPropertyType(sub, propName) : sub.type;
		const targetType = propName ? getPropertyType(sup, propName) : sup.type;

		const sourceTypes = normalizeTypeToArray(sourceType);
		const targetTypes = normalizeTypeToArray(targetType);

		// Vérifier si c'est un type-too-wide (source ⊃ target) ou un mismatch total
		const overlap = sourceTypes.filter((t) => targetTypes.includes(t));

		if (overlap.length === 0) {
			// Aucun type en commun → mismatch total
			result.push({
				type: "type-mismatch",
				path: basePath || "type",
				message: propName
					? `Property '${propName}': source produces '${formatType(sourceType)}' but target expects '${formatType(targetType)}'`
					: `Source produces '${formatType(sourceType)}' but target expects '${formatType(targetType)}'`,
				details: {
					...(propName ? { property: propName } : {}),
					sourceType,
					targetType,
				},
			});
		} else if (overlap.length < sourceTypes.length) {
			// Overlap partiel → source trop large
			const extraTypes = sourceTypes.filter((t) => !targetTypes.includes(t));
			result.push({
				type: "type-too-wide",
				path: basePath || "type",
				message: propName
					? `Property '${propName}': source can produce '${formatType(sourceType)}' but target only accepts '${formatType(targetType)}'`
					: `Source can produce '${formatType(sourceType)}' but target only accepts '${formatType(targetType)}'`,
				details: {
					...(propName ? { property: propName } : {}),
					sourceType,
					targetType,
					extraTypes,
				},
			});
		} else {
			// Même types mais le diff existe (cas edge, ne devrait pas arriver souvent)
			result.push({
				type: "type-mismatch",
				path: basePath || "type",
				message: propName
					? `Property '${propName}': type changed from '${formatType(diff.sourceValue)}' to '${formatType(diff.mergedValue)}'`
					: `Type changed from '${formatType(diff.sourceValue)}' to '${formatType(diff.mergedValue)}'`,
				details: {
					...(propName ? { property: propName } : {}),
					sourceType: diff.sourceValue,
					targetType: diff.mergedValue,
				},
			});
		}

		consumed.add(i);
	}

	return result;
}

/** Extrait le type d'une propriété d'un schema */
function getPropertyType(
	schema: JSONSchema7,
	propName: string,
): JSONSchema7["type"] | undefined {
	const prop = schema.properties?.[propName];
	if (typeof prop === "object" && prop !== null && !Array.isArray(prop)) {
		return prop.type;
	}
	return undefined;
}

/** Normalise un type en tableau (pour faciliter les comparaisons) */
function normalizeTypeToArray(type: JSONSchema7["type"] | undefined): string[] {
	if (type === undefined) return [];
	if (Array.isArray(type)) return type;
	return [type];
}

// ─── 3. Value Detectors ─────────────────────────────────────────────────────

/**
 * Détecte les incompatibilités d'enum : source autorise des valeurs
 * que target n'accepte pas.
 */
export function detectEnumDiffs(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;
		if (diff.type !== "changed" && diff.type !== "added") continue;

		const rootEnumMatch = diff.path === "enum";
		const propEnumMatch = diff.path.match(/^properties\.([^.]+)\.enum$/);

		if (!rootEnumMatch && !propEnumMatch) continue;

		const propName = propEnumMatch ? (propEnumMatch[1] ?? null) : null;
		const basePath = propName ? `properties.${propName}` : "";

		const sourceValues = propName
			? getPropertyKeyword(sub, propName, "enum")
			: sub.enum;
		const targetValues = propName
			? getPropertyKeyword(sup, propName, "enum")
			: sup.enum;

		const sourceArr = Array.isArray(sourceValues) ? sourceValues : [];
		const targetArr = Array.isArray(targetValues) ? targetValues : [];
		const targetSet = new Set(targetArr.map((v) => JSON.stringify(v)));
		const extraValues = sourceArr.filter(
			(v) => !targetSet.has(JSON.stringify(v)),
		);

		result.push({
			type: "enum-not-subset",
			path: basePath || "enum",
			message: propName
				? `Property '${propName}': source allows ${JSON.stringify(extraValues)} which target does not accept`
				: `Source allows ${JSON.stringify(extraValues)} which target does not accept`,
			details: {
				...(propName ? { property: propName } : {}),
				sourceValues,
				targetValues,
				extraValues,
			},
		});
		consumed.add(i);
	}

	return result;
}

/**
 * Détecte les incompatibilités de const : valeurs const différentes.
 */
export function detectConstDiffs(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;
		if (diff.type !== "changed" && diff.type !== "added") continue;

		const rootConstMatch = diff.path === "const";
		const propConstMatch = diff.path.match(/^properties\.([^.]+)\.const$/);

		if (!rootConstMatch && !propConstMatch) continue;

		const propName = propConstMatch ? (propConstMatch[1] ?? null) : null;
		const basePath = propName ? `properties.${propName}` : "";

		const sourceConst = propName
			? getPropertyKeyword(sub, propName, "const")
			: sub.const;
		const targetConst = propName
			? getPropertyKeyword(sup, propName, "const")
			: sup.const;

		result.push({
			type: "const-mismatch",
			path: basePath || "const",
			message: propName
				? `Property '${propName}': source produces ${JSON.stringify(sourceConst)} but target expects ${JSON.stringify(targetConst)}`
				: `Source produces ${JSON.stringify(sourceConst)} but target expects ${JSON.stringify(targetConst)}`,
			details: {
				...(propName ? { property: propName } : {}),
				sourceConst,
				targetConst,
			},
		});
		consumed.add(i);
	}

	return result;
}

// ─── 4. Constraint Detectors ────────────────────────────────────────────────

/**
 * Mots-clés de contraintes numériques / string / array / object.
 * Chaque entrée indique le keyword et une description lisible.
 */
const CONSTRAINT_KEYWORDS: ReadonlyMap<string, string> = new Map([
	["minimum", "minimum value"],
	["maximum", "maximum value"],
	["exclusiveMinimum", "exclusive minimum"],
	["exclusiveMaximum", "exclusive maximum"],
	["multipleOf", "multipleOf"],
	["minLength", "minimum length"],
	["maxLength", "maximum length"],
	["minItems", "minimum items"],
	["maxItems", "maximum items"],
	["minProperties", "minimum properties"],
	["maxProperties", "maximum properties"],
	["uniqueItems", "uniqueItems"],
]);

/**
 * Détecte les contraintes du target plus strictes que celles du source.
 *
 * Couvre : minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf,
 * minLength, maxLength, minItems, maxItems, minProperties, maxProperties.
 */
export function detectConstraintDiffs(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;
		if (diff.type !== "changed" && diff.type !== "added") continue;

		// Match root constraint or properties.X.constraint
		let keyword: string | null = null;
		let propName: string | null = null;

		// Root level: "minLength", "maximum", etc.
		if (CONSTRAINT_KEYWORDS.has(diff.path)) {
			keyword = diff.path;
		}

		// Property level: "properties.X.minLength", etc.
		if (!keyword) {
			const propMatch = diff.path.match(/^properties\.([^.]+)\.(.+)$/);
			if (propMatch?.[2] && CONSTRAINT_KEYWORDS.has(propMatch[2])) {
				propName = propMatch[1] ?? null;
				keyword = propMatch[2];
			}
		}

		if (!keyword) continue;

		const label = CONSTRAINT_KEYWORDS.get(keyword) ?? keyword;
		const basePath = propName ? `properties.${propName}` : "";

		const sourceValue = propName
			? getPropertyKeyword(sub, propName, keyword)
			: (sub as Record<string, unknown>)[keyword];
		const targetValue = propName
			? getPropertyKeyword(sup, propName, keyword)
			: (sup as Record<string, unknown>)[keyword];

		const sourceLabel =
			sourceValue !== undefined ? String(sourceValue) : "none";
		const targetLabel =
			targetValue !== undefined ? String(targetValue) : "none";

		result.push({
			type: "constraint-too-loose",
			path: basePath || keyword,
			message: propName
				? `Property '${propName}': source allows ${label}=${sourceLabel} but target requires ${label}=${targetLabel}`
				: `Source allows ${label}=${sourceLabel} but target requires ${label}=${targetLabel}`,
			details: {
				...(propName ? { property: propName } : {}),
				constraint: keyword,
				sourceValue: sourceValue ?? null,
				targetValue: targetValue ?? null,
			},
		});
		consumed.add(i);
	}

	return result;
}

// ─── 5. Structure Detectors ─────────────────────────────────────────────────

/**
 * Détecte les conflits d'additionalProperties :
 * source autorise des propriétés supplémentaires, target les interdit.
 */
export function detectAdditionalPropertiesConflict(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;

		if (diff.path !== "additionalProperties") continue;

		const sourceAllows = sub.additionalProperties !== false;
		const targetAllows = sup.additionalProperties !== false;

		result.push({
			type: "additional-properties-conflict",
			path: "additionalProperties",
			message:
				sourceAllows && !targetAllows
					? "Source allows additional properties but target forbids them"
					: `additionalProperties changed from ${JSON.stringify(diff.sourceValue)} to ${JSON.stringify(diff.mergedValue)}`,
			details: {
				sourceAllows,
				targetAllows,
			},
		});
		consumed.add(i);
	}

	return result;
}

/**
 * Détecte les incompatibilités de schema d'items (arrays).
 */
export function detectItemsDiffs(
	_sub: JSONSchema7,
	_sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;

		// Match "items" or "items.something"
		if (!diff.path.startsWith("items")) continue;

		// Construire un message selon le sous-path
		const subPath = diff.path === "items" ? "" : diff.path.slice(6); // remove "items."
		const detail = subPath ? ` (${subPath})` : "";

		result.push({
			type: "incompatible-items",
			path: diff.path,
			message: `Array items${detail}: ${describeChange(diff)}`,
			details: {
				reason: describeChange(diff),
				subPath: subPath || null,
			},
		});
		consumed.add(i);
	}

	return result;
}

// ─── 6. Format Detectors ────────────────────────────────────────────────────

/**
 * Détecte les incompatibilités de format (email, uri, date-time, etc.).
 */
export function detectFormatDiffs(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;
		if (diff.type !== "changed" && diff.type !== "added") continue;

		const rootFormatMatch = diff.path === "format";
		const propFormatMatch = diff.path.match(/^properties\.([^.]+)\.format$/);

		if (!rootFormatMatch && !propFormatMatch) continue;

		const propName = propFormatMatch ? (propFormatMatch[1] ?? null) : null;
		const basePath = propName ? `properties.${propName}` : "";

		const sourceFormat = propName
			? getPropertyKeyword(sub, propName, "format")
			: sub.format;
		const targetFormat = propName
			? getPropertyKeyword(sup, propName, "format")
			: sup.format;

		const sourceLabel = sourceFormat ?? "none";
		const targetLabel = targetFormat ?? "none";

		result.push({
			type: "format-mismatch",
			path: basePath || "format",
			message: propName
				? `Property '${propName}': source format is '${sourceLabel}' but target requires '${targetLabel}'`
				: `Source format is '${sourceLabel}' but target requires '${targetLabel}'`,
			details: {
				...(propName ? { property: propName } : {}),
				sourceFormat: sourceFormat ?? null,
				targetFormat: targetFormat ?? null,
			},
		});
		consumed.add(i);
	}

	return result;
}

/**
 * Détecte les incompatibilités de pattern regex.
 */
export function detectPatternDiffs(
	sub: JSONSchema7,
	sup: JSONSchema7,
	diffs: SchemaDiff[],
	consumed: Set<number>,
): SemanticDiff[] {
	const result: SemanticDiff[] = [];

	for (let i = 0; i < diffs.length; i++) {
		if (consumed.has(i)) continue;
		const diff = diffs[i];
		if (diff === undefined) continue;
		if (diff.type !== "changed" && diff.type !== "added") continue;

		const rootPatternMatch = diff.path === "pattern";
		const propPatternMatch = diff.path.match(/^properties\.([^.]+)\.pattern$/);

		if (!rootPatternMatch && !propPatternMatch) continue;

		const propName = propPatternMatch ? (propPatternMatch[1] ?? null) : null;
		const basePath = propName ? `properties.${propName}` : "";

		const sourcePattern = propName
			? getPropertyKeyword(sub, propName, "pattern")
			: sub.pattern;
		const targetPattern = propName
			? getPropertyKeyword(sup, propName, "pattern")
			: sup.pattern;

		const sourceLabel = sourcePattern ?? "none";
		const targetLabel = targetPattern ?? "none";

		result.push({
			type: "pattern-not-subset",
			path: basePath || "pattern",
			message: propName
				? `Property '${propName}': source pattern '${sourceLabel}' is not a subset of target pattern '${targetLabel}'`
				: `Source pattern '${sourceLabel}' is not a subset of target pattern '${targetLabel}'`,
			details: {
				...(propName ? { property: propName } : {}),
				sourcePattern: sourcePattern ?? null,
				targetPattern: targetPattern ?? null,
			},
		});
		consumed.add(i);
	}

	return result;
}

// ─── 7. Fallback ─────────────────────────────────────────────────────────────

/**
 * Convertit les diffs structurels non consommés en `schema-incompatible`.
 *
 * C'est le catch-all pour les cas non couverts par les détecteurs spécifiques.
 */
export function createFallbackDiff(diff: SchemaDiff): SemanticDiff {
	return {
		type: "schema-incompatible",
		path: diff.path,
		message: describeChange(diff),
		details: {
			reason: describeChange(diff),
			structuralType: diff.type,
			sourceValue: diff.sourceValue,
			mergedValue: diff.mergedValue,
		},
	};
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

/**
 * Extrait la valeur d'un mot-clé d'un sous-schema de propriété.
 *
 * @param schema   Le schema parent
 * @param propName Le nom de la propriété
 * @param keyword  Le mot-clé à extraire (type, enum, format, etc.)
 */
function getPropertyKeyword(
	schema: JSONSchema7,
	propName: string,
	keyword: string,
): unknown {
	const prop = schema.properties?.[propName];
	if (typeof prop === "object" && prop !== null && !Array.isArray(prop)) {
		return (prop as Record<string, unknown>)[keyword];
	}
	return undefined;
}

/**
 * Décrit un changement structurel en phrase lisible.
 * Utilisé pour les messages des détecteurs et du fallback.
 */
function describeChange(diff: SchemaDiff): string {
	switch (diff.type) {
		case "added":
			return `'${diff.path}' added with value ${JSON.stringify(diff.mergedValue)}`;
		case "removed":
			return `'${diff.path}' was removed (was ${JSON.stringify(diff.sourceValue)})`;
		default:
			return `'${diff.path}' changed from ${JSON.stringify(diff.sourceValue)} to ${JSON.stringify(diff.mergedValue)}`;
	}
}
