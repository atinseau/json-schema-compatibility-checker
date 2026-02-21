import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { computeDiffs } from "./differ";
import { isFormatSubset } from "./format-validator";
import type { MergeEngine } from "./merge-engine";
import { normalize } from "./normalizer";
import { isPatternSubset } from "./pattern-subset";
import type { SchemaDiff, SubsetResult } from "./types";
import { deepEqual, hasOwn, isPlainObj, omitKeys } from "./utils";

// ─── Subset Checker ──────────────────────────────────────────────────────────
//
// Logique de vérification sub ⊆ sup via l'approche :
//   A ⊆ B  ⟺  A ∩ B ≡ A
//
// Gère les cas :
//   - Schemas atomiques (pas de anyOf/oneOf)
//   - anyOf/oneOf dans sub → chaque branche doit être acceptée par sup
//   - anyOf/oneOf dans sup → au moins une branche doit accepter sub
//   - Point 6 : Distinction anyOf / oneOf dans les messages de diff
//   - Point 7 : Raisonnement étendu sur `not` (evaluateNot)
//     - not.type, not.const, not.enum (existants)
//     - not avec properties+required (1.1)
//     - not avec anyOf/oneOf (1.2)
//     - not dans sub (1.3)
//     - not.format (format-vs-format)
//
// Utilise des helpers natifs partagés depuis `./utils` pour des performances
// optimales (deepEqual, hasOwn, isPlainObj, omitKeys).

// ─── Branch type ─────────────────────────────────────────────────────────────

/**
 * Type de branchement détecté dans un schema.
 *
 * Point 6 — Distingue `anyOf` de `oneOf` pour produire des messages
 * de diff plus précis. `"none"` indique un schema atomique (pas de branches).
 *
 * Note : la sémantique d'exclusivité de `oneOf` n'est pas vérifiée
 * (ce serait un problème NP-hard en général). Le checker traite `oneOf`
 * comme `anyOf` pour le subset checking, ce qui est correct pour le cas
 * `sub ⊆ sup` mais peut produire des faux-positifs si les branches
 * du sub se chevauchent.
 */
export type BranchType = "anyOf" | "oneOf" | "none";

export interface BranchResult {
	/** Les branches extraites du schema */
	branches: JSONSchema7Definition[];
	/** Le type de branchement détecté */
	type: BranchType;
}

// ─── Branch extraction ───────────────────────────────────────────────────────

// Pre-allocated singleton results for boolean schemas to avoid per-call allocations.
// These are safe because the branches arrays are never mutated after creation.
const BRANCH_TRUE: BranchResult = { branches: [true], type: "none" };
const BRANCH_FALSE: BranchResult = { branches: [false], type: "none" };

/**
 * WeakMap cache for atomic (no anyOf/oneOf) schema branch results.
 * Avoids allocating `{ branches: [def], type: "none" }` on every call
 * for the same schema object. Since normalized schemas are cached and
 * return the same reference, this cache hits frequently.
 */
const atomicBranchCache = new WeakMap<object, BranchResult>();

/**
 * Extrait les branches d'un schema et le type de branchement.
 *
 * Retourne les éléments de `anyOf`/`oneOf` s'ils existent, sinon retourne
 * le schema lui-même dans un tableau avec type `"none"`.
 *
 * Point 6 — Distingue `anyOf` de `oneOf` dans les paths de diff.
 *
 * Optimisation : réutilise des objets pré-alloués pour les cas boolean
 * (true/false) et un WeakMap cache pour les schemas atomiques afin
 * d'éviter les allocations sur ces chemins fréquents.
 */
export function getBranchesTyped(def: JSONSchema7Definition): BranchResult {
	if (typeof def === "boolean") {
		return def ? BRANCH_TRUE : BRANCH_FALSE;
	}
	if (hasOwn(def, "anyOf") && Array.isArray(def.anyOf)) {
		return { branches: def.anyOf, type: "anyOf" };
	}
	if (hasOwn(def, "oneOf") && Array.isArray(def.oneOf)) {
		return { branches: def.oneOf, type: "oneOf" };
	}
	// Cache atomic results per schema object to avoid repeated allocations.
	let cached = atomicBranchCache.get(def);
	if (cached === undefined) {
		cached = { branches: [def], type: "none" };
		atomicBranchCache.set(def, cached);
	}
	return cached;
}

// ─── `not` reasoning (Point 7 — étendu) ─────────────────────────────────────

/**
 * Raisonnement étendu sur `not` pour les cas courants.
 *
 * Point 7 — Vérifie la compatibilité quand `sup` et/ou `sub` contiennent `not` :
 *
 * **Cas existants (not dans sup) :**
 *   - `not.type` : type exclu vs type de sub
 *   - `not.const` : const exclu vs const de sub
 *   - `not.enum` : valeurs exclues vs enum de sub
 *
 * **Cas ajoutés :**
 *   - 1.1 — `not` avec `properties` + `required` : vérifier que les propriétés
 *     de sub sont incompatibles avec celles du `not` (const/enum différents)
 *   - 1.2 — `not` avec `anyOf`/`oneOf` : `not(anyOf([A,B]))` ≡ `allOf([not(A), not(B)])`,
 *     donc sub doit être incompatible avec CHAQUE branche
 *   - 1.3 — `not` dans `sub` (pas seulement dans `sup`) : un sub avec `not`
 *     accepte un ensemble trop large pour être un sous-ensemble d'un sup concret
 *   - `not.format` : format-vs-format via `isFormatSubset`
 *
 * Contrat ternaire conservateur :
 *   - `true`  → compatible (certain)
 *   - `false` → incompatible (certain)
 *   - `null`  → indéterminé (laisser le merge engine décider)
 *
 * En cas de doute → `null`. Ne JAMAIS retourner `true` sans certitude.
 *
 * Utilise `_.has`, `_.get`, `_.isEqual`, `_.includes`, `_.every`, `_.some`,
 * `_.keys`, `_.isPlainObject`, `_.isArray` pour des vérifications concises.
 */
function evaluateNot(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
): boolean | null {
	if (typeof sub === "boolean" || typeof sup === "boolean") return null;

	// ── 1.3 — `not` dans sub (pas dans sup) ──
	// Un `not` dans sub est une restriction supplémentaire : il exclut des
	// valeurs de l'ensemble accepté par sub, ce qui le rend potentiellement
	// plus petit — donc plus susceptible d'être ⊆ sup, pas moins.
	// On laisse le merge engine décider : allOf(sub, sup) préservera le `not`
	// de sub, et la comparaison merged ≡ sub donnera le bon résultat.
	// Exception : si les deux ont `not`, on traite l'identité plus bas.

	// Vérifier `not` dans sup
	if (hasOwn(sup, "not") && isPlainObj(sup.not)) {
		const notSchema = sup.not as JSONSchema7;

		// ── 1.1 — Cas not avec properties + required ──
		// IMPORTANT : ce check est placé AVANT le check not.type car quand
		// le not a à la fois `type` et `properties`, le check not.type seul
		// produirait un faux négatif (ex: sub type=object et not type=object
		// retournerait false, mais les properties pourraient être incompatibles
		// ce qui rendrait sub compatible avec le not).
		// Si not contient des properties avec const/enum et required,
		// vérifier que les propriétés de sub sont incompatibles avec celles du not.
		if (isPlainObj(notSchema.properties) && Array.isArray(notSchema.required)) {
			const notProps = notSchema.properties as Record<
				string,
				JSONSchema7Definition
			>;
			const notRequired = notSchema.required as string[];

			// sub doit avoir des properties pour qu'on puisse comparer
			if (isPlainObj(sub.properties)) {
				const subProps = sub.properties as Record<
					string,
					JSONSchema7Definition
				>;
				const subRequired = Array.isArray(sub.required)
					? (sub.required as string[])
					: [];
				const notPropKeys = Object.keys(notProps);

				// Pour que sub soit compatible avec not(schema),
				// il suffit qu'au moins UNE propriété du not soit incompatible avec sub.
				// Cela signifie que sub ne peut jamais valider le schema inside not.
				const hasIncompatibleProp = notPropKeys.some((key) => {
					const notPropDef = notProps[key];
					if (typeof notPropDef === "boolean") return false;
					const notProp = notPropDef as JSONSchema7;

					// Si la propriété est required dans not mais PAS dans sub.required
					// et qu'elle n'existe pas dans sub.properties → sub peut ne pas
					// avoir cette propriété → le not schema ne matcherait pas → compatible
					if (
						notRequired.includes(key) &&
						!subRequired.includes(key) &&
						!hasOwn(subProps, key)
					) {
						return true; // Propriété absente de sub → not ne matche pas
					}

					// Comparer les const/enum de la propriété
					if (!hasOwn(subProps, key)) return false;
					const subPropDef = subProps[key];
					if (typeof subPropDef === "boolean") return false;
					const subProp = subPropDef as JSONSchema7;

					// not.prop a un const, sub.prop a un const différent → incompatible pour cette prop
					if (hasOwn(notProp, "const") && hasOwn(subProp, "const")) {
						if (!deepEqual(notProp.const, subProp.const)) {
							return true; // Consts différents → sub ne matche pas le not
						}
					}

					// not.prop a un enum, sub.prop a un const ou enum dont aucune valeur
					// n'est dans not.enum → incompatible pour cette prop
					if (hasOwn(notProp, "enum") && Array.isArray(notProp.enum)) {
						if (hasOwn(subProp, "const")) {
							const inNotEnum = notProp.enum.some((v) =>
								deepEqual(v, subProp.const),
							);
							if (!inNotEnum) return true; // sub.const absent du not.enum
						}
						if (hasOwn(subProp, "enum") && Array.isArray(subProp.enum)) {
							const noneInNotEnum = subProp.enum.every(
								(v) => !notProp.enum?.some((nv) => deepEqual(v, nv)),
							);
							if (noneInNotEnum) return true; // Aucune valeur de sub.enum dans not.enum
						}
					}

					return false;
				});

				if (hasIncompatibleProp) return true;

				// Vérification inverse : si TOUTES les propriétés du not matchent sub
				// exactement (même const, sub a les required du not), alors sub VIOLE le not
				const allPropsMatch = notPropKeys.every((key) => {
					const notPropDef = notProps[key];
					if (typeof notPropDef === "boolean") return true;
					const notProp = notPropDef as JSONSchema7;

					// La propriété doit être dans sub.required si elle est dans not.required
					if (notRequired.includes(key) && !subRequired.includes(key))
						return false;
					if (!hasOwn(subProps, key)) return false;
					const subPropDef = subProps[key];
					if (typeof subPropDef === "boolean") return true;
					const subProp = subPropDef as JSONSchema7;

					// Vérifier const match
					if (hasOwn(notProp, "const") && hasOwn(subProp, "const")) {
						return deepEqual(notProp.const, subProp.const);
					}

					// Vérifier enum inclusion
					if (hasOwn(notProp, "enum") && Array.isArray(notProp.enum)) {
						if (hasOwn(subProp, "const")) {
							return notProp.enum.some((v) => deepEqual(v, subProp.const));
						}
						if (hasOwn(subProp, "enum") && Array.isArray(subProp.enum)) {
							// Toutes les valeurs de sub.enum sont dans not.enum
							return subProp.enum.every((v) =>
								notProp.enum?.some((nv) => deepEqual(v, nv)),
							);
						}
					}

					return false; // Indéterminé pour cette propriété
				});

				if (allPropsMatch) return false; // sub matche exactement le not → incompatible
			}
		}

		// ── Cas not.const ──
		// IMPORTANT : ce check est placé AVANT not.type car quand le not a
		// à la fois `type` et `const`, le check not.type seul produirait un
		// faux négatif (ex: sub type=string const="active" et not type=string
		// const="deleted" → le type check retournerait false car même type,
		// alors que les consts sont différents → compatible).
		if (hasOwn(notSchema, "const") && hasOwn(sub, "const")) {
			const notConst = notSchema.const;
			const subConst = sub.const;
			if (deepEqual(subConst, notConst)) return false;
			return true;
		}

		// ── Cas not.enum ──
		// Aussi placé AVANT not.type pour la même raison.
		if (
			hasOwn(notSchema, "enum") &&
			Array.isArray(notSchema.enum) &&
			hasOwn(sub, "enum") &&
			Array.isArray(sub.enum)
		) {
			// Toutes les valeurs de sub.enum doivent être absentes de not.enum
			const allExcluded = sub.enum.every(
				(val) => !notSchema.enum?.some((notVal) => deepEqual(val, notVal)),
			);
			if (allExcluded) return true;
			// Certaines valeurs de sub sont dans not.enum → pas automatiquement faux,
			// le merge engine peut encore gérer
		}

		// ── Cas not.type ──
		// Placé APRÈS not.const, not.enum et properties+required pour ne pas
		// court-circuiter les cas où le not a des contraintes plus spécifiques.
		// Le check type seul est un fallback pour les not schemas simples
		// (ex: { not: { type: "string" } }).
		if (hasOwn(notSchema, "type") && hasOwn(sub, "type")) {
			const notType = notSchema.type;
			const subType = sub.type;

			// Si les deux sont des strings simples
			if (typeof notType === "string" && typeof subType === "string") {
				// Ne retourner que si le not n'a PAS de contraintes plus spécifiques
				// (const, enum, properties) qui auraient dû être traitées plus haut
				if (
					!hasOwn(notSchema, "const") &&
					!hasOwn(notSchema, "enum") &&
					!isPlainObj(notSchema.properties)
				) {
					if (subType === notType) return false; // Incompatible : sub est exactement le type exclu
					return true; // Compatible : sub est un type différent du type exclu
				}
			}

			// Si notType est un tableau, sub.type doit ne pas être dedans
			if (Array.isArray(notType) && typeof subType === "string") {
				if (notType.includes(subType)) return false;
				return true;
			}
		}

		// ── 1.2 — Cas not avec anyOf / oneOf ──
		// not(anyOf([A, B])) ≡ allOf([not(A), not(B)])
		// Pour que sub ⊆ not(anyOf(...)), sub doit être incompatible avec CHAQUE branche.
		if (hasOwn(notSchema, "anyOf") && Array.isArray(notSchema.anyOf)) {
			const branches = notSchema.anyOf as JSONSchema7Definition[];
			// Pour chaque branche du not.anyOf, vérifier que sub est incompatible
			const allIncompatible = branches.every((branch) => {
				if (typeof branch === "boolean") return !branch; // not(true) = rien, not(false) = tout
				// Créer un sup virtuel { not: branch } et vérifier récursivement
				const result = evaluateNot(sub, { not: branch });
				// result = true → sub est compatible avec not(branch) → sub ⊄ branch → OK
				// result = false → sub est incompatible avec not(branch) → sub ⊆ branch → pas OK
				// result = null → indéterminé
				return result === true;
			});
			if (allIncompatible) return true;

			// Vérifier si au moins une branche accepte sub → incompatible avec not(anyOf)
			const anyBranchMatches = branches.some((branch) => {
				if (typeof branch === "boolean") return branch;
				const result = evaluateNot(sub, { not: branch });
				return result === false; // sub est incompatible avec not(branch) → sub ⊆ branch
			});
			if (anyBranchMatches) return false;
		}

		// Même logique pour oneOf (dans le contexte du not, traité comme anyOf)
		if (hasOwn(notSchema, "oneOf") && Array.isArray(notSchema.oneOf)) {
			const branches = notSchema.oneOf as JSONSchema7Definition[];
			const allIncompatible = branches.every((branch) => {
				if (typeof branch === "boolean") return !branch;
				const result = evaluateNot(sub, { not: branch });
				return result === true;
			});
			if (allIncompatible) return true;

			const anyBranchMatches = branches.some((branch) => {
				if (typeof branch === "boolean") return branch;
				const result = evaluateNot(sub, { not: branch });
				return result === false;
			});
			if (anyBranchMatches) return false;
		}

		// ── Cas not.format (format-vs-format uniquement) ──
		// Si not a un format et sub aussi, vérifier la compatibilité
		if (hasOwn(notSchema, "format") && hasOwn(sub, "format")) {
			const subFormat = sub.format as string;
			const notFormat = notSchema.format as string;
			if (subFormat === notFormat) return false; // Incompatible : sub a exactement le format exclu
			// Formats différents → compatible (approximation conservatrice)
			return true;
		}
	}

	// Vérifier `not` dans sub ET dans sup (identité : { not: X } ⊆ { not: X })
	if (hasOwn(sub, "not") && hasOwn(sup, "not")) {
		if (deepEqual(sub.not, sup.not)) return true;
	}

	return null; // Pas d'avis → laisser le merge engine décider
}

// ─── Not stripping helper ────────────────────────────────────────────────────

/**
 * Retire le mot-clé `not` d'un schema pour permettre un merge propre
 * quand `evaluateNot` a déjà confirmé la compatibilité.
 *
 * Gère aussi le `not` imbriqué dans les `properties` : si une propriété
 * de `sup` a un `not` qui est compatible avec la propriété correspondante
 * de `sub`, on le retire également.
 *
 * Retourne le schema nettoyé, ou `null` si le schema est vide après retrait.
 *
 * Utilise `_.omit`, `_.has`, `_.keys`, `_.isEmpty`, `_.isPlainObject`.
 */
function stripNotFromSup(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	stripTopLevel: boolean = true,
): JSONSchema7Definition {
	if (typeof sup === "boolean" || typeof sub === "boolean") return sup;

	let result = sup as JSONSchema7;

	// ── Retirer le `not` de niveau supérieur (seulement si confirmé) ──
	if (stripTopLevel && hasOwn(result, "not")) {
		result = omitKeys(result as unknown as Record<string, unknown>, [
			"not",
		]) as JSONSchema7;
	}

	// ── Retirer les `not` dans les propriétés communes ──
	// Si sup.properties[key] a un `not` et que evaluateNot(sub.prop, sup.prop)
	// confirme la compatibilité, on retire le `not` de cette propriété aussi.
	if (
		isPlainObj(result.properties) &&
		isPlainObj((sub as JSONSchema7).properties)
	) {
		const subProps = (sub as JSONSchema7).properties as Record<
			string,
			JSONSchema7Definition
		>;
		const supProps = result.properties as Record<string, JSONSchema7Definition>;
		let newProps: Record<string, JSONSchema7Definition> | undefined;

		for (const key of Object.keys(supProps)) {
			const supPropDef = supProps[key];
			const subPropDef = subProps[key];
			if (
				supPropDef !== undefined &&
				subPropDef !== undefined &&
				typeof supPropDef !== "boolean" &&
				typeof subPropDef !== "boolean" &&
				hasOwn(supPropDef, "not")
			) {
				// Vérifier la compatibilité du not au niveau de la propriété
				const propNotResult = evaluateNot(subPropDef, supPropDef);
				if (propNotResult === true) {
					// Lazy allocate newProps only on first modification
					if (!newProps) newProps = { ...supProps };
					newProps[key] = omitKeys(
						supPropDef as unknown as Record<string, unknown>,
						["not"],
					) as JSONSchema7Definition;
				}
			}
		}

		if (newProps) {
			result = { ...result, properties: newProps };
		}
	}

	return result;
}

// ─── Pattern stripping helper ────────────────────────────────────────────────

/**
 * Retire le `pattern` de `sup` quand `isPatternSubset` a confirmé que
 * sub.pattern ⊆ sup.pattern par échantillonnage.
 *
 * Fonctionne comme `stripNotFromSup` : on retire la contrainte de sup
 * qui est déjà satisfaite par sub, pour éviter que le merge engine
 * produise un pattern combiné (lookahead conjunction) structurellement
 * différent du pattern de sub, ce qui causerait un faux négatif.
 *
 * Récurse dans les `properties` pour traiter les patterns imbriqués.
 *
 * @param sub  Le schema sub (utilisé pour extraire les patterns à comparer)
 * @param sup  Le schema sup dont on retire les patterns confirmés
 * @returns    Le schema sup nettoyé
 */
function stripPatternFromSup(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
): JSONSchema7Definition {
	if (typeof sub === "boolean" || typeof sup === "boolean") return sup;

	const supObj: JSONSchema7 = sup;

	// Lazy copy-on-write: only create a copy when the first mutation is needed.
	let result: JSONSchema7 = supObj;
	let copied = false;

	function ensureCopy(): JSONSchema7 {
		if (!copied) {
			result = { ...supObj };
			copied = true;
		}
		return result;
	}

	// ── Top-level pattern ──
	if (
		hasOwn(result, "pattern") &&
		hasOwn(sub, "pattern") &&
		result.pattern !== (sub as JSONSchema7).pattern
	) {
		const patResult = isPatternSubset(
			(sub as JSONSchema7).pattern as string,
			result.pattern as string,
		);
		if (patResult === true) {
			result = omitKeys(ensureCopy() as unknown as Record<string, unknown>, [
				"pattern",
			]) as JSONSchema7;
			copied = true;
		}
	}

	// ── Patterns dans les propriétés communes ──
	if (
		isPlainObj(result.properties) &&
		isPlainObj((sub as JSONSchema7).properties)
	) {
		const subProps = (sub as JSONSchema7).properties as Record<
			string,
			JSONSchema7Definition
		>;
		const supProps = result.properties as Record<string, JSONSchema7Definition>;
		let propsModified = false;
		let newProps: Record<string, JSONSchema7Definition> | undefined;

		for (const key of Object.keys(supProps)) {
			const supPropDef = supProps[key];
			const subPropDef = subProps[key];
			if (
				supPropDef !== undefined &&
				subPropDef !== undefined &&
				typeof supPropDef !== "boolean" &&
				typeof subPropDef !== "boolean" &&
				hasOwn(supPropDef, "pattern") &&
				hasOwn(subPropDef, "pattern") &&
				supPropDef.pattern !== subPropDef.pattern
			) {
				const propPatResult = isPatternSubset(
					(subPropDef as JSONSchema7).pattern as string,
					(supPropDef as JSONSchema7).pattern as string,
				);
				if (propPatResult === true) {
					if (!newProps) newProps = { ...supProps };
					newProps[key] = omitKeys(
						supPropDef as unknown as Record<string, unknown>,
						["pattern"],
					) as JSONSchema7Definition;
					propsModified = true;
				}
			}
		}

		if (propsModified && newProps) {
			ensureCopy().properties = newProps;
		}
	}

	// ── Pattern dans items (single schema) ──
	if (
		isPlainObj(result.items) &&
		typeof result.items !== "boolean" &&
		isPlainObj((sub as JSONSchema7).items) &&
		typeof (sub as JSONSchema7).items !== "boolean"
	) {
		const subItems = (sub as JSONSchema7).items as JSONSchema7;
		const supItems = result.items as JSONSchema7;
		if (
			hasOwn(supItems, "pattern") &&
			hasOwn(subItems, "pattern") &&
			supItems.pattern !== subItems.pattern
		) {
			const itemsPatResult = isPatternSubset(
				subItems.pattern as string,
				supItems.pattern as string,
			);
			if (itemsPatResult === true) {
				ensureCopy().items = omitKeys(
					supItems as unknown as Record<string, unknown>,
					["pattern"],
				) as JSONSchema7Definition;
			}
		}
	}

	return result;
}

// ─── Atomic subset check ─────────────────────────────────────────────────────

/**
 * Vérifie si `sub ⊆ sup` pour deux schemas sans anyOf/oneOf (ou avec
 * anyOf/oneOf uniquement côté sup).
 *
 * Point 7 — Intègre un pré-check `not` étendu (`evaluateNot`) avant le merge.
 *
 * Quand `evaluateNot` confirme la compatibilité (`true`), on retire le `not`
 * de `sup` avant le merge pour éviter que le merge engine ajoute une contrainte
 * `not` que `sub` n'a pas (ce qui ferait échouer `isEqual(merged, sub)`).
 *
 * Pattern pre-check — Quand les deux schemas ont des patterns différents,
 * vérifie l'inclusion par échantillonnage via `isPatternSubset`. Si confirmé,
 * retire le pattern de sup avant le merge (même stratégie que pour `not`).
 *
 * Principe : merge(sub, sup) ≡ sub → sub est un sous-ensemble de sup.
 *
 * Utilise `_.some`, `_.has`, `_.omit`, `_.keys`, `_.isEmpty` pour la logique.
 */
export function isAtomicSubsetOf(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): boolean {
	const { branches: supBranches } = getBranchesTyped(sup);

	// Schema simple → merge direct
	if (supBranches.length === 1 && supBranches[0] === sup) {
		// Point 7 : pré-check `not` étendu
		const notResult = evaluateNot(sub, sup);
		if (notResult === false) return false;

		// ── Format pre-check ──
		// Si les deux schemas ont un `format` différent, vérifier que
		// sub.format ⊆ sup.format. Sinon, sub ne peut pas être ⊆ sup.
		// Cela complète hasFormatConflict (qui gère le merge) en gérant
		// la direction du subset check que le merge ne peut pas résoudre.
		if (
			typeof sub !== "boolean" &&
			typeof sup !== "boolean" &&
			hasOwn(sub, "format") &&
			hasOwn(sup, "format") &&
			sub.format !== sup.format
		) {
			const fmtResult = isFormatSubset(
				sub.format as string,
				sup.format as string,
			);
			if (fmtResult !== true) return false;
		}

		// ── Pattern pre-check ──
		// Si les deux schemas ont des patterns différents, vérifier l'inclusion
		// par échantillonnage. Si sub.pattern ⊄ sup.pattern (contre-exemple trouvé),
		// on retourne false immédiatement. Sinon, on pourra retirer le pattern
		// de sup pour éviter le faux négatif structurel du merge.
		if (
			typeof sub !== "boolean" &&
			typeof sup !== "boolean" &&
			hasOwn(sub, "pattern") &&
			hasOwn(sup, "pattern") &&
			sub.pattern !== sup.pattern
		) {
			const patResult = isPatternSubset(
				sub.pattern as string,
				sup.pattern as string,
			);
			if (patResult === false) return false;
		}

		// Retirer `not` de sup (top-level et/ou dans les properties)
		// quand evaluateNot confirme la compatibilité au niveau correspondant.
		// Cela évite que le merge engine ajoute une contrainte `not` que sub n'a pas
		// (ce qui ferait merged ≠ sub et produirait un faux négatif).
		let effectiveSup = sup;
		if (typeof sup !== "boolean") {
			// Si top-level not est confirmé compatible → retirer le not top-level
			if (notResult === true) {
				effectiveSup = stripNotFromSup(sub, sup, true);
				// Si sup n'avait QUE `not` → sub est compatible (le not est résolu)
				if (
					typeof effectiveSup !== "boolean" &&
					Object.keys(effectiveSup).length === 0
				) {
					return true;
				}
			} else {
				// Même si le top-level not n'est pas confirmé (null), on tente
				// de retirer les `not` dans les properties individuelles
				// sans toucher au `not` top-level
				effectiveSup = stripNotFromSup(sub, sup, false);
			}

			// Retirer les patterns de sup confirmés par échantillonnage.
			// Même stratégie que pour `not` : on retire la contrainte déjà
			// satisfaite par sub pour éviter que le merge produise un pattern
			// combiné (lookahead conjunction) structurellement ≠ sub.
			effectiveSup = stripPatternFromSup(sub, effectiveSup);
		}

		const merged = engine.merge(sub, effectiveSup);
		if (merged === null) return false;
		// Fast path: if merged is already structurally equal to sub,
		// skip normalize entirely. This is the common case when sub ⊆ sup
		// (A ∩ B = A), saving O(n) normalize traversal on wide schemas.
		if (deepEqual(merged, sub)) return true;
		// Slow path: normalize to eliminate merge artifacts (e.g. redundant
		// enum when const is present), then compare.
		const normalizedMerged = normalize(merged);
		return (
			deepEqual(normalizedMerged, sub) || engine.isEqual(normalizedMerged, sub)
		);
	}

	// anyOf/oneOf dans sup → au moins une branche doit accepter sub
	return supBranches.some((branch) => {
		// Point 7 : pré-check `not` étendu par branche
		const notResult = evaluateNot(sub, branch);
		if (notResult === false) return false;

		// ── Pattern pre-check par branche ──
		if (
			typeof sub !== "boolean" &&
			typeof branch !== "boolean" &&
			hasOwn(sub, "pattern") &&
			hasOwn(branch, "pattern") &&
			sub.pattern !== branch.pattern
		) {
			const patResult = isPatternSubset(
				sub.pattern as string,
				branch.pattern as string,
			);
			if (patResult === false) return false;
		}

		// Même logique de strip pour les branches
		let effectiveBranch = branch;
		if (typeof branch !== "boolean") {
			if (notResult === true) {
				effectiveBranch = stripNotFromSup(sub, branch, true);
				if (
					typeof effectiveBranch !== "boolean" &&
					Object.keys(effectiveBranch).length === 0
				) {
					return true;
				}
			} else {
				effectiveBranch = stripNotFromSup(sub, branch, false);
			}

			// Strip patterns confirmés par échantillonnage
			effectiveBranch = stripPatternFromSup(sub, effectiveBranch);
		}

		const merged = engine.merge(sub, effectiveBranch);
		if (merged === null) return false;
		// Fast path: skip normalize if merged already equals sub
		if (deepEqual(merged, sub)) return true;
		const normalizedBranch = normalize(merged);
		return (
			deepEqual(normalizedBranch, sub) || engine.isEqual(normalizedBranch, sub)
		);
	});
}

// ─── Full subset check (with diffs) ─────────────────────────────────────────

/**
 * Vérifie `sub ⊆ sup` pour un sub qui a des branches (anyOf/oneOf).
 * Chaque branche de sub doit être acceptée par sup.
 *
 * Point 6 — Utilise `getBranchesTyped` pour distinguer `anyOf[i]` de
 * `oneOf[i]` dans les paths de diff.
 *
 * Utilise `_.every` / `_.flatMap` / `_.map` pour une itération idiomatique.
 */
export function checkBranchedSub(
	subBranches: JSONSchema7Definition[],
	sup: JSONSchema7Definition,
	engine: MergeEngine,
	branchType: BranchType = "anyOf",
): SubsetResult {
	const allDiffs: SchemaDiff[] = [];
	let allSubset = true;

	// Point 6 : utilise le type de branche réel pour le path
	const branchLabel = branchType === "none" ? "anyOf" : branchType;

	for (let i = 0; i < subBranches.length; i++) {
		const branch = subBranches[i];
		if (branch === undefined) continue;
		if (!isAtomicSubsetOf(branch, sup, engine)) {
			allSubset = false;
			allDiffs.push({
				path: `${branchLabel}[${i}]`,
				type: "changed",
				expected: branch,
				actual: "Branch not accepted by superset",
			});
		}
	}

	return {
		isSubset: allSubset,
		merged: allSubset
			? branchType === "oneOf"
				? { oneOf: subBranches }
				: { anyOf: subBranches }
			: null,
		diffs: allDiffs,
	};
}

/**
 * Vérifie `sub ⊆ sup` pour un sup qui a des branches (anyOf/oneOf).
 * Au moins une branche de sup doit accepter sub.
 *
 * Point 6 — Utilise le type de branche de sup pour des messages plus précis.
 *
 * Utilise `_.some` pour trouver la première branche compatible.
 */
export function checkBranchedSup(
	sub: JSONSchema7Definition,
	supBranches: JSONSchema7Definition[],
	engine: MergeEngine,
	branchType: BranchType = "anyOf",
): SubsetResult {
	for (const branch of supBranches) {
		// Strip patterns confirmés par échantillonnage avant le merge
		let effectiveBranch = branch;
		if (typeof sub !== "boolean" && typeof branch !== "boolean") {
			effectiveBranch = stripPatternFromSup(sub, branch);
		}
		const merged = engine.merge(sub, effectiveBranch);
		if (merged !== null) {
			// Fast path: skip normalize if merged already equals sub
			if (deepEqual(merged, sub)) {
				return { isSubset: true, merged, diffs: [] };
			}
			const normalizedMerged = normalize(merged);
			if (
				deepEqual(normalizedMerged, sub) ||
				engine.isEqual(normalizedMerged, sub)
			) {
				return { isSubset: true, merged, diffs: [] };
			}
		}
	}

	// Point 6 : message précis selon le type de branche
	const branchLabel = branchType === "none" ? "anyOf" : branchType;

	return {
		isSubset: false,
		merged: null,
		diffs: [
			{
				path: "$",
				type: "changed",
				expected: sub,
				actual: `No branch in superset's ${branchLabel} accepts this schema`,
			},
		],
	};
}

/**
 * Vérifie `sub ⊆ sup` pour deux schemas atomiques (sans anyOf/oneOf).
 * Utilise `mergeOrThrow` pour capturer les erreurs d'incompatibilité.
 *
 * Utilise `deepEqual` pour la comparaison structurelle (avec short-circuit
 * par référence et comptage de clés).
 */
export function checkAtomic(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): SubsetResult {
	// Strip patterns confirmés par échantillonnage avant le merge,
	// même stratégie que dans isAtomicSubsetOf pour éviter les faux négatifs
	// structurels causés par la conjonction de patterns en lookahead.
	let effectiveSup = sup;
	if (typeof sub !== "boolean" && typeof sup !== "boolean") {
		effectiveSup = stripPatternFromSup(sub, sup);
	}

	try {
		const merged = engine.mergeOrThrow(sub, effectiveSup);

		// Fast path: skip normalize if merged already equals sub
		if (deepEqual(merged, sub)) {
			return { isSubset: true, merged, diffs: [] };
		}

		const normalizedMerged = normalize(merged);

		if (
			deepEqual(normalizedMerged, sub) ||
			engine.isEqual(normalizedMerged, sub)
		) {
			return { isSubset: true, merged: normalizedMerged, diffs: [] };
		}

		const diffs = computeDiffs(sub, normalizedMerged, "");
		return { isSubset: false, merged: normalizedMerged, diffs };
	} catch (e) {
		return {
			isSubset: false,
			merged: null,
			diffs: [
				{
					path: "$",
					type: "changed",
					expected: sub,
					actual: `Incompatible: ${e instanceof Error ? e.message : String(e)}`,
				},
			],
		};
	}
}
