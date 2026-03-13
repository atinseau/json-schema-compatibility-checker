# API Reference

## Sommaire

- [`JsonSchemaCompatibilityChecker`](#jsonschemacompatibilitychecker) — Vérification de compatibilité entre schemas
  - [`isSubset(sub, sup)`](#issubsetsub-sup)
  - [`check(sub, sup)`](#checksub-sup)
  - [`isEqual(a, b)`](#isequala-b)
  - [`intersect(a, b)`](#intersecta-b)
  - [`resolveConditions(schema, data)`](#resolveconditionsschema-data)
  - [`check(sub, sup, options)`](#checksub-sup-options)
  - [`normalize(schema)`](#normalizeschema)
  - [`formatResult(label, result)`](#formatresultlabel-result)
- [`MergeEngine`](#mergeengine) — Opérations bas-niveau sur les schemas
  - [`merge(a, b)`](#mergea-b)
  - [`mergeOrThrow(a, b)`](#mergeorthrowa-b)
  - [`overlay(base, override)`](#overlaybase-override)
  - [`compare(a, b)`](#comparea-b)
  - [`isEqual(a, b)`](#isequala-b-1) (MergeEngine)

---

# `JsonSchemaCompatibilityChecker`

Toutes les méthodes de vérification de compatibilité sont exposées par la classe `JsonSchemaCompatibilityChecker`.

```ts
import { JsonSchemaCompatibilityChecker } from "json-schema-compatibility-checker";

const checker = new JsonSchemaCompatibilityChecker();
```

---

## `isSubset(sub, sup)`

```ts
isSubset(sub: JSONSchema7Definition, sup: JSONSchema7Definition): boolean
```

Vérifie si `sub ⊆ sup` — c'est-à-dire si **toute valeur valide pour `sub` est aussi valide pour `sup`**.

Retourne un simple `boolean`.

```ts
// integer est un sous-ensemble de number
checker.isSubset({ type: "integer" }, { type: "number" });
// → true

// number n'est PAS un sous-ensemble de integer
checker.isSubset({ type: "number" }, { type: "integer" });
// → false

// string n'est PAS un sous-ensemble de number
checker.isSubset({ type: "string" }, { type: "number" });
// → false
```

### Schemas booléens

```ts
// false (aucune valeur) est sous-ensemble de tout
checker.isSubset(false, true);          // → true
checker.isSubset(false, { type: "string" }); // → true

// true (toutes les valeurs) n'est sous-ensemble de rien de spécifique
checker.isSubset(true, { type: "string" }); // → false

// Tout schema est sous-ensemble de true
checker.isSubset({ type: "string" }, true); // → true
```

---

## `check(sub, sup)`

```ts
check(sub: JSONSchema7Definition, sup: JSONSchema7Definition): SubsetResult
check(sub: JSONSchema7Definition, sup: JSONSchema7Definition, options: CheckRuntimeOptions): ResolvedSubsetResult
```

Comme `isSubset`, mais retourne un **résultat détaillé** avec les erreurs sémantiques.

Quand `options` est fourni, les conditions `if/then/else` sont résolues avant le check (voir [`check(sub, sup, options)`](#checksub-sup-options) plus bas).

```ts
interface SchemaError {
  key: string;        // Chemin normalisé (ex: "user.name", "users[].email")
  expected: string;   // Type/valeur attendu(e) par le schema cible (sup)
  received: string;   // Type/valeur reçu(e) depuis le schema source (sub)
}

interface SubsetResult {
  isSubset: boolean;
  merged: JSONSchema7Definition | null;  // Résultat de l'intersection
  errors: SchemaError[];                  // Erreurs sémantiques
}
```

### Exemple — Check compatible

```ts
const result = checker.check(
  { type: "string", minLength: 5 },
  { type: "string" }
);

console.log(result.isSubset); // true
console.log(result.errors);   // [] (aucune erreur)
console.log(result.merged);   // { type: "string", minLength: 5 }
```

### Exemple — Check incompatible avec diagnostic

```ts
const sub = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
};

const sup = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

const result = checker.check(sub, sup);
console.log(result.errors);
// [{ key: "age", expected: "number", received: "undefined" }]

console.log(result.isSubset); // false
console.log(result.errors);
// [
//   { key: "age", expected: "number", received: "undefined" }
// ]
```

### Exemple — Types incompatibles

```ts
const result = checker.check({ type: "string" }, { type: "number" });

console.log(result.isSubset); // false
console.log(result.merged);   // null (intersection impossible)
console.log(result.errors);   // [{ key: "$root", expected: "number", received: "string" }]
```

---

## `isEqual(a, b)`

```ts
isEqual(a: JSONSchema7Definition, b: JSONSchema7Definition): boolean
```

Vérifie l'**égalité structurelle** entre deux schemas après normalisation.

```ts
checker.isEqual(
  { type: "string", minLength: 1 },
  { type: "string", minLength: 1 }
);
// → true

checker.isEqual(
  { type: "string" },
  { type: "number" }
);
// → false
```

---

## `intersect(a, b)`

```ts
intersect(
  a: JSONSchema7Definition,
  b: JSONSchema7Definition
): JSONSchema7Definition | null
```

Calcule l'**intersection** de deux schemas (merge `allOf`). Retourne `null` si les schemas sont incompatibles.

### Exemple — Intersection de contraintes numériques

```ts
const result = checker.intersect(
  { type: "number", minimum: 5, maximum: 10 },
  { type: "number", minimum: 0, maximum: 100 }
);
// → { type: "number", minimum: 5, maximum: 10 }
// L'intersection conserve les contraintes les plus restrictives
```

### Exemple — Intersection de propriétés d'objets

```ts
const result = checker.intersect(
  {
    type: "object",
    properties: { a: { type: "string" } },
    required: ["a"],
  },
  {
    type: "object",
    properties: { b: { type: "number" } },
    required: ["b"],
  }
);
// → {
//     type: "object",
//     properties: { a: { type: "string" }, b: { type: "number" } },
//     required: ["a", "b"]
//   }
```

### Exemple — Intersection d'enums

```ts
const result = checker.intersect(
  { type: "string", enum: ["a", "b", "c"] },
  { type: "string", enum: ["b", "c", "d"] }
);
// → { type: "string", enum: ["b", "c"] }
// Seules les valeurs communes sont conservées
```

### Exemple — Types incompatibles

```ts
checker.intersect({ type: "string" }, { type: "number" });
// → null (aucune valeur ne peut être à la fois string ET number)
```

---

## `resolveConditions(schema, data)`

```ts
resolveConditions(
  schema: JSONSchema7,
  data: Record<string, unknown>
): ResolvedConditionResult
```

Résout les `if/then/else` d'un schema en évaluant le `if` contre des données partielles (discriminants). Le schema résultant est un schema "aplati" sans `if/then/else`.

```ts
interface ResolvedConditionResult {
  resolved: JSONSchema7;              // Schema avec if/then/else résolus
  branch: "then" | "else" | null;     // Branche appliquée
  discriminant: Record<string, unknown>; // Discriminant utilisé
}
```

```ts
const formSchema = {
  type: "object",
  properties: {
    accountType: { type: "string", enum: ["personal", "business"] },
    email: { type: "string", format: "email" },
    companyName: { type: "string" },
    firstName: { type: "string" },
  },
  required: ["accountType", "email"],
  if: {
    properties: { accountType: { const: "business" } },
    required: ["accountType"],
  },
  then: {
    required: ["companyName"],
  },
  else: {
    required: ["firstName"],
  },
};

// Résoudre pour un compte business
const business = checker.resolveConditions(formSchema, {
  accountType: "business",
});
console.log(business.branch);   // "then"
console.log(business.resolved.required);
// → ["accountType", "email", "companyName"]

// Résoudre pour un compte personnel
const personal = checker.resolveConditions(formSchema, {
  accountType: "personal",
});
console.log(personal.branch);   // "else"
console.log(personal.resolved.required);
// → ["accountType", "email", "firstName"]
```

---

## `check(sub, sup, options)`

```ts
check(
  sub: JSONSchema7Definition,
  sup: JSONSchema7Definition,
  options: CheckRuntimeOptions
): Promise<ResolvedSubsetResult>
```

Runtime-aware subset check. Resolves `if/then/else` conditions in both schemas, narrows schemas using runtime values, performs the static subset check, then optionally validates the data against the resolved schemas via AJV and custom constraints.

```ts
interface CheckRuntimeOptions {
  /** Runtime data used for condition resolution, narrowing, and optionally runtime validation */
  data: unknown;

  /**
   * Controls runtime validation of data against resolved schemas.
   *
   * - `true` — validate against both sub and sup schemas (AJV + constraints)
   * - `false` / omitted — no runtime validation (data used only for condition resolution and narrowing)
   * - `{ sub: true }` — validate only against the sub schema
   * - `{ sup: true }` — validate only against the sup schema
   * - `{ sub: true, sup: true }` — equivalent to `true`
   * - `{ sup: { partial: true } }` — validate sup in partial mode
   *
   * @default false
   */
  validate?: boolean | ValidateTargets;
}

interface ValidateTargets {
  /** When true or an options object, validate data against the resolved sub schema */
  sub?: boolean | ValidateTargetOptions;
  /** When true or an options object, validate data against the resolved sup schema */
  sup?: boolean | ValidateTargetOptions;
}

interface ValidateTargetOptions {
  /** When true, strip required and additionalProperties before AJV validation */
  partial?: boolean;
}

interface ResolvedSubsetResult extends SubsetResult {
  resolvedSub: ResolvedConditionResult;
  resolvedSup: ResolvedConditionResult;
}
```

### What happens when `data` is provided?

The checker executes the following pipeline:

| Step | Description |
|------|-------------|
| 1. **Condition resolution** | `if/then/else` in both `sub` and `sup` are resolved using `data` |
| 2. **Narrowing** | Schemas are narrowed using runtime values (e.g. enum materialization: `{ type: "string" }` + `data = "red"` → `{ type: "string", const: "red" }`) |
| 3. **Static subset check** | The standard merge-based subset check runs on the resolved/narrowed schemas. Static errors surface with higher priority. |
| 4. **Runtime validation** (opt-in) | When `validate` is enabled, `data` is validated against the targeted resolved schema(s) via AJV, then custom constraints are evaluated. |

### `validate` option — controlling runtime validation

By default (`validate` omitted or `false`), `data` is used **only** for condition resolution and narrowing — no AJV validation runs.

When `validate` is enabled, the checker validates `data` against the targeted schema(s):

```ts
// No runtime validation — data used only for condition resolution + narrowing
checker.check(sub, sup, { data: myData });

// Validate against both sub and sup
checker.check(sub, sup, { data: myData, validate: true });

// Validate only the sup schema
checker.check(sub, sup, { data: myData, validate: { sup: true } });

// Validate only the sub schema
checker.check(sub, sup, { data: myData, validate: { sub: true } });
```

### Partial validation mode

When you have **partial data** (e.g. only some properties known at design-time), standard runtime validation fails on missing `required` properties. The `partial` option tells the validator to strip `required` and `additionalProperties` before AJV compilation, so that only the properties **present** in `data` are validated:

```ts
const sup = {
  type: "object",
  properties: {
    accountId: { type: "string", enum: ["salut", "coucou"] },
    meetingId: { type: "string" },
    extraField: { type: "number" },
  },
  required: ["accountId", "meetingId", "extraField"],
};

// ❌ Full mode: fails on missing meetingId and extraField
const result = await checker.check(sup, sup, {
  data: { accountId: "salut" },
  validate: { sup: true },
});
// errors: [{ key: "$sup.meetingId", ... }, { key: "$sup.extraField", ... }]

// ✅ Partial mode: validates only accountId (present in data)
const result = await checker.check(sup, sup, {
  data: { accountId: "salut" },
  validate: { sup: { partial: true } },
});
// errors: [] — accountId is valid, missing properties are ignored

// ✅ Partial mode still catches invalid values on present properties
const result = await checker.check(sup, sup, {
  data: { accountId: "bad_value" },
  validate: { sup: { partial: true } },
});
// errors: [{ key: "$sup.accountId", expected: "salut or coucou", received: "bad_value" }]
```

Partial mode applies **recursively** — nested object schemas also have their `required` and `additionalProperties` stripped. Custom constraint validators already handle partial data correctly (they skip properties not present in data), so constraints are evaluated normally regardless of partial mode.

You can mix partial and full mode across targets:

```ts
// Partial on sup, full on sub
checker.check(sub, sup, {
  data: partialData,
  validate: { sub: true, sup: { partial: true } },
});

// Partial on both
checker.check(sub, sup, {
  data: partialData,
  validate: { sub: { partial: true }, sup: { partial: true } },
});
```

### Example — Resolving conditions with complete data

```ts
const conditionalSup = {
  type: "object",
  properties: {
    kind: { type: "string" },
    value: {},
  },
  required: ["kind", "value"],
  if: {
    properties: { kind: { const: "text" } },
    required: ["kind"],
  },
  then: {
    properties: { value: { type: "string" } },
  },
  else: {
    properties: { value: { type: "number" } },
  },
};

const sub = {
  type: "object",
  properties: {
    kind: { const: "text" },
    value: { type: "string", minLength: 1 },
  },
  required: ["kind", "value"],
};

// Without resolution: false (if/then/else in sup causes merge mismatch)
console.log(checker.isSubset(sub, conditionalSup)); // false

// With runtime data: true! Data resolves conditions.
const result = await checker.check(sub, conditionalSup, {
  data: { kind: "text", value: "hello" },
});
console.log(result.isSubset);          // true ✅
console.log(result.resolvedSup.branch); // "then"
```

### Example — Incomplete data triggers runtime validation failure

```ts
// Data is missing `value` — both schemas require it.
// With validate: true, runtime validation catches the missing field → isSubset: false
const result = await checker.check(sub, conditionalSup, {
  data: { kind: "text" },
  validate: true,
});
console.log(result.isSubset);  // false
console.log(result.errors);    // [{ key: "$sub.value", expected: "...", received: "undefined" }, ...]

// With partial mode, missing `value` would NOT cause an error:
const partialResult = await checker.check(sub, conditionalSup, {
  data: { kind: "text" },
  validate: { sub: { partial: true }, sup: { partial: true } },
});
console.log(partialResult.isSubset);  // true ✅
```

### Example — Business form with conditional required fields

```ts
const formSchema = {
  type: "object",
  properties: {
    accountType: { type: "string", enum: ["personal", "business"] },
    email: { type: "string", format: "email" },
    companyName: { type: "string" },
    taxId: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
  },
  required: ["accountType", "email"],
  if: {
    properties: { accountType: { const: "business" } },
    required: ["accountType"],
  },
  then: { required: ["companyName", "taxId"] },
  else: { required: ["firstName", "lastName"] },
};

const businessOutput = {
  type: "object",
  properties: {
    accountType: { const: "business", type: "string", enum: ["personal", "business"] },
    email: { type: "string", format: "email" },
    companyName: { type: "string", minLength: 1 },
    taxId: { type: "string", minLength: 1 },
  },
  required: ["accountType", "email", "companyName", "taxId"],
  additionalProperties: false,
};

// Complete business instance validates against both schemas
const result = await checker.check(businessOutput, formSchema, {
  data: {
    accountType: "business",
    email: "ceo@acme.com",
    companyName: "ACME Corp",
    taxId: "123-456-789",
  },
  validate: true,
});
console.log(result.isSubset); // true ✅
```

### Example — Primitive data with format validation

```ts
const schema = { type: "string", format: "email" };

// Valid email → isSubset: true (A ⊆ A with valid data)
const r1 = await checker.check(schema, schema, { data: "test@example.com", validate: true });
console.log(r1.isSubset); // true

// Invalid email → isSubset: false (runtime validation fails)
const r2 = await checker.check(schema, schema, { data: "not-an-email", validate: true });
console.log(r2.isSubset); // false
console.log(r2.errors);   // [{ key: "$sub", expected: "format: email", received: "not-an-email" }, ...]
```

### Static vs Runtime — summary

```ts
// Static mode — no runtime data, purely structural
checker.check(sub, sup);

// Runtime mode — condition resolution + narrowing only (no AJV validation)
checker.check(sub, sup, { data: concreteInstance });

// Runtime mode — full pipeline including AJV + constraint validation
checker.check(sub, sup, { data: concreteInstance, validate: true });

// Runtime mode — validate only sup in partial mode
checker.check(sub, sup, { data: partialData, validate: { sup: { partial: true } } });
```

---

## `normalize(schema)`

```ts
normalize(def: JSONSchema7Definition): JSONSchema7Definition
```

Normalise un schema : infère `type` depuis `const`/`enum`, résout la double négation `not(not(X)) → X`, et normalise récursivement tous les sous-schemas.

```ts
// Infère le type depuis const
checker.normalize({ const: "hello" });
// → { const: "hello", type: "string" }

// Infère le type depuis enum
checker.normalize({ enum: [1, 2, 3] });
// → { enum: [1, 2, 3], type: "integer" }

// Convertit enum à un seul élément en const
checker.normalize({ enum: ["only"] });
// → { const: "only", type: "string" }

// Résout la double négation
checker.normalize({ not: { not: { type: "string" } } });
// → { type: "string" }
```

---

## `formatResult(label, result)`

```ts
formatResult(label: string, result: SubsetResult): string
```

Formate un `SubsetResult` en chaîne lisible pour les logs / le debug.

```ts
const result = checker.check(
  { type: "number", minimum: 0, maximum: 100 },
  { type: "number", minimum: 5, maximum: 10 }
);

console.log(checker.formatResult("range check", result));
// ❌ range check: false
//    Errors:
//      ✗ $root: expected minimum 5, received minimum 0
```

```ts
const result2 = checker.check(
  { type: "string", minLength: 5 },
  { type: "string" }
);

console.log(checker.formatResult("strict ⊆ loose", result2));
// ✅ strict ⊆ loose: true
```

Format de sortie :
- `✅` — le check a réussi (`isSubset: true`)
- `❌` — le check a échoué (`isSubset: false`), suivi de la liste des erreurs
- `✗ key: expected X, received Y` — détail de chaque erreur sémantique

---

# `MergeEngine`

Opérations bas-niveau sur les schemas : **intersection** (`allOf` merge) et **overlay** (deep spread séquentiel).

```ts
import { MergeEngine } from "json-schema-compatibility-checker";

const engine = new MergeEngine();
```

`MergeEngine` expose deux opérations de combinaison de schemas aux sémantiques fondamentalement différentes :

| | `merge` / `mergeOrThrow` | `overlay` |
|---|---|---|
| **Sémantique** | `allOf(A, B)` — **intersection** ensembliste | `{ ...base, ...override }` — **deep spread** |
| **Commutative ?** | ✅ Oui — `merge(A, B) ≡ merge(B, A)` | ❌ Non — l'ordre compte (last writer wins) |
| **Conflit de propriétés** | Garde la contrainte la plus **restrictive** | Garde le **dernier écrivain** |
| **Objets imbriqués** | Intersectés récursivement (`allOf`) | Deep-spread récursivement (`overlay`) |
| **Cas d'usage** | Subset checking (`A ⊆ B ⟺ A ∩ B ≡ A`), convergence de branches parallèles | Accumulation de contexte dans un pipeline séquentiel |

---

## `merge(a, b)`

```ts
merge(
  a: JSONSchema7Definition,
  b: JSONSchema7Definition
): JSONSchema7Definition | null
```

Calcule l'**intersection** de deux schemas via `allOf([a, b])`. Retourne `null` si les schemas sont incompatibles.

Effectue des pré-checks avant le merge :
- Conflits de `const` / `enum` (profond)
- Conflits de `format` (hiérarchie)
- Conflits `additionalProperties` vs propriétés requises

```ts
// Intersection de contraintes numériques
engine.merge(
  { type: "number", minimum: 5 },
  { type: "number", maximum: 10 }
);
// → { type: "number", minimum: 5, maximum: 10 }

// Intersection d'enums
engine.merge(
  { type: "string", enum: ["a", "b", "c"] },
  { type: "string", enum: ["b", "c", "d"] }
);
// → { type: "string", enum: ["b", "c"] }

// Types incompatibles → null
engine.merge({ type: "string" }, { type: "number" });
// → null
```

### Propriétés d'objets

Le merge combine les propriétés des deux schemas (union des clés) et intersecte les propriétés communes :

```ts
engine.merge(
  {
    type: "object",
    properties: { a: { type: "string" } },
    required: ["a"],
  },
  {
    type: "object",
    properties: { b: { type: "number" } },
    required: ["b"],
  }
);
// → {
//     type: "object",
//     properties: { a: { type: "string" }, b: { type: "number" } },
//     required: ["a", "b"]
//   }
```

### Conflits détectés

```ts
// const vs const incompatibles
engine.merge({ const: "hello" }, { const: "world" });
// → null

// const pas dans l'enum
engine.merge({ const: "x" }, { enum: ["a", "b", "c"] });
// → null

// Formats incompatibles
engine.merge(
  { type: "string", format: "email" },
  { type: "string", format: "ipv4" }
);
// → null
```

---

## `mergeOrThrow(a, b)`

```ts
mergeOrThrow(
  a: JSONSchema7Definition,
  b: JSONSchema7Definition
): JSONSchema7Definition
```

Identique à `merge`, mais **lève une exception** au lieu de retourner `null` en cas d'incompatibilité. Utile quand on veut capturer l'erreur pour le diagnostic.

```ts
try {
  const result = engine.mergeOrThrow(
    { const: "hello" },
    { const: "world" }
  );
} catch (e) {
  console.log(e.message);
  // "Incompatible const values: schemas have conflicting const constraints"
}
```

Les messages d'erreur possibles :
- `"Incompatible const values: schemas have conflicting const constraints"`
- `"Incompatible format values: schemas have conflicting format constraints"`
- `"Incompatible additionalProperties: required properties conflict with additionalProperties constraint"`

---

## `overlay(base, override)`

```ts
overlay(
  base: JSONSchema7Definition,
  override: JSONSchema7Definition
): JSONSchema7Definition
```

Calcule un **deep spread** de schemas : les propriétés de `override` **remplacent** celles de même nom dans `base` (last-writer-wins). Quand les deux définissent la même propriété comme schema d'objet, `overlay` **recurse** pour deep-spreader les sous-propriétés.

C'est l'opération correcte pour l'**accumulation de contexte dans un pipeline séquentiel** où chaque nœud écrase les clés qu'il produit :

```ts
// Sémantique runtime :
context = deepSpread(context, node.output)
```

### ⚠️ Différence fondamentale avec `merge`

`merge` (intersection) est **commutative** et garde la contrainte la plus restrictive.
`overlay` est **non-commutative** et garde le dernier écrivain.

```ts
const schemaA = {
  type: "object",
  properties: { value: { type: "string", enum: ["x", "y"] } },
};
const schemaB = {
  type: "object",
  properties: { value: { type: "string" } },
};

// merge : garde l'enum (plus restrictif)
engine.merge(schemaA, schemaB);
// → { ..., properties: { value: { type: "string", enum: ["x", "y"] } } }

// overlay : le dernier (schemaB) gagne → pas d'enum
engine.overlay(schemaA, schemaB);
// → { ..., properties: { value: { type: "string" } } }

// overlay est non-commutative :
engine.overlay(schemaB, schemaA);
// → { ..., properties: { value: { type: "string", enum: ["x", "y"] } } }
```

### Comportement par mot-clé

| Mot-clé | Comportement |
|---|---|
| `properties` | **Deep spread** — recurse si les deux côtés sont des objets, sinon override remplace. Les propriétés base-only sont conservées. |
| `required` | **Union** des deux tableaux (dédupliquée) |
| `additionalProperties` | Override wins si présent, sinon base conservé |
| `minProperties`, `maxProperties` | Override wins si présent |
| `propertyNames` | Override wins si présent |
| `patternProperties` | Override wins si présent |
| `dependencies` | Override wins si présent |
| `type` | Override wins si explicitement défini |

### Exemple — Spread plat (propriétés de premier niveau)

```ts
const base = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    status: { type: "string", enum: ["active", "inactive"] },
  },
  required: ["name", "status"],
};

const override = {
  type: "object",
  properties: {
    status: { type: "string" },           // élargit (supprime l'enum)
    email: { type: "string", format: "email" }, // ajoute une nouvelle propriété
  },
  required: ["status", "email"],
};

engine.overlay(base, override);
// → {
//     type: "object",
//     properties: {
//       name: { type: "string", minLength: 1 },  ← conservé de base
//       status: { type: "string" },                ← override gagne
//       email: { type: "string", format: "email" },← ajouté par override
//     },
//     required: ["name", "status", "email"],       ← union
//   }
```

### Exemple — Deep spread (objets imbriqués)

Quand les deux schemas définissent la même propriété comme objet, `overlay` recurse :

```ts
const base = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: {
        host: { type: "string" },
        port: { type: "integer" },
      },
      required: ["host", "port"],
    },
  },
};

const override = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: {
        host: { type: "string", format: "hostname" }, // affine le type
        // port absent → conservé de base via deep spread
      },
    },
  },
};

engine.overlay(base, override);
// → {
//     type: "object",
//     properties: {
//       config: {
//         type: "object",
//         properties: {
//           host: { type: "string", format: "hostname" },  ← override gagne
//           port: { type: "integer" },                      ← conservé de base
//         },
//         required: ["host", "port"],                       ← union
//       },
//     },
//   }
```

### Exemple — Pipeline séquentiel avec `reduce`

```ts
const node1 = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: { createdBy: { type: "string" } },
      required: ["createdBy"],
    },
  },
  required: ["metadata"],
};

const node2 = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: { updatedAt: { type: "string", format: "date-time" } },
      required: ["updatedAt"],
    },
  },
};

const node3 = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: { createdBy: { type: "string", enum: ["system"] } },
    },
    status: { type: "string" },
  },
  required: ["status"],
};

// Accumulation séquentielle :
const context = [node1, node2, node3].reduce((acc, output) =>
  engine.overlay(acc, output)
);
// → {
//     metadata: {
//       createdBy: { type: "string", enum: ["system"] },  ← restreint par node3
//       updatedAt: { type: "string", format: "date-time" },← ajouté par node2
//     },
//     status: { type: "string" },                          ← ajouté par node3
//     required: ["metadata", "status"],
//   }
```

### Schemas non-objet

Si l'un des schemas n'est pas un objet (pas de `properties`, pas `type: "object"`), l'override remplace entièrement :

```ts
// string → integer : override remplace
engine.overlay({ type: "string" }, { type: "integer", minimum: 0 });
// → { type: "integer", minimum: 0 }

// objet → string : override remplace
engine.overlay(
  { type: "object", properties: { a: { type: "string" } } },
  { type: "string" }
);
// → { type: "string" }
```

### Schemas booléens

```ts
engine.overlay(base, false);  // → false (rien n'est valide)
engine.overlay(base, true);   // → true (tout est valide)
engine.overlay(false, schema); // → schema (override gagne)
engine.overlay(true, schema);  // → schema (override gagne)
```

---

## `compare(a, b)`

```ts
compare(
  a: JSONSchema7Definition,
  b: JSONSchema7Definition
): number
```

Comparaison structurelle de deux schema definitions. Retourne `0` si identiques, un entier non-nul sinon.

```ts
engine.compare({ type: "string" }, { type: "string" }); // 0
engine.compare({ type: "string" }, { type: "number" }); // non-zéro
```

---

## `isEqual(a, b)` {#isequala-b-1}

```ts
isEqual(
  a: JSONSchema7Definition,
  b: JSONSchema7Definition
): boolean
```

Vérifie l'**égalité structurelle** entre deux schema definitions. Wrapper typé autour de `compare`.

```ts
engine.isEqual({ type: "string" }, { type: "string" }); // true
engine.isEqual({ type: "string" }, { type: "number" }); // false
```
