# API Reference

Toutes les méthodes sont exposées par la classe `JsonSchemaCompatibilityChecker`.

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
check(sub: JSONSchema7Definition, sup: JSONSchema7Definition, options: CheckConditionsOptions): ResolvedSubsetResult
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
  options: CheckConditionsOptions
): ResolvedSubsetResult
```

Résout les conditions `if/then/else` des deux schemas **puis** vérifie `sub ⊆ sup`. Utile quand le superset contient des `if/then/else` et que vous connaissez les valeurs discriminantes. Effectue aussi un **narrowing** du sub par rapport aux contraintes `enum`/`const` du sup en utilisant les données runtime.

```ts
interface CheckConditionsOptions {
  /** Runtime data for the sub schema — used for condition resolution and enum narrowing */
  subData: unknown;
  /** Runtime data for the sup schema (defaults to subData) — used for condition resolution and enum narrowing */
  supData?: unknown;
}

interface ResolvedSubsetResult extends SubsetResult {
  resolvedSub: ResolvedConditionResult;
  resolvedSup: ResolvedConditionResult;
}
```

### `subData` vs `supData` — quelle différence ?

Chaque schema (`sub` et `sup`) peut contenir ses propres conditions `if/then/else`. Pour résoudre ces conditions, le checker a besoin de **données runtime** — des valeurs concrètes qui déterminent quelle branche (`then` ou `else`) s'applique.

| Paramètre | Schema associé | Rôle | Obligatoire ? |
|-----------|---------------|------|--------------|
| `subData` | `sub` (candidat subset) | Évalue le `if` du schema `sub` pour choisir sa branche `then`/`else` | ✅ Oui |
| `supData` | `sup` (superset cible) | Évalue le `if` du schema `sup` pour choisir sa branche `then`/`else` | ❌ Non (défaut = `subData`) |

**Par défaut, `supData` prend la valeur de `subData`.** C'est le cas d'usage le plus courant : on vérifie la compatibilité de deux schemas pour **la même donnée** (ex. : "est-ce que cette donnée qui valide `sub` valide aussi `sup` ?").

**On utilise `supData` séparément** quand les deux schemas décrivent des **contextes différents** avec des données runtime distinctes — par exemple, un système de commandes où l'entrée et la sortie sont résolues à partir de canaux différents.

### Exemple — Résolution simple (même données pour les deux)

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

// Sans résolution : false (le if/then/else brut ne matche pas)
console.log(checker.isSubset(sub, conditionalSup)); // false

// Avec résolution via options : true !
// subData est utilisé pour résoudre les conditions des DEUX schemas (supData absent → défaut)
const result = checker.check(sub, conditionalSup, { subData: { kind: "text" } });
console.log(result.isSubset);          // true ✅
console.log(result.resolvedSup.branch); // "then"
```

### Exemple — `subData` ≠ `supData` (données différentes par schema)

Imaginons un système de commandes. Les deux schemas (`inputSchema` et `orderSchema`) ont le même `if/then/else` sur le champ `channel`, mais ils décrivent des contextes distincts :

```ts
// Schema de commande : accepte "card"/"paypal" pour le web, "card"/"cash" en magasin
const orderSchema = {
  type: "object",
  properties: {
    channel: { type: "string", enum: ["web", "pos"] },
    payment: { type: "string" },
  },
  required: ["channel", "payment"],
  if: {
    properties: { channel: { const: "web" } },
    required: ["channel"],
  },
  then: {
    properties: { payment: { type: "string", enum: ["card", "paypal"] } },
  },
  else: {
    properties: { payment: { type: "string", enum: ["card", "cash"] } },
  },
};

// Schema d'entrée : plus restrictif, "card" uniquement pour le web, "cash" uniquement en magasin
const inputSchema = {
  type: "object",
  properties: {
    channel: { type: "string", enum: ["web", "pos"] },
    payment: { type: "string" },
  },
  required: ["channel", "payment"],
  if: {
    properties: { channel: { const: "web" } },
    required: ["channel"],
  },
  then: {
    properties: { payment: { type: "string", enum: ["card"] } },
  },
  else: {
    properties: { payment: { type: "string", enum: ["cash"] } },
  },
};
```

**Cas 1 — Même données** : l'entrée et la commande sont résolues pour le même canal.

```ts
// sub=web, sup=web → input.then ⊆ order.then → ["card"] ⊆ ["card", "paypal"] ✅
const r1 = checker.check(inputSchema, orderSchema, { subData: { channel: "web" } });
console.log(r1.isSubset);              // true
console.log(r1.resolvedSub.branch);    // "then"
console.log(r1.resolvedSup.branch);    // "then"
```

**Cas 2 — Données différentes** : l'entrée est résolue "web" mais la commande est résolue "pos".

```ts
// sub=web, sup=pos → input.then ⊆ order.else → ["card"] ⊆ ["card", "cash"] ✅
const r2 = checker.check(inputSchema, orderSchema, {
  subData: { channel: "web" },
  supData: { channel: "pos" },
});
console.log(r2.isSubset);              // true
console.log(r2.resolvedSub.branch);    // "then"  (résolu avec subData)
console.log(r2.resolvedSup.branch);    // "else"  (résolu avec supData)
```

**Cas 3 — Données différentes qui causent une incompatibilité** :

```ts
// sub=pos, sup=web → input.else ⊆ order.then → ["cash"] ⊆ ["card", "paypal"] ❌
const r3 = checker.check(inputSchema, orderSchema, {
  subData: { channel: "pos" },
  supData: { channel: "web" },
});
console.log(r3.isSubset);              // false
console.log(r3.resolvedSub.branch);    // "else"  (résolu avec subData → cash)
console.log(r3.resolvedSup.branch);    // "then"  (résolu avec supData → card/paypal)
// "cash" n'est pas dans ["card", "paypal"] → incompatible
```

> **En résumé** : `subData` résout les conditions de `sub`, `supData` résout celles de `sup`. Si vos deux schemas vivent dans le même contexte, omettez `supData` — il prendra automatiquement la valeur de `subData`. Utilisez `supData` uniquement quand les schemas décrivent des contextes runtime distincts.

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