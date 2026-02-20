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

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Crée un générateur RandExp configuré pour un pattern donné.
 *
 * @param pattern  Le pattern regex source
 * @returns        L'instance RandExp configurée, ou null si le pattern est invalide
 */
function createGenerator(pattern: string): RandExp | null {
	try {
		const randexp = new RandExp(pattern);
		randexp.max = MAX_REPETITION;
		return randexp;
	} catch {
		return null;
	}
}

/**
 * Compile un pattern en RegExp avec gestion d'erreur.
 *
 * @param pattern  Le pattern regex à compiler
 * @returns        L'objet RegExp compilé, ou null si invalide
 */
function compileRegex(pattern: string): RegExp | null {
	try {
		return new RegExp(pattern);
	} catch {
		return null;
	}
}

/**
 * Génère un ensemble diversifié de strings matchant un pattern.
 *
 * Utilise plusieurs passes avec des seeds différentes pour maximiser
 * la diversité des échantillons et réduire le risque de faux positifs.
 *
 * @param generator   Le générateur RandExp
 * @param count       Le nombre total d'échantillons à produire
 * @returns           Un Set de strings uniques générées
 */
function generateDiverseSamples(
	generator: RandExp,
	count: number,
): Set<string> {
	const samples = new Set<string>();
	let attempts = 0;
	const maxAttempts = count * 3; // Éviter les boucles infinies

	while (samples.size < count && attempts < maxAttempts) {
		const sample = generator.gen();
		if (typeof sample === "string" && sample.length <= MAX_GENERATED_LENGTH) {
			samples.add(sample);
		}
		attempts++;
	}

	return samples;
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

	// ── Compiler le pattern sup ──
	const supRegex = compileRegex(supPattern);
	if (supRegex === null) return null;

	// ── Créer le générateur pour sub ──
	const generator = createGenerator(subPattern);
	if (generator === null) return null;

	// ── Générer les échantillons ──
	const samples = generateDiverseSamples(generator, sampleCount);

	// Si aucun échantillon n'a pu être généré → indéterminé
	if (samples.size === 0) return null;

	// ── Vérifier chaque échantillon contre sup ──
	for (const sample of samples) {
		if (!supRegex.test(sample)) {
			// Contre-exemple trouvé → sub ⊄ sup (certain)
			return false;
		}
	}

	// Tous les échantillons matchent → sub ⊆ sup (confiance haute)
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

	// Patterns universels courants (avec ou sans anchors)
	const universalPatterns = new Set([
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

	return universalPatterns.has(trimmed);
}
