import { bench, boxplot, summary } from "mitata";
import {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
} from "../src";
import { run } from "./collect";

// ─── Identity (same pattern) ─────────────────────────────────────────────────

const identicalSimple = "^[a-z]+$";
const identicalComplex = "^[A-Z]{2}[0-9]{3}-[a-z]+$";

// ─── Confirmed inclusions (true) ─────────────────────────────────────────────

const fixedQuantSub = "^[a-z]{3}$";
const fixedQuantSup = "^[a-z]+$";

const fixedRangeSub = "^[0-9]{3}$";
const fixedRangeSup = "^[0-9]{1,5}$";

const literalSub = "^abc$";
const literalSup = "^[a-z]+$";

const anchoredPrefixSub = "^[A-Z]{2}[0-9]{3}$";
const anchoredPrefixSup = "^[A-Z]";

const subRangeSub = "^[a-f]+$";
const subRangeSup = "^[a-z]+$";

const specificFormatSub = "^FR[0-9]{5}$";
const specificFormatSup = "^[A-Z]{2}[0-9]+$";

const digitSubsetSub = "^[0-9]+$";
const digitSubsetSup = "^[a-zA-Z0-9]+$";

const universalSup = ".*";
const universalNonEmptySup = ".+";
const anySpecificSub = "^[a-z]{3}$";

const emailLikeSub = "^[a-z]+@[a-z]+\\.[a-z]+$";
const containsAtSup = ".*@.*";

const isoDateSub = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";
const digitDashSup = "^[0-9-]+$";

// ─── Confirmed exclusions (false) ────────────────────────────────────────────

const lettersSub = "^[a-z]+$";
const digitsSup = "^[0-9]+$";

const digitsSub = "^[0-9]+$";
const lettersSup = "^[a-z]+$";

const unboundedSub = "^[a-z]+$";
const fixedSup = "^[a-z]{3}$";

const widerSub = "^[a-z]+$";
const narrowerSup = "^[a-f]+$";

const alphanumSub = "^[a-zA-Z0-9]+$";
const digitsOnlySup = "^[0-9]+$";

const uppercaseSub = "^[A-Z]+$";
const lowercaseSup = "^[a-z]+$";

// ─── Realistic patterns (orchestration use cases) ────────────────────────────

const skuSub = "^SKU-[0-9]{6}$";
const skuSup = "^[A-Z]+-[0-9]+$";

const uuidSub =
	"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
const hexDashSup = "^[0-9a-f-]+$";

const frPostalSub = "^(75|92|93|94)[0-9]{3}$";
const fiveDigitSup = "^[0-9]{5}$";

const semverSub = "^[0-9]+\\.[0-9]+\\.[0-9]+$";
const digitDotSup = "^[0-9.]+$";

// ─── Trivial patterns ────────────────────────────────────────────────────────

const trivialPatterns = [
	".*",
	".+",
	"^.*$",
	"^.+$",
	"^.*",
	".*$",
	"",
	"  ",
	"(?:.*)",
	"(?:.+)",
];
const nonTrivialPatterns = [
	"^[a-z]+$",
	"^[0-9]{3}$",
	"abc",
	"^[A-Z]",
	"[0-9]+",
];

// ─── Equivalence patterns ────────────────────────────────────────────────────

const equivA = "^[a-z]+$";
const equivB = "^[a-z]+$";
const nonEquivA = "^[a-z]+$";
const nonEquivB = "^[a-z]{3}$";
const nonEquivC = "^[0-9]+$";
const asymmetricA = "^[a-f]+$";
const asymmetricB = "^[a-z]+$";

// ─── Benchmarks ──────────────────────────────────────────────────────────────

// ── isPatternSubset: identity ────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("identity: identical simple pattern", () =>
			isPatternSubset(identicalSimple, identicalSimple),
		);
		bench("identity: identical complex pattern", () =>
			isPatternSubset(identicalComplex, identicalComplex),
		);
	});
});

// ── isPatternSubset: confirmed inclusions ────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("inclusion: fixed quant ⊆ unbounded (^[a-z]{3}$ ⊆ ^[a-z]+$)", () =>
			isPatternSubset(fixedQuantSub, fixedQuantSup),
		);
		bench("inclusion: fixed quant ⊆ range (^[0-9]{3}$ ⊆ ^[0-9]{1,5}$)", () =>
			isPatternSubset(fixedRangeSub, fixedRangeSup),
		);
		bench("inclusion: literal ⊆ class (^abc$ ⊆ ^[a-z]+$)", () =>
			isPatternSubset(literalSub, literalSup),
		);
		bench(
			"inclusion: anchored prefix ⊆ partial (^[A-Z]{2}[0-9]{3}$ ⊆ ^[A-Z])",
			() => isPatternSubset(anchoredPrefixSub, anchoredPrefixSup),
		);
		bench("inclusion: sub-range ⊆ full range (^[a-f]+$ ⊆ ^[a-z]+$)", () =>
			isPatternSubset(subRangeSub, subRangeSup),
		);
		bench(
			"inclusion: specific format ⊆ generic (^FR[0-9]{5}$ ⊆ ^[A-Z]{2}[0-9]+$)",
			() => isPatternSubset(specificFormatSub, specificFormatSup),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("inclusion: digits ⊆ alphanumeric", () =>
			isPatternSubset(digitSubsetSub, digitSubsetSup),
		);
		bench("inclusion: any ⊆ .* (universal)", () =>
			isPatternSubset(anySpecificSub, universalSup),
		);
		bench("inclusion: any ⊆ .+ (non-empty universal)", () =>
			isPatternSubset(anySpecificSub, universalNonEmptySup),
		);
		bench("inclusion: email-like ⊆ contains-@", () =>
			isPatternSubset(emailLikeSub, containsAtSup),
		);
		bench("inclusion: ISO date ⊆ digit-dash", () =>
			isPatternSubset(isoDateSub, digitDashSup),
		);
	});
});

// ── isPatternSubset: confirmed exclusions ────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("exclusion: letters ⊄ digits", () =>
			isPatternSubset(lettersSub, digitsSup),
		);
		bench("exclusion: digits ⊄ letters", () =>
			isPatternSubset(digitsSub, lettersSup),
		);
		bench("exclusion: unbounded ⊄ fixed", () =>
			isPatternSubset(unboundedSub, fixedSup),
		);
		bench("exclusion: wider range ⊄ narrower", () =>
			isPatternSubset(widerSub, narrowerSup),
		);
		bench("exclusion: alphanumeric ⊄ digits only", () =>
			isPatternSubset(alphanumSub, digitsOnlySup),
		);
		bench("exclusion: uppercase ⊄ lowercase", () =>
			isPatternSubset(uppercaseSub, lowercaseSup),
		);
	});
});

// ── isPatternSubset: realistic patterns ──────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("realistic: SKU format ⊆ alphanumeric-dash", () =>
			isPatternSubset(skuSub, skuSup),
		);
		bench("realistic: UUID v4 ⊆ hex-dash", () =>
			isPatternSubset(uuidSub, hexDashSup),
		);
		bench("realistic: French postal ⊆ 5-digit", () =>
			isPatternSubset(frPostalSub, fiveDigitSup),
		);
		bench("realistic: semver ⊆ digit-dot", () =>
			isPatternSubset(semverSub, digitDotSup),
		);
	});
});

// ── isPatternSubset: custom sample counts ────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("sample count: default (^[a-z]{3}$ ⊆ ^[a-z]+$)", () =>
			isPatternSubset(fixedQuantSub, fixedQuantSup),
		);
		bench("sample count: low (50)", () =>
			isPatternSubset(fixedQuantSub, fixedQuantSup, 50),
		);
		bench("sample count: high (500)", () =>
			isPatternSubset(fixedQuantSub, fixedQuantSup, 500),
		);
	});
});

// ── arePatternsEquivalent ────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("equivalent: identical patterns", () =>
			arePatternsEquivalent(equivA, equivB),
		);
		bench("non-equivalent: different cardinality", () =>
			arePatternsEquivalent(nonEquivA, nonEquivB),
		);
		bench("non-equivalent: disjoint character sets", () =>
			arePatternsEquivalent(nonEquivA, nonEquivC),
		);
		bench("non-equivalent: asymmetric inclusion (subset not equivalence)", () =>
			arePatternsEquivalent(asymmetricA, asymmetricB),
		);
	});
});

// ── isTrivialPattern ─────────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("trivial: .* (universal)", () => isTrivialPattern(".*"));
		bench("trivial: .+ (non-empty universal)", () => isTrivialPattern(".+"));
		bench("trivial: ^.*$ (anchored universal)", () => isTrivialPattern("^.*$"));
		bench("trivial: empty string", () => isTrivialPattern(""));
		bench("trivial: (?:.*) (group universal)", () =>
			isTrivialPattern("(?:.*)"),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("non-trivial: ^[a-z]+$", () => isTrivialPattern("^[a-z]+$"));
		bench("non-trivial: ^[0-9]{3}$", () => isTrivialPattern("^[0-9]{3}$"));
		bench("non-trivial: abc", () => isTrivialPattern("abc"));
	});
});

// ── Combined: batch of trivial checks ────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("batch: 10 trivial patterns", () => {
			for (const p of trivialPatterns) {
				isTrivialPattern(p);
			}
		});
		bench("batch: 5 non-trivial patterns", () => {
			for (const p of nonTrivialPatterns) {
				isTrivialPattern(p);
			}
		});
	});
});

await run();
