import type { ValidateTargets } from "./types.ts";

// ─── Validate Targets ────────────────────────────────────────────────────────
//
// Normalizes the `validate` option from `CheckRuntimeOptions` into a concrete
// `{ sub: boolean; sup: boolean }` pair so that `checkWithOptions` can
// independently gate runtime validation (AJV + constraints) per schema.
//
// Input forms:
//   - `undefined` / `false`          → { sub: false, sup: false }
//   - `true`                         → { sub: true,  sup: true  }
//   - `{ sub: true }`                → { sub: true,  sup: false }
//   - `{ sup: true }`                → { sub: false, sup: true  }
//   - `{ sub: true, sup: true }`     → { sub: true,  sup: true  }
//   - `{ sub: false, sup: false }`   → { sub: false, sup: false }

interface ResolvedValidateTargets {
	readonly sub: boolean;
	readonly sup: boolean;
}

/**
 * Normalizes the `validate` option into explicit per-schema flags.
 *
 * @param validate - The raw `validate` value from `CheckRuntimeOptions`
 * @returns An object with `sub` and `sup` booleans indicating which
 *          schemas should undergo runtime validation
 */
export function resolveValidateTargets(
	validate: boolean | ValidateTargets | undefined,
): ResolvedValidateTargets {
	if (validate === undefined || validate === false) {
		return { sub: false, sup: false };
	}

	if (validate === true) {
		return { sub: true, sup: true };
	}

	// Object form — omitted keys default to false
	return {
		sub: validate.sub === true,
		sup: validate.sup === true,
	};
}
