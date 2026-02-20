import {
	isEmail,
	isFQDN,
	isIP,
	isISO8601,
	isURL,
	isUUID,
} from "class-validator";
import includes from "lodash/includes";

// ─── Format Validator ─────────────────────────────────────────────────────────
//
// Valide les valeurs contre les formats JSON Schema Draft-07 en utilisant
// les fonctions utilitaires de `class-validator`.
//
// ⚠️  Ce module ne gère PAS la relation format ⊆ type.
// Cette relation est déjà correctement gérée par l'approche merge :
//   - { format: "email" } ⊆ { type: "string" } → true (merge ne change rien)
//   - { type: "string" } ⊄ { format: "email" } → false (merge ajoute format)
//
// Ce module gère UNIQUEMENT :
//   1. La validation d'une valeur runtime contre un format (evaluateCondition)
//   2. La compatibilité entre deux formats différents (format-vs-format)
//
// Expose :
//   - `validateFormat(value, format)` → validation runtime d'une valeur
//   - `isFormatSubset(sub, sup)` → compatibilité statique format-vs-format
//   - `isKnownFormat(format)` → vérifie si le format est supporté
//   - `FORMAT_SUPERSETS` → hiérarchie d'inclusion entre formats

// ─── Regex patterns ──────────────────────────────────────────────────────────

/** Regex pour le format `time` (HH:MM:SS avec offset optionnel) */
const TIME_REGEX = /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** Regex pour le format `date` (YYYY-MM-DD strict) */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Regex pour le format `json-pointer` (RFC 6901) */
const JSON_POINTER_REGEX = /^(\/([^~/]|~[01])*)*$/;

/** Regex pour le format `relative-json-pointer` (extension Draft-07) */
const RELATIVE_JSON_POINTER_REGEX = /^\d+(#|(\/([^~/]|~[01])*)*)$/;

/** Regex pour le format `uri-template` (RFC 6570 — vérification basique) */
const _URI_TEMPLATE_REGEX = /\{[^}]+\}/;

// ─── Known formats ──────────────────────────────────────────────────────────

/** Formats reconnus par le validateur */
export const KNOWN_FORMATS: ReadonlySet<string> = new Set([
	"date-time",
	"date",
	"time",
	"email",
	"idn-email",
	"hostname",
	"idn-hostname",
	"ipv4",
	"ipv6",
	"uri",
	"uri-reference",
	"iri",
	"iri-reference",
	"uri-template",
	"uuid",
	"json-pointer",
	"relative-json-pointer",
	"regex",
]);

// ─── Format hierarchy ────────────────────────────────────────────────────────

/**
 * Hiérarchie d'inclusion ENTRE FORMATS (pas format-vs-type).
 *
 * `FORMAT_SUPERSETS[format]` = liste des formats qui sont des sur-ensembles
 * de `format` (i.e., toute valeur valide pour `format` est aussi valide
 * pour chacun des sur-ensembles).
 *
 * Cette hiérarchie ne concerne QUE les comparaisons format-vs-format.
 * La relation format ⊆ type (ex: email ⊆ string) est gérée nativement
 * par le merge engine et n'a pas besoin d'être modélisée ici.
 *
 * En pratique, la plupart des formats sont **incomparables** (pas de relation d'inclusion).
 * Seule l'identité (même format) et les quelques relations ci-dessous sont garanties.
 */
export const FORMAT_SUPERSETS: Record<string, string[]> = {
	email: ["idn-email"], // email ⊆ idn-email (toute email ASCII est une idn-email)
	hostname: ["idn-hostname"], // hostname ⊆ idn-hostname
	uri: ["iri"], // uri ⊆ iri (toute URI est une IRI)
	"uri-reference": ["iri-reference"], // uri-reference ⊆ iri-reference
};

// ─── Format validators (internal) ───────────────────────────────────────────

/**
 * Map interne des fonctions de validation par format.
 *
 * Chaque entrée associe un format Draft-07 à une fonction qui prend
 * une valeur `string` et retourne `boolean`.
 *
 * Utilise les fonctions standalone de `class-validator` quand disponibles,
 * sinon des regex ou des heuristiques.
 */
const FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
	/** ISO 8601 date-time (ex: "2023-01-15T10:30:00Z") */
	"date-time": (value: string): boolean => {
		return isISO8601(value, { strict: true });
	},

	/** Date complète (ex: "2023-01-15") */
	date: (value: string): boolean => {
		if (!DATE_REGEX.test(value)) return false;
		// Vérifier que la date est valide (pas de 2023-02-30)
		const d = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
	},

	/** Heure complète (ex: "10:30:00") */
	time: (value: string): boolean => {
		return TIME_REGEX.test(value);
	},

	/** Adresse email (RFC 5321) */
	email: (value: string): boolean => {
		return isEmail(value);
	},

	/** Adresse email internationalisée (approximation via isEmail) */
	"idn-email": (value: string): boolean => {
		return isEmail(value);
	},

	/** Nom d'hôte (RFC 1123) */
	hostname: (value: string): boolean => {
		return isFQDN(value, { require_tld: false });
	},

	/** Nom d'hôte internationalisé (approximation via isFQDN) */
	"idn-hostname": (value: string): boolean => {
		return isFQDN(value, { require_tld: false });
	},

	/** Adresse IPv4 (ex: "192.168.1.1") */
	ipv4: (value: string): boolean => {
		return isIP(value, 4);
	},

	/** Adresse IPv6 (ex: "::1") */
	ipv6: (value: string): boolean => {
		return isIP(value, 6);
	},

	/** URI absolue (RFC 3986) */
	uri: (value: string): boolean => {
		return isURL(value, { require_protocol: true });
	},

	/** Référence URI (absolue ou relative — approximation via isURL) */
	"uri-reference": (value: string): boolean => {
		// Une uri-reference peut être relative, isURL est une approximation
		return isURL(value, { require_protocol: false });
	},

	/** IRI (RFC 3987 — approximation via isURL) */
	iri: (value: string): boolean => {
		return isURL(value, { require_protocol: true });
	},

	/** Référence IRI (approximation via isURL) */
	"iri-reference": (value: string): boolean => {
		return isURL(value, { require_protocol: false });
	},

	/** Template URI (RFC 6570 — vérification basique) */
	"uri-template": (value: string): boolean => {
		// Un uri-template valide peut contenir des expressions entre accolades
		// ou être une URI simple sans template expressions.
		// On vérifie juste que les accolades sont bien formées.
		let inBrace = false;
		for (const ch of value) {
			if (ch === "{") {
				if (inBrace) return false; // Accolades imbriquées
				inBrace = true;
			} else if (ch === "}") {
				if (!inBrace) return false; // Accolade fermante sans ouvrante
				inBrace = false;
			}
		}
		return !inBrace; // Pas d'accolade non fermée
	},

	/** UUID (RFC 4122) */
	uuid: (value: string): boolean => {
		return isUUID(value);
	},

	/** JSON Pointer (RFC 6901) */
	"json-pointer": (value: string): boolean => {
		// Chaîne vide est un json-pointer valide (pointe vers la racine)
		if (value === "") return true;
		return JSON_POINTER_REGEX.test(value);
	},

	/** Relative JSON Pointer (extension Draft-07) */
	"relative-json-pointer": (value: string): boolean => {
		return RELATIVE_JSON_POINTER_REGEX.test(value);
	},

	/** Expression régulière ECMA-262 */
	regex: (value: string): boolean => {
		try {
			new RegExp(value);
			return true;
		} catch {
			return false;
		}
	},
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Vérifie si le format est connu/supporté.
 *
 * @param format  Le nom du format à vérifier
 * @returns       `true` si le format est dans la liste des formats reconnus
 */
export function isKnownFormat(format: string): boolean {
	return KNOWN_FORMATS.has(format);
}

/**
 * Valide une valeur contre un format JSON Schema Draft-07.
 *
 * Retourne `true` si la valeur est valide pour le format,
 * `false` si elle ne l'est pas, `null` si le format est inconnu.
 *
 * Ne valide que les strings — pour les non-strings, retourne `true`
 * (le format ne s'applique qu'aux strings en Draft-07).
 *
 * @param value   La valeur à valider
 * @param format  Le format JSON Schema Draft-07 à vérifier
 * @returns       `true` si valide, `false` si invalide, `null` si format inconnu
 *
 * @example
 * ```ts
 * validateFormat("test@example.com", "email");  // true
 * validateFormat("not-an-email", "email");       // false
 * validateFormat(42, "email");                   // true (non-string → skip)
 * validateFormat("foo", "unknown-format");       // null (format inconnu)
 * ```
 */
export function validateFormat(value: unknown, format: string): boolean | null {
	// Le format ne s'applique qu'aux strings en Draft-07
	if (typeof value !== "string") return true;

	const validator = FORMAT_VALIDATORS[format];
	if (!validator) return null; // Format inconnu → indéterminé

	return validator(value);
}

/**
 * Vérifie si le format `sub` est un sous-ensemble du format `sup`.
 *
 * ⚠️  Cette fonction compare UNIQUEMENT deux formats entre eux.
 * Elle ne gère PAS la relation format ⊆ type (ex: email ⊆ string),
 * qui est déjà correctement gérée par le merge engine.
 *
 * `sub ⊆ sup` signifie : toute valeur valide pour `sub` est aussi valide pour `sup`.
 *
 * Retourne `true` si `sub ⊆ sup`, `false` si incompatible, `null` si indéterminé.
 *
 * Cas gérés :
 *   - Identité : `sub === sup` → `true`
 *   - Hiérarchie : `sup` est dans `FORMAT_SUPERSETS[sub]` → `true`
 *   - Hiérarchie inverse : `sub` est dans `FORMAT_SUPERSETS[sup]` → `null`
 *     (le subset est un sur-ensemble du superset → indéterminé, pas un conflit
 *     car certaines valeurs valides pour sub pourraient aussi être valides pour sup)
 *   - Formats différents sans relation connue → `null` (indéterminé)
 *
 * @param subFormat  Le format du schema sub
 * @param supFormat  Le format du schema sup
 * @returns          `true` si sub ⊆ sup, `null` si indéterminé
 *
 * @example
 * ```ts
 * isFormatSubset("email", "email");       // true (identité)
 * isFormatSubset("email", "idn-email");   // true (email ⊆ idn-email)
 * isFormatSubset("email", "ipv4");        // null (incomparable)
 * isFormatSubset("idn-email", "email");   // null (sur-ensemble, pas sous-ensemble)
 * ```
 */
export function isFormatSubset(
	subFormat: string,
	supFormat: string,
): boolean | null {
	// Identité : même format → toujours un sous-ensemble
	if (subFormat === supFormat) return true;

	// Hiérarchie : vérifier si sup est un sur-ensemble connu de sub
	const supersets = FORMAT_SUPERSETS[subFormat];
	if (supersets && includes(supersets, supFormat)) {
		return true;
	}

	// Formats différents sans relation connue → indéterminé
	// On ne retourne PAS false ici car on ne peut pas affirmer l'incompatibilité
	// entre deux formats quelconques sans les connaître parfaitement.
	// Le merge engine (via hasFormatConflict) se charge de détecter les conflits
	// quand les deux schemas ont un format et qu'aucune relation n'est connue.
	return null;
}
