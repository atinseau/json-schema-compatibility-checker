import type { ValidateTargets } from "./types.ts";

// ─── Validate Targets ────────────────────────────────────────────────────────
//
// Normalizes the `validate` option from `CheckRuntimeOptions` into a concrete
// `{ sub: boolean; sup: boolean; partialSub: boolean; partialSup: boolean }`
// tuple so that `checkWithOptions` can independently gate runtime validation
// (AJV + constraints) per schema and apply partial mode per target.
//
// Input forms:
//   - `undefined` / `false`                        → all false
//   - `true`                                       → { sub: true, sup: true, partialSub: false, partialSup: false }
//   - `{ sub: true }`                              → { sub: true, sup: false, ... }
//   - `{ sup: true }`                              → { sub: false, sup: true, ... }
//   - `{ sub: true, sup: true }`                   → { sub: true, sup: true, ... }
//   - `{ sub: false, sup: false }`                 → all false
//   - `{ sup: { partial: true } }`                 → { sub: false, sup: true, partialSub: false, partialSup: true }
//   - `{ sub: { partial: true }, sup: true }`      → { sub: true, sup: true, partialSub: true, partialSup: false }

export interface ResolvedValidateTargets {
	readonly sub: boolean;
	readonly sup: boolean;
	readonly partialSub: boolean;
	readonly partialSup: boolean;
}

const ALL_FALSE: ResolvedValidateTargets = {
	sub: false,
	sup: false,
	partialSub: false,
	partialSup: false,
};

const ALL_TRUE_NO_PARTIAL: ResolvedValidateTargets = {
	sub: true,
	sup: true,
	partialSub: false,
	partialSup: false,
};

/**
 * Resolves a single validate target value into an enabled flag and a partial flag.
 *
 * @param target - `true`, `false`, `undefined`, or `{ partial?: boolean }`
 * @returns `[enabled, partial]` tuple
 */
function resolveTarget(
	target: boolean | { partial?: boolean } | undefined,
): [enabled: boolean, partial: boolean] {
	if (target === undefined || target === false) {
		return [false, false];
	}

	if (target === true) {
		return [true, false];
	}

	// Object form — `{ partial?: boolean }`
	// Providing the object at all means the target is enabled.
	return [true, target.partial === true];
}

/**
 * Normalizes the `validate` option into explicit per-schema flags
 * including partial mode.
 *
 * @param validate - The raw `validate` value from `CheckRuntimeOptions`
 * @returns An object with `sub`, `sup`, `partialSub`, and `partialSup`
 *          booleans indicating which schemas should undergo runtime
 *          validation and whether partial mode applies
 */
export function resolveValidateTargets(
	validate: boolean | ValidateTargets | undefined,
): ResolvedValidateTargets {
	if (validate === undefined || validate === false) {
		return ALL_FALSE;
	}

	if (validate === true) {
		return ALL_TRUE_NO_PARTIAL;
	}

	// Object form — resolve each target independently
	const [sub, partialSub] = resolveTarget(validate.sub);
	const [sup, partialSup] = resolveTarget(validate.sup);

	return { sub, sup, partialSub, partialSup };
}
