# Types exportés

```ts
import type {
  SubsetResult,
  SchemaError,
  ResolvedConditionResult,
  ResolvedSubsetResult,
  CheckConditionsOptions,
} from "json-schema-compatibility-checker";
```

---

## `SchemaError`

```ts
interface SchemaError {
  /** Chemin normalisé vers la propriété concernée (ex: "user.name", "users[].name", "accountId") */
  key: string;
  /** Type ou valeur attendu(e) par le schema cible (sup) */
  expected: string;
  /** Type ou valeur reçu(e) depuis le schema source (sub) */
  received: string;
}
```

---

## `SubsetResult`

```ts
interface SubsetResult {
  /** true si sub ⊆ sup */
  isSubset: boolean;
  /** Le schema résultant de l'intersection allOf(sub, sup), ou null si incompatible */
  merged: JSONSchema7Definition | null;
  /** Erreurs sémantiques décrivant les incompatibilités entre les deux schemas */
  errors: SchemaError[];
}
```

---

## `ResolvedConditionResult`

```ts
interface ResolvedConditionResult {
  /** Le schema avec les if/then/else résolus (aplatis) */
  resolved: JSONSchema7;
  /** La branche qui a été appliquée ("then" | "else" | null si pas de condition) */
  branch: "then" | "else" | null;
  /** Le discriminant utilisé pour résoudre */
  discriminant: Record<string, unknown>;
}
```

---

## `ResolvedSubsetResult`

```ts
interface ResolvedSubsetResult extends SubsetResult {
  /** Résultat de résolution des conditions du sub */
  resolvedSub: ResolvedConditionResult;
  /** Résultat de résolution des conditions du sup */
  resolvedSup: ResolvedConditionResult;
}
```

---

## `CheckConditionsOptions`

```ts
interface CheckConditionsOptions {
  /** Runtime data for the sub schema — used for condition resolution and enum narrowing */
  subData: unknown;
  /** Runtime data for the sup schema (defaults to subData) — used for condition resolution and enum narrowing */
  supData?: unknown;
}
```
