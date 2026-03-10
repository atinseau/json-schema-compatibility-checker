import type { Constraints } from "./src/types";

declare module "json-schema" {
	interface JSONSchema7 {
		constraints?: Constraints;
	}
}
