import RandExp from "randexp";

// ─── Pattern Subset Checker ──────────────────────────────────────────────────
//
// Vérifie si un pattern regex est un sous-ensemble d'un autre pattern regex
// via une approche par échantillonnage (sampling).
//
// Principe :
//   L(A) ⊆ L(B)  ⟺  ∀s ∈ L(A), s ∈ L(B)
//
// On ne peut pas prouver ça formellement pour des regex ECMA-262 arbitraires
// (le problème est PSPACE-complet pour les regex pures, et indécidable avec
// les extensions comme les backreferences).
//
// Approche pragmatique :
//   1. Générer N strings aléatoires matchant le pattern sub (via `randexp`)
//   2. Vérifier que CHAQUE string matche aussi le pattern sup
//   3. Si toutes matchent → retourner `true` (confiance haute)
//   4. Si au moins une ne matche pas → retourner `false` (certain)
//   5. Si la génération échoue → retourner `null` (indéterminé)
//
// Limites :
//   - Faux positifs possibles (mais très improbables avec N suffisant)
//   - Ne gère pas les regex avec backreferences complexes
//   - `randexp` peut générer des strings biaisées (pas uniformément distribuées)
//
// Pour mitiger les faux positifs, on utilise :
//   - Un nombre d'échantillons élevé (200 par défaut)
//   - Plusieurs seeds pour diversifier la génération
//   - Un fallback `null` en cas de doute

// ─── Configuration ───────────────────────────────────────────────────────────

/** Nombre d'échantillons générés par défaut */
const DEFAULT_SAMPLE_COUNT = 200;

/** Longueur maximale des strings générées par randexp */
const MAX_GENERATED_LENGTH = 100;

/** Nombre maximal de répétitions pour les quantificateurs unbounded (*, +, {n,}) */
const MAX_REPETITION = 20;

// ─── Result Cache ────────────────────────────────────────────────────────────

/**
 * Cache des résultats de isPatternSubset pour éviter de recalculer
 * les mêmes comparaisons. La clé est `${subPattern}\0${supPattern}\0${sampleCount}`.
 */
const subsetCache = new Map<string, boolean | null>();

/**
 * Cache des résultats de compilation RegExp pour éviter les recompilations.
 */
const regexCache = new Map<string, RegExp | null>();

/**
 * Cache des générateurs RandExp pour éviter les re-créations.
 */
const generatorCache = new Map<string, RandExp | null>();

/**
 * Vide les caches internes. Utile pour les tests ou la gestion mémoire.
 */
export function clearPatternCaches(): void {
	subsetCache.clear();
	regexCache.clear();
	generatorCache.clear();
}

// ─── Trivial pattern detection (module-level constants) ──────────────────────

/**
 * Patterns universels connus — matchent toute string (ou presque).
 * Défini au niveau du module pour éviter de recréer le Set à chaque appel.
 */
const UNIVERSAL_PATTERNS: ReadonlySet<string> = new Set([
	".*",
	".+",
	"^.*$",
	"^.+$",
	"^.*",
	".*$",
	"^.+",
	".+$",
	"(?:.*)",
	"(?:.+)",
]);

/**
 * Patterns anchored universal — variantes fréquentes qui matchent tout.
 * Utilisé pour la détection rapide de superset universels.
 */
const _ANCHORED_UNIVERSAL_REGEX =
	/^\^?\(?:\.\*\)?\$?$|^\^?\.\*\$?$|^\^?\.\+\$?$/;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Crée un générateur RandExp configuré pour un pattern donné (avec cache).
 *
 * @param pattern  Le pattern regex source
 * @returns        L'instance RandExp configurée, ou null si le pattern est invalide
 */
function createGenerator(pattern: string): RandExp | null {
	const cached = generatorCache.get(pattern);
	if (cached !== undefined) return cached;

	try {
		const randexp = new RandExp(pattern);
		randexp.max = MAX_REPETITION;
		generatorCache.set(pattern, randexp);
		return randexp;
	} catch {
		generatorCache.set(pattern, null);
		return null;
	}
}

/**
 * Compile un pattern en RegExp avec gestion d'erreur et cache.
 *
 * @param pattern  Le pattern regex à compiler
 * @returns        L'objet RegExp compilé, ou null si invalide
 */
function compileRegex(pattern: string): RegExp | null {
	const cached = regexCache.get(pattern);
	if (cached !== undefined) return cached;

	try {
		const regex = new RegExp(pattern);
		regexCache.set(pattern, regex);
		return regex;
	} catch {
		regexCache.set(pattern, null);
		return null;
	}
}

/**
 * Vérifie si un pattern est un superset universel (matche tout).
 * Utilisé pour court-circuiter le sampling quand sup matche tout.
 */
function isUniversalSuperset(pattern: string): boolean {
	const trimmed = pattern.trim();
	if (trimmed === "" || UNIVERSAL_PATTERNS.has(trimmed)) return true;

	// Vérifier des variantes avec anchors optionnels
	// Ex: "^(.*)$", "^(.+)$" etc.
	if (trimmed === "^(.*)$" || trimmed === "^(.+)$") return true;

	return false;
}

/**
 * Vérifie si subPattern est un sous-string littéral de supPattern
 * ou si le sup est clairement plus large (heuristiques rapides).
 * Retourne true si sub ⊆ sup est garanti, false sinon.
 */
function quickSubsetCheck(
	_subPattern: string,
	supPattern: string,
): boolean | null {
	// Si sup est universel → tout est un sous-ensemble
	if (isUniversalSuperset(supPattern)) return true;

	// Si sub est un pattern littéral exact (anchored string sans métacaractères)
	// et que sup contient une classe de caractères ou quantificateur qui l'englobe,
	// on ne peut pas le déterminer facilement → null
	return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Vérifie si le langage du pattern `sub` est un sous-ensemble du langage
 * du pattern `sup` via échantillonnage.
 *
 * `sub ⊆ sup` signifie : toute string matchant `sub` matche aussi `sup`.
 *
 * Contrat ternaire :
 *   - `true`  → toutes les strings échantillonnées de sub matchent sup
 *               (confiance haute, pas une preuve formelle)
 *   - `false` → au moins une string de sub ne matche PAS sup
 *               (certain — c'est un contre-exemple concret)
 *   - `null`  → impossible de déterminer (pattern invalide, génération échouée)
 *
 * @param subPattern    Le pattern regex du schema sub
 * @param supPattern    Le pattern regex du schema sup
 * @param sampleCount   Nombre d'échantillons (défaut: 200)
 * @returns             `true`, `false`, ou `null`
 *
 * @example
 * ```ts
 * isPatternSubset("^[a-z]{3}$", "^[a-z]+$");      // true  — 3 lettres ⊆ 1+ lettres
 * isPatternSubset("^[a-z]+$", "^[0-9]+$");         // false — lettres ⊄ chiffres
 * isPatternSubset("^[a-z]+$", "^[a-z]{3}$");       // false — "ab" matche sub mais pas sup
 * isPatternSubset("invalid[", "^[a-z]+$");          // null  — pattern invalide
 * ```
 */
export function isPatternSubset(
	subPattern: string,
	supPattern: string,
	sampleCount: number = DEFAULT_SAMPLE_COUNT,
): boolean | null {
	// ── Identité : même pattern → toujours subset ──
	if (subPattern === supPattern) return true;

	// ── Cache lookup ──
	const cacheKey = `${subPattern}\0${supPattern}\0${sampleCount}`;
	const cached = subsetCache.get(cacheKey);
	if (cached !== undefined) return cached;

	// ── Quick checks avant le sampling ──
	const quick = quickSubsetCheck(subPattern, supPattern);
	if (quick !== null) {
		subsetCache.set(cacheKey, quick);
		return quick;
	}

	// ── Compiler le pattern sup ──
	const supRegex = compileRegex(supPattern);
	if (supRegex === null) {
		subsetCache.set(cacheKey, null);
		return null;
	}

	// ── Créer le générateur pour sub ──
	const generator = createGenerator(subPattern);
	if (generator === null) {
		subsetCache.set(cacheKey, null);
		return null;
	}

	// ── Générer et vérifier les échantillons paresseusement ──
	// Au lieu de générer tous les échantillons d'abord puis les vérifier,
	// on génère et vérifie un par un pour permettre un arrêt précoce
	// dès qu'un contre-exemple est trouvé.
	const seen = new Set<string>();
	let validSamples = 0;
	let attempts = 0;
	const maxAttempts = sampleCount * 3; // Éviter les boucles infinies

	while (validSamples < sampleCount && attempts < maxAttempts) {
		attempts++;
		const sample = generator.gen();

		// Valider que l'échantillon est utilisable
		if (typeof sample !== "string" || sample.length > MAX_GENERATED_LENGTH) {
			continue;
		}

		// Dédupliquer les échantillons
		if (seen.has(sample)) {
			continue;
		}
		seen.add(sample);
		validSamples++;

		// ── Vérification immédiate contre sup ──
		// Arrêt précoce dès qu'un contre-exemple est trouvé
		if (!supRegex.test(sample)) {
			// Contre-exemple trouvé → sub ⊄ sup (certain)
			subsetCache.set(cacheKey, false);
			return false;
		}
	}

	// Si aucun échantillon n'a pu être généré → indéterminé
	if (validSamples === 0) {
		subsetCache.set(cacheKey, null);
		return null;
	}

	// Tous les échantillons matchent → sub ⊆ sup (confiance haute)
	subsetCache.set(cacheKey, true);
	return true;
}

/**
 * Vérifie si deux patterns sont équivalents (acceptent le même langage)
 * via échantillonnage bidirectionnel.
 *
 * `A ≡ B` signifie : `A ⊆ B` ET `B ⊆ A`.
 *
 * @param patternA     Premier pattern regex
 * @param patternB     Second pattern regex
 * @param sampleCount  Nombre d'échantillons par direction (défaut: 200)
 * @returns            `true`, `false`, ou `null`
 */
export function arePatternsEquivalent(
	patternA: string,
	patternB: string,
	sampleCount: number = DEFAULT_SAMPLE_COUNT,
): boolean | null {
	if (patternA === patternB) return true;

	const aSubB = isPatternSubset(patternA, patternB, sampleCount);
	if (aSubB === null) return null;
	if (aSubB === false) return false;

	const bSubA = isPatternSubset(patternB, patternA, sampleCount);
	if (bSubA === null) return null;

	return bSubA;
}

/**
 * Vérifie si un pattern est "trivially universal" — i.e., il matche
 * toute string (ou presque). Utile pour détecter les patterns qui
 * n'ajoutent aucune contrainte réelle.
 *
 * Patterns détectés comme universels :
 *   - `.*`
 *   - `.+` (matche tout sauf la string vide)
 *   - `^.*$`
 *   - `^.+$`
 *   - Patterns vides ou whitespace
 *
 * @param pattern  Le pattern à vérifier
 * @returns        `true` si le pattern est trivial/universel
 */
export function isTrivialPattern(pattern: string): boolean {
	const trimmed = pattern.trim();
	if (trimmed === "") return true;

	return UNIVERSAL_PATTERNS.has(trimmed);
}
