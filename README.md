# JSON Schema Compatibility Checker

> Vérifiez la compatibilité structurelle entre JSON Schemas (Draft-07) grâce à une approche mathématique par intersection ensembliste.

---

## Sommaire

- [Introduction](#introduction)
- [Principe mathématique](#principe-mathématique)
- [Installation](#installation)
- [Démarrage rapide](#démarrage-rapide)
- [API Reference](#api-reference)
  - [`isSubset(sub, sup)`](#issubsetsub-sup)
  - [`check(sub, sup)`](#checksub-sup)
  - [`isEqual(a, b)`](#isequala-b)
  - [`intersect(a, b)`](#intersecta-b)
  - [`canConnect(sourceOutput, targetInput)`](#canconnectsourceoutput-targetinput)
  - [`resolveConditions(schema, data)`](#resolveconditionsschema-data)
  - [`checkResolved(sub, sup, subData, supData?)`](#checkresolvedsub-sup-subdata-supdata)
  - [`normalize(schema)`](#normalizeschema)
  - [`formatResult(label, result)`](#formatresultlabel-result)
- [Guide des fonctionnalités](#guide-des-fonctionnalités)
  - [1. Compatibilité de types](#1-compatibilité-de-types)
  - [2. Champs requis (`required`)](#2-champs-requis-required)
  - [3. Contraintes numériques](#3-contraintes-numériques)
  - [4. Contraintes de chaînes](#4-contraintes-de-chaînes)
  - [5. `enum` et `const`](#5-enum-et-const)
  - [6. Contraintes de tableaux](#6-contraintes-de-tableaux)
  - [7. `additionalProperties`](#7-additionalproperties)
  - [8. Objets imbriqués](#8-objets-imbriqués)
  - [9. `anyOf` / `oneOf`](#9-anyof--oneof)
  - [10. Négation (`not`)](#10-négation-not)
  - [11. Formats (`format`)](#11-formats-format)
  - [12. Patterns regex (`pattern`)](#12-patterns-regex-pattern)
  - [13. Conditions `if` / `then` / `else`](#13-conditions-if--then--else)
  - [14. `allOf` avec conditions](#14-allof-avec-conditions)
- [Fonctions utilitaires](#fonctions-utilitaires)
  - [`isPatternSubset(sub, sup)`](#ispatternsubsetsub-sup)
  - [`arePatternsEquivalent(a, b)`](#arepatternsEquivalenta-b)
  - [`isTrivialPattern(pattern)`](#istrivialpatternpattern)
- [Cas d'usage concrets](#cas-dusage-concrets)
  - [Connexion de nœuds dans un orchestrateur](#connexion-de-nœuds-dans-un-orchestrateur)
  - [Validation de réponse API](#validation-de-réponse-api)
  - [Union discriminée](#union-discriminée)
  - [Formulaire conditionnel](#formulaire-conditionnel)
- [Types exportés](#types-exportés)
- [Limitations connues](#limitations-connues)
- [Architecture interne](#architecture-interne)

---

## Introduction

**JSON Schema Compatibility Checker** est une librairie TypeScript qui permet de vérifier la compatibilité structurelle entre deux JSON Schemas au format Draft-07.

### Pourquoi cette librairie ?

Dans les systèmes de type workflow, orchestration de nœuds, ou intégration d'API, une question revient constamment :

> *"Est-ce que la sortie du composant A est compatible avec l'entrée du composant B ?"*

Autrement dit : **toute donnée produite par A sera-t-elle acceptée par B ?**

Cette librairie répond à cette question en vérifiant si un schema est un **sous-ensemble** d'un autre, avec un diagnostic structurel détaillé en cas d'incompatibilité.

### Ce que fait la librairie

- ✅ Vérifie si un schema est un sous-ensemble d'un autre (`sub ⊆ sup`)
- ✅ Produit un diagnostic détaillé avec les différences structurelles
- ✅ Calcule l'intersection de deux schemas
- ✅ Résout les conditions `if/then/else` avec des données discriminantes
- ✅ Gère `anyOf`, `oneOf`, `not`, `format`, `pattern`, `dependencies`, etc.
- ✅ Compare des patterns regex par échantillonnage
- ✅ Fournit un formatage lisible des résultats pour le debug

---

## Principe mathématique

Le cœur de la librairie repose sur un principe ensembliste simple :

```
A ⊆ B  ⟺  A ∩ B ≡ A
```

**Un schema A est sous-ensemble de B si et seulement si l'intersection de A et B est structurellement identique à A.**

En JSON Schema, cela se traduit par :

| Concept mathématique | Traduction JSON Schema |
|---|---|
| `A ∩ B` | `allOf([A, B])` résolu via merge |
| `≡` (équivalence) | Comparaison structurelle profonde |

Si après le merge (intersection), le résultat est identique au schema original `A`, alors `A` n'a pas été "restreint" par `B` — ce qui signifie que `A` est déjà inclus dans `B`.

Si le merge produit un résultat différent de `A`, les différences structurelles constituent le **diagnostic** de l'incompatibilité.

---

## Installation

```bash
bun add json-schema-compatibility-checker
```

> **Prérequis** : TypeScript ≥ 5, runtime compatible ESM (Bun, Node 18+).

---

## Démarrage rapide

L'exemple le plus simple : vérifier si un schema strict est compatible avec un schema plus permissif.

```ts
import { JsonSchemaCompatibilityChecker } from "json-schema-compatibility-checker";

const checker = new JsonSchemaCompatibilityChecker();

// Schema strict : exige name ET age
const strict = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

// Schema permissif : exige seulement name
const loose = {
  type: "object",
  properties: {
    name: { type: "string" },
  },
  required: ["name"],
};

// Un objet valide pour strict est-il toujours valide pour loose ?
console.log(checker.isSubset(strict, loose)); // true ✅

// L'inverse est-il vrai ?
console.log(checker.isSubset(loose, strict)); // false ❌
// → Un objet { name: "Alice" } (sans age) est valide pour loose mais pas pour strict
```

---

## API Reference

Toutes les méthodes sont exposées par la classe `JsonSchemaCompatibilityChecker`.

```ts
import { JsonSchemaCompatibilityChecker } from "json-schema-compatibility-checker";

const checker = new JsonSchemaCompatibilityChecker();
```

---

### `isSubset(sub, sup)`

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

#### Schemas booléens

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

### `check(sub, sup)`

```ts
check(sub: JSONSchema7Definition, sup: JSONSchema7Definition): SubsetResult
```

Comme `isSubset`, mais retourne un **résultat détaillé** avec les différences structurelles.

```ts
interface SubsetResult {
  isSubset: boolean;
  merged: JSONSchema7Definition | null;  // Résultat de l'intersection
  diffs: SchemaDiff[];                    // Différences structurelles
}

interface SchemaDiff {
  path: string;           // Chemin JSON-path vers la divergence
  type: "added" | "removed" | "changed";
  expected: unknown;      // Valeur dans le schema original (sub)
  actual: unknown;        // Valeur dans le schema mergé
}
```

#### Exemple — Check compatible

```ts
const result = checker.check(
  { type: "string", minLength: 5 },
  { type: "string" }
);

console.log(result.isSubset); // true
console.log(result.diffs);    // [] (aucune différence)
console.log(result.merged);   // { type: "string", minLength: 5 }
```

#### Exemple — Check incompatible avec diagnostic

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

console.log(result.isSubset); // false
console.log(result.diffs);
// [
//   { path: "required", type: "changed", expected: ["name"], actual: ["name", "age"] },
//   { path: "properties.age", type: "added", expected: undefined, actual: { type: "number" } }
// ]
```

#### Exemple — Types incompatibles

```ts
const result = checker.check({ type: "string" }, { type: "number" });

console.log(result.isSubset); // false
console.log(result.merged);   // null (intersection impossible)
console.log(result.diffs);    // [{ path: "$", type: "changed", expected: ..., actual: "Incompatible..." }]
```

---

### `isEqual(a, b)`

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

### `intersect(a, b)`

```ts
intersect(
  a: JSONSchema7Definition,
  b: JSONSchema7Definition
): JSONSchema7Definition | null
```

Calcule l'**intersection** de deux schemas (merge `allOf`). Retourne `null` si les schemas sont incompatibles.

#### Exemple — Intersection de contraintes numériques

```ts
const result = checker.intersect(
  { type: "number", minimum: 5, maximum: 10 },
  { type: "number", minimum: 0, maximum: 100 }
);
// → { type: "number", minimum: 5, maximum: 10 }
// L'intersection conserve les contraintes les plus restrictives
```

#### Exemple — Intersection de propriétés d'objets

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

#### Exemple — Intersection d'enums

```ts
const result = checker.intersect(
  { type: "string", enum: ["a", "b", "c"] },
  { type: "string", enum: ["b", "c", "d"] }
);
// → { type: "string", enum: ["b", "c"] }
// Seules les valeurs communes sont conservées
```

#### Exemple — Types incompatibles

```ts
checker.intersect({ type: "string" }, { type: "number" });
// → null (aucune valeur ne peut être à la fois string ET number)
```

---

### `canConnect(sourceOutput, targetInput)`

```ts
canConnect(
  sourceOutput: JSONSchema7Definition,
  targetInput: JSONSchema7Definition
): ConnectionResult
```

Vérifie si la **sortie d'un nœud source** peut alimenter l'**entrée d'un nœud cible**. Sémantiquement : `sourceOutput ⊆ targetInput`.

```ts
interface ConnectionResult extends SubsetResult {
  direction: string; // "sourceOutput ⊆ targetInput"
}
```

```ts
const nodeAOutput = {
  type: "object",
  properties: {
    id: { type: "string" },
    total: { type: "number", minimum: 0 },
    customer: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        name: { type: "string" },
      },
      required: ["email", "name"],
    },
  },
  required: ["id", "total", "customer"],
};

const nodeBInput = {
  type: "object",
  properties: {
    id: { type: "string" },
    total: { type: "number" },
    customer: {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  },
  required: ["id", "total", "customer"],
};

const result = checker.canConnect(nodeAOutput, nodeBInput);

console.log(result.isSubset);  // true ✅
console.log(result.direction); // "sourceOutput ⊆ targetInput"
console.log(result.diffs);     // []
```

---

### `resolveConditions(schema, data)`

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

### `checkResolved(sub, sup, subData, supData?)`

```ts
checkResolved(
  sub: JSONSchema7,
  sup: JSONSchema7,
  subData: Record<string, unknown>,
  supData?: Record<string, unknown>
): SubsetResult & {
  resolvedSub: ResolvedConditionResult;
  resolvedSup: ResolvedConditionResult;
}
```

Raccourci : résout les conditions des deux schemas **puis** vérifie `sub ⊆ sup`. Utile quand le superset contient des `if/then/else` et que vous connaissez les valeurs discriminantes.

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

// Avec résolution : true !
const result = checker.checkResolved(sub, conditionalSup, { kind: "text" });
console.log(result.isSubset);          // true ✅
console.log(result.resolvedSup.branch); // "then"
```

---

### `normalize(schema)`

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

### `formatResult(label, result)`

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
//    Diffs:
//      ~ minimum: 0 → 5
//      ~ maximum: 100 → 10
```

```ts
const result2 = checker.check(
  { type: "string", minLength: 5 },
  { type: "string" }
);

console.log(checker.formatResult("strict ⊆ loose", result2));
// ✅ strict ⊆ loose: true
```

Les différentes icônes dans le diff :
- `+` — contrainte **ajoutée** par le merge (absente dans sub, présente dans l'intersection)
- `-` — contrainte **supprimée** par le merge
- `~` — contrainte **modifiée** (valeur différente entre sub et l'intersection)

---

## Guide des fonctionnalités

Cette section présente les fonctionnalités supportées, du plus simple au plus complexe, avec des exemples illustratifs.

---

### 1. Compatibilité de types

La librairie comprend le système de types JSON Schema et ses relations d'inclusion.

```ts
// integer ⊆ number (tout entier est un nombre)
checker.isSubset({ type: "integer" }, { type: "number" }); // true

// number ⊄ integer (1.5 est un nombre mais pas un entier)
checker.isSubset({ type: "number" }, { type: "integer" }); // false

// Types incompatibles
checker.isSubset({ type: "string" }, { type: "number" }); // false
checker.isSubset({ type: "boolean" }, { type: "string" }); // false

// Identité
checker.isSubset({ type: "string" }, { type: "string" }); // true

// L'intersection integer ∩ number = integer
checker.intersect({ type: "integer" }, { type: "number" });
// → { type: "integer" }
```

---

### 2. Champs requis (`required`)

Un schema qui exige **plus** de champs est un sous-ensemble d'un schema qui en exige **moins**.

```ts
const strict = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
};

const loose = {
  type: "object",
  properties: {
    name: { type: "string" },
  },
  required: ["name"],
};

// Plus de champs requis → plus restrictif → sous-ensemble
checker.isSubset(strict, loose); // true

// Moins de champs requis → plus permissif → PAS sous-ensemble
checker.isSubset(loose, strict); // false

// Le diagnostic montre exactement ce qui manque
const result = checker.check(loose, strict);
console.log(result.diffs);
// [
//   { path: "required", type: "changed", expected: ["name"], actual: ["name", "age"] },
//   { path: "properties.age", type: "added", expected: undefined, actual: { type: "number" } }
// ]
```

---

### 3. Contraintes numériques

La librairie gère `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` et `multipleOf`.

```ts
// Plage stricte ⊆ plage large
checker.isSubset(
  { type: "number", minimum: 5, maximum: 10 },
  { type: "number", minimum: 0, maximum: 100 }
); // true

// Plage large ⊄ plage stricte
checker.isSubset(
  { type: "number", minimum: 0, maximum: 100 },
  { type: "number", minimum: 5, maximum: 10 }
); // false

// exclusiveMinimum
checker.isSubset(
  { type: "number", exclusiveMinimum: 5 },
  { type: "number", exclusiveMinimum: 0 }
); // true (x > 5 implique x > 0)

// multipleOf : 6 est multiple de 3
checker.isSubset(
  { type: "number", multipleOf: 6 },
  { type: "number", multipleOf: 3 }
); // true

// multipleOf : 3 n'est PAS multiple de 6
checker.isSubset(
  { type: "number", multipleOf: 3 },
  { type: "number", multipleOf: 6 }
); // false

// L'intersection conserve les contraintes les plus restrictives
checker.intersect(
  { type: "number", minimum: 5, maximum: 10 },
  { type: "number", minimum: 0, maximum: 100 }
);
// → { type: "number", minimum: 5, maximum: 10 }
```

---

### 4. Contraintes de chaînes

Gestion de `minLength`, `maxLength` et `pattern`.

```ts
const strict = {
  type: "string",
  minLength: 3,
  maxLength: 10,
  pattern: "^[a-z]+$",
};

const loose = {
  type: "string",
  minLength: 1,
  maxLength: 100,
};

// Plus de contraintes → sous-ensemble
checker.isSubset(strict, loose); // true

// Moins de contraintes → PAS sous-ensemble
checker.isSubset(loose, strict); // false
```

Pour les patterns regex, voir la section [12. Patterns regex](#12-patterns-regex-pattern).

---

### 5. `enum` et `const`

#### Enum

```ts
// Petit enum ⊆ grand enum (toutes les valeurs du petit sont dans le grand)
checker.isSubset(
  { type: "string", enum: ["a", "b"] },
  { type: "string", enum: ["a", "b", "c", "d"] }
); // true

// Grand enum ⊄ petit enum
checker.isSubset(
  { type: "string", enum: ["a", "b", "c", "d"] },
  { type: "string", enum: ["a", "b"] }
); // false

// Enum d'une seule valeur ⊆ type
checker.isSubset(
  { type: "string", enum: ["hello"] },
  { type: "string" }
); // true

// Intersection d'enums = valeurs communes
checker.intersect(
  { type: "string", enum: ["a", "b", "c"] },
  { type: "string", enum: ["b", "c", "d"] }
);
// → { type: "string", enum: ["b", "c"] }
```

#### Const

```ts
// const string ⊆ type string
checker.isSubset({ const: "hello" }, { type: "string" }); // true

// const number ⊆ type number
checker.isSubset({ const: 42 }, { type: "number" }); // true

// const string ⊄ type number (types incompatibles)
checker.isSubset({ const: "hello" }, { type: "number" }); // false
```

> **Normalisation** : un `enum` à un seul élément est automatiquement converti en `const` lors de la normalisation. `{ enum: ["x"] }` ≡ `{ const: "x" }`.

---

### 6. Contraintes de tableaux

Gestion de `items`, `minItems`, `maxItems`, `uniqueItems`.

```ts
const strict = {
  type: "array",
  items: { type: "string", minLength: 1 },
  minItems: 1,
  maxItems: 5,
};

const loose = {
  type: "array",
  items: { type: "string" },
};

// Tableau plus contraint ⊆ tableau moins contraint
checker.isSubset(strict, loose); // true

// L'inverse est faux
checker.isSubset(loose, strict); // false

// uniqueItems: true est plus restrictif que sans uniqueItems
checker.isSubset(
  { type: "array", items: { type: "number" }, uniqueItems: true },
  { type: "array", items: { type: "number" } }
); // true
```

---

### 7. `additionalProperties`

`additionalProperties: false` ferme un objet : seules les propriétés listées dans `properties` sont autorisées.

```ts
const closed = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

const open = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name"],
};

// Fermé ⊆ ouvert (un objet sans propriétés supplémentaires est valide partout)
checker.isSubset(closed, open); // true

// Ouvert ⊄ fermé (un objet avec age serait rejeté par closed)
checker.isSubset(open, closed); // false

// Le diagnostic montre la contrainte
const result = checker.check(open, closed);
const addPropDiff = result.diffs.find(d => d.path === "additionalProperties");
console.log(addPropDiff); // { path: "additionalProperties", type: "added", ... }
```

---

### 8. Objets imbriqués

La vérification de sous-ensemble est **récursive** : elle descend dans toutes les propriétés imbriquées.

```ts
const deep = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: {
            name: { type: "string" },
            bio: { type: "string" },
          },
          required: ["name", "bio"],
        },
      },
      required: ["profile"],
    },
  },
  required: ["user"],
};

const shallow = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      required: ["profile"],
    },
  },
  required: ["user"],
};

// Plus profond et plus exigeant → sous-ensemble du moins exigeant
checker.isSubset(deep, shallow); // true
checker.isSubset(shallow, deep); // false

// Les chemins de diff sont complets
const result = checker.check(shallow, deep);
const bioDiff = result.diffs.find(
  d => d.path === "properties.user.properties.profile.properties.bio"
);
console.log(bioDiff?.type); // "added"
```

---

### 9. `anyOf` / `oneOf`

La librairie supporte `anyOf` et `oneOf` avec distinction dans les chemins de diff.

#### anyOf

```ts
const sub = {
  anyOf: [{ type: "string" }, { type: "number" }],
};
const sup = {
  anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};

// Chaque branche de sub doit matcher une branche de sup
checker.isSubset(sub, sup); // true
checker.isSubset(sup, sub); // false

// Atomic ⊆ anyOf (si au moins une branche accepte)
checker.isSubset(
  { type: "string", minLength: 1 },
  { anyOf: [{ type: "string" }, { type: "number" }] }
); // true

// Atomic ⊄ anyOf (si aucune branche n'accepte)
checker.isSubset(
  { type: "boolean" },
  { anyOf: [{ type: "string" }, { type: "number" }] }
); // false
```

#### oneOf

Le `oneOf` est traité comme `anyOf` pour la vérification de sous-ensemble (chaque branche doit être acceptée). La différence apparaît dans les **chemins de diff**.

```ts
// Les chemins de diff utilisent le bon label
const result = checker.check(
  { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
  { oneOf: [{ type: "string" }, { type: "number" }] }
);

result.diffs[0].path; // "oneOf[2]" (et non "anyOf[2]")
```

#### Unions discriminées

```ts
const sub = {
  oneOf: [
    {
      type: "object",
      properties: { kind: { const: "a" }, value: { type: "string" } },
      required: ["kind", "value"],
    },
    {
      type: "object",
      properties: { kind: { const: "b" }, value: { type: "number" } },
      required: ["kind", "value"],
    },
  ],
};

const sup = {
  type: "object",
  properties: { kind: { type: "string" } },
  required: ["kind"],
};

// Chaque branche de l'union discriminée est sous-ensemble du sup
checker.isSubset(sub, sup); // true
```

> **Note** : La librairie ne vérifie **pas** l'exclusivité sémantique de `oneOf` (le fait qu'exactement une branche doit matcher). Elle traite `oneOf` comme `anyOf` pour la vérification de sous-ensemble.

---

### 10. Négation (`not`)

La librairie gère le mot-clé `not` avec un raisonnement étendu.

#### Cas de base

```ts
// number ⊆ not(string) → true (un nombre n'est jamais une string)
checker.isSubset(
  { type: "number" },
  { not: { type: "string" } }
); // true

// string ⊄ not(string) → false
checker.isSubset(
  { type: "string" },
  { not: { type: "string" } }
); // false
```

#### not avec `const` et `enum`

```ts
// status: "active" est compatible avec not(status: "deleted")
checker.isSubset(
  {
    type: "object",
    properties: { status: { const: "active" } },
    required: ["status"],
  },
  {
    not: {
      type: "object",
      properties: { status: { const: "deleted" } },
      required: ["status"],
    },
  }
); // true

// enum disjoint du not.enum → compatible
checker.isSubset(
  { enum: [1, 2] },
  { not: { enum: [3, 4] } }
); // true

// enum qui chevauche not.enum → incompatible
checker.isSubset(
  { enum: [1, 2, 3] },
  { not: { enum: [3, 4] } }
); // false
```

#### not avec `anyOf` / `oneOf`

```ts
// number est compatible avec not(anyOf([string, null]))
checker.isSubset(
  { type: "number" },
  { not: { anyOf: [{ type: "string" }, { type: "null" }] } }
); // true

// string est INcompatible avec not(anyOf([string, null]))
checker.isSubset(
  { type: "string" },
  { not: { anyOf: [{ type: "string" }, { type: "null" }] } }
); // false
```

#### Double négation

La normalisation résout automatiquement `not(not(X))` en `X` :

```ts
// not(not(string)) normalise en string
checker.normalize({ not: { not: { type: "string" } } });
// → { type: "string" }

// Donc not(not(string)) ⊆ string
checker.isSubset(
  { not: { not: { type: "string", minLength: 3 } } },
  { type: "string" }
); // true
```

#### `not` dans sub comme restriction

Quand `not` apparaît dans le sub, c'est une **restriction** (exclut des valeurs), donc le sub reste un sous-ensemble du sup :

```ts
// { type: "string", not: { const: "foo" } } ⊆ { type: "string" }
// "Toutes les strings sauf foo" est sous-ensemble de "toutes les strings"
checker.isSubset(
  { type: "string", not: { const: "foo" } },
  { type: "string" }
); // true
```

---

### 11. Formats (`format`)

La librairie connaît les formats JSON Schema Draft-07 et leur hiérarchie d'inclusion.

#### Formats supportés

`date-time`, `date`, `time`, `email`, `idn-email`, `hostname`, `idn-hostname`, `ipv4`, `ipv6`, `uri`, `uri-reference`, `iri`, `iri-reference`, `uri-template`, `uuid`, `json-pointer`, `relative-json-pointer`, `regex`.

#### Hiérarchie des formats

```
email       ⊆ idn-email
hostname    ⊆ idn-hostname
uri         ⊆ iri
uri-reference ⊆ iri-reference
```

#### Exemples

```ts
// format ⊆ type (email ⊆ string) → géré nativement par le merge
checker.isSubset(
  { type: "string", format: "email" },
  { type: "string" }
); // true

// type ⊄ format (string ⊄ email) → le format ajoute une contrainte
checker.isSubset(
  { type: "string" },
  { type: "string", format: "email" }
); // false

// Hiérarchie : email ⊆ idn-email
checker.isSubset(
  { type: "string", format: "email" },
  { type: "string", format: "idn-email" }
); // true

// Hiérarchie inverse : idn-email ⊄ email
checker.isSubset(
  { type: "string", format: "idn-email" },
  { type: "string", format: "email" }
); // false

// Formats incompatibles : email ∩ ipv4 = ∅
checker.intersect(
  { type: "string", format: "email" },
  { type: "string", format: "ipv4" }
); // null

// Même format : email ∩ email = email
checker.intersect(
  { type: "string", format: "email" },
  { type: "string", format: "email" }
);
// → { type: "string", format: "email" }
```

#### Formats dans les conditions

Les formats sont aussi évalués dans les conditions `if/then/else` via `class-validator` :

```ts
const schema = {
  type: "object",
  properties: {
    contactMethod: { type: "string" },
    contactValue: { type: "string" },
  },
  if: {
    properties: { contactValue: { format: "email" } },
  },
  then: { required: ["contactValue"] },
};

const result = checker.resolveConditions(schema, {
  contactValue: "test@example.com", // valide pour format: email
});
console.log(result.branch); // "then"
```

---

### 12. Patterns regex (`pattern`)

Les patterns regex sont comparés via une approche par **échantillonnage** (sampling) pour détecter les inclusions.

#### Mêmes patterns

```ts
// Même pattern → toujours sous-ensemble
checker.isSubset(
  { type: "string", pattern: "^[a-z]+$" },
  { type: "string", pattern: "^[a-z]+$" }
); // true
```

#### Pattern plus restrictif ⊆ pattern plus permissif

```ts
// ^[a-z]{3}$ ⊆ ^[a-z]+$ (3 lettres ⊆ 1+ lettres)
checker.isSubset(
  { type: "string", pattern: "^[a-z]{3}$" },
  { type: "string", pattern: "^[a-z]+$" }
); // true

// L'inverse est faux
checker.isSubset(
  { type: "string", pattern: "^[a-z]+$" },
  { type: "string", pattern: "^[a-z]{3}$" }
); // false
```

#### Patterns incompatibles

```ts
// Lettres ⊄ chiffres
checker.isSubset(
  { type: "string", pattern: "^[a-z]+$" },
  { type: "string", pattern: "^[0-9]+$" }
); // false
```

#### Pattern vs pas de pattern

```ts
// Sub avec pattern, sup sans pattern → sous-ensemble (sub plus restrictif)
checker.isSubset(
  { type: "string", pattern: "^[a-z]+$" },
  { type: "string" }
); // true

// Sub sans pattern, sup avec pattern → PAS sous-ensemble
checker.isSubset(
  { type: "string" },
  { type: "string", pattern: "^[a-z]+$" }
); // false
```

#### Patterns dans les propriétés imbriquées

```ts
// Pattern sur une propriété imbriquée
checker.isSubset(
  {
    type: "object",
    properties: { code: { type: "string", pattern: "^FR[0-9]{5}$" } },
    required: ["code"],
  },
  {
    type: "object",
    properties: { code: { type: "string", pattern: "^[A-Z]{2}[0-9]+$" } },
    required: ["code"],
  }
); // true (FR + 5 chiffres ⊆ 2 majuscules + chiffres)
```

> **Note** : la comparaison de patterns utilise un échantillonnage avec 200 samples par défaut. C'est une heuristique, pas une preuve formelle. Les faux positifs sont possibles mais très improbables. Les faux négatifs (counter-examples concrets) sont certains.

---

### 13. Conditions `if` / `then` / `else`

La librairie peut résoudre les conditions JSON Schema en évaluant le `if` contre des données partielles.

#### Résolution simple

```ts
const schema = {
  type: "object",
  properties: {
    status: { type: "string" },
    activatedAt: { type: "string", format: "date-time" },
  },
  required: ["status"],
  if: {
    properties: { status: { const: "active" } },
    required: ["status"],
  },
  then: {
    required: ["activatedAt"],
  },
};

// Si status = "active" → branche then appliquée
const active = checker.resolveConditions(schema, { status: "active" });
console.log(active.branch); // "then"
console.log(active.resolved.required); // ["status", "activatedAt"]

// Si status ≠ "active" → branche else (ou pas de branche supplémentaire)
const inactive = checker.resolveConditions(schema, { status: "inactive" });
console.log(inactive.branch); // "else"
console.log(inactive.resolved.required); // ["status"]
```

#### Résolution avec des conditions sur `enum`

```ts
const schema = {
  type: "object",
  properties: {
    tier: { type: "string" },
    limit: { type: "number" },
  },
  required: ["tier"],
  if: {
    properties: { tier: { enum: ["premium", "enterprise"] } },
    required: ["tier"],
  },
  then: {
    properties: { limit: { type: "number", minimum: 1000 } },
    required: ["limit"],
  },
  else: {
    properties: { limit: { type: "number", maximum: 100 } },
  },
};

const premium = checker.resolveConditions(schema, { tier: "premium" });
console.log(premium.branch); // "then"
// limit requis avec minimum 1000

const free = checker.resolveConditions(schema, { tier: "free" });
console.log(free.branch); // "else"
// limit optionnel avec maximum 100
```

#### Conditions imbriquées dans les propriétés

La résolution est **récursive** : les conditions à l'intérieur des propriétés sont aussi résolues.

```ts
const schema = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["fast", "safe"] },
        retries: { type: "number" },
        timeout: { type: "number" },
      },
      required: ["mode"],
      if: {
        properties: { mode: { const: "safe" } },
        required: ["mode"],
      },
      then: {
        required: ["retries", "timeout"],
        properties: {
          retries: { type: "number", minimum: 3 },
          timeout: { type: "number", minimum: 1000 },
        },
      },
    },
  },
  required: ["config"],
};

const result = checker.resolveConditions(schema, {
  config: { mode: "safe" },
});

// La condition dans config a été résolue
const configProp = result.resolved.properties?.config;
console.log(configProp?.required); // ["mode", "retries", "timeout"]
```

#### Évaluation avancée du `if`

Le `if` est évalué contre les données avec support complet de :

| Mot-clé | Description |
|---|---|
| `properties` avec `const` | Correspondance exacte d'une valeur |
| `properties` avec `enum` | Valeur dans une liste |
| `properties` avec `type` | Vérification du type |
| `required` | Présence des clés |
| `allOf` | Toutes les conditions doivent matcher |
| `anyOf` | Au moins une condition doit matcher |
| `oneOf` | Exactement une condition doit matcher |
| `not` | Inversion du résultat |
| `format` | Validation sémantique via `class-validator` |
| Contraintes numériques | `minimum`, `maximum`, `exclusiveMinimum`, etc. |
| Contraintes string | `minLength`, `maxLength` |
| Contraintes array | `minItems`, `maxItems`, `uniqueItems` |

---

### 14. `allOf` avec conditions

Les conditions peuvent apparaître dans un `allOf`. Chaque entrée contenant un `if/then/else` est résolue individuellement.

```ts
const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    role: { type: "string", enum: ["admin", "user", "guest"] },
  },
  required: ["name"],
  allOf: [
    {
      if: {
        properties: { age: { type: "number", exclusiveMinimum: 20 } },
        required: ["age"],
      },
      then: {
        required: ["email"],
        properties: { email: { type: "string" } },
      },
    },
    {
      if: {
        properties: { role: { const: "admin" } },
        required: ["role"],
      },
      then: {
        properties: {
          permissions: { type: "array", items: { type: "string" } },
        },
        required: ["permissions"],
      },
    },
  ],
};

// Les deux conditions matchent
const result = checker.resolveConditions(schema, {
  name: "Alice",
  age: 25,
  role: "admin",
});

console.log(result.resolved.required);
// → ["name", "email", "permissions"]
// email requis car age > 20, permissions requis car role = admin

console.log(result.resolved.properties?.email);
// → { type: "string" }

console.log(result.resolved.properties?.permissions);
// → { type: "array", items: { type: "string" } }
```

#### `allOf` combiné avec un `if/then/else` au niveau racine

```ts
const schema = {
  type: "object",
  properties: {
    kind: { type: "string" },
    value: {},
  },
  required: ["kind"],
  // Condition racine
  if: {
    properties: { kind: { const: "numeric" } },
    required: ["kind"],
  },
  then: {
    properties: { value: { type: "number" } },
  },
  else: {
    properties: { value: { type: "string" } },
  },
  // Condition dans allOf
  allOf: [
    {
      if: {
        properties: { kind: { const: "numeric" } },
        required: ["kind"],
      },
      then: {
        properties: { precision: { type: "number" } },
      },
    },
  ],
};

const result = checker.resolveConditions(schema, { kind: "numeric" });

// Les deux conditions (racine + allOf) sont résolues
console.log(result.resolved.properties?.value);     // { type: "number" }
console.log(result.resolved.properties?.precision);  // { type: "number" }
```

---

## Fonctions utilitaires

En plus de la classe principale, la librairie exporte des fonctions utilitaires pour travailler avec les patterns regex.

```ts
import {
  isPatternSubset,
  arePatternsEquivalent,
  isTrivialPattern,
} from "json-schema-compatibility-checker";
```

---

### `isPatternSubset(sub, sup)`

```ts
isPatternSubset(
  subPattern: string,
  supPattern: string,
  sampleCount?: number  // défaut: 200
): boolean | null
```

Vérifie si le langage du pattern `sub` est un sous-ensemble du langage du pattern `sup` via **échantillonnage**.

**Contrat ternaire :**
- `true` — toutes les strings échantillonnées de sub matchent sup (confiance haute)
- `false` — au moins une string de sub ne matche PAS sup (certain, c'est un contre-exemple)
- `null` — impossible de déterminer (pattern invalide, génération échouée)

```ts
import { isPatternSubset } from "json-schema-compatibility-checker";

isPatternSubset("^[a-z]{3}$", "^[a-z]+$");      // true  — 3 lettres ⊆ 1+ lettres
isPatternSubset("^[a-z]+$", "^[0-9]+$");         // false — lettres ⊄ chiffres
isPatternSubset("^[a-z]+$", "^[a-z]{3}$");       // false — "ab" matche sub mais pas sup
isPatternSubset("invalid[", "^[a-z]+$");          // null  — pattern invalide

// Cas réalistes
isPatternSubset("^SKU-[0-9]{6}$", "^[A-Z]+-[0-9]+$");       // true
isPatternSubset("^FR[0-9]{5}$", "^[A-Z]{2}[0-9]+$");         // true
isPatternSubset("^(75|92|93|94)[0-9]{3}$", "^[0-9]{5}$");    // true
```

---

### `arePatternsEquivalent(a, b)`

```ts
arePatternsEquivalent(
  patternA: string,
  patternB: string,
  sampleCount?: number  // défaut: 200
): boolean | null
```

Vérifie si deux patterns acceptent le **même langage** via un échantillonnage bidirectionnel (`A ⊆ B` ET `B ⊆ A`).

```ts
import { arePatternsEquivalent } from "json-schema-compatibility-checker";

arePatternsEquivalent("^[a-z]+$", "^[a-z]+$");    // true  — identiques
arePatternsEquivalent("^[a-z]+$", "^[a-z]{3}$");   // false — cardinalité différente
arePatternsEquivalent("^[a-f]+$", "^[a-z]+$");     // false — a-f ⊆ a-z mais pas l'inverse
```

---

### `isTrivialPattern(pattern)`

```ts
isTrivialPattern(pattern: string): boolean
```

Vérifie si un pattern est **universellement permissif** (matche toute string). Utile pour détecter les patterns qui n'ajoutent aucune contrainte réelle.

```ts
import { isTrivialPattern } from "json-schema-compatibility-checker";

isTrivialPattern(".*");     // true
isTrivialPattern(".+");     // true
isTrivialPattern("^.*$");   // true
isTrivialPattern("^.+$");   // true
isTrivialPattern("");        // true (pattern vide)

isTrivialPattern("^[a-z]+$");   // false
isTrivialPattern("^[0-9]{3}$"); // false
isTrivialPattern("abc");        // false
```

---

## Cas d'usage concrets

### Connexion de nœuds dans un orchestrateur

Le cas d'usage principal de la librairie : dans un système d'orchestration visuel (style n8n, Node-RED, Zapier), vérifier que la sortie d'un nœud est compatible avec l'entrée du suivant.

```ts
const checker = new JsonSchemaCompatibilityChecker();

// Nœud A : API qui retourne des utilisateurs paginés
const nodeAOutput = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer", minimum: 1 },
          name: { type: "string", minLength: 1, maxLength: 255 },
          tags: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        required: ["id", "name"],
      },
    },
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100 },
    totalPages: { type: "integer", minimum: 0 },
  },
  required: ["items", "page", "pageSize", "totalPages"],
};

// Nœud B : traitement qui attend une liste avec pagination
const nodeBInput = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
        required: ["id"],
      },
    },
    page: { type: "number" },
    totalPages: { type: "number" },
  },
  required: ["items"],
};

const connection = checker.canConnect(nodeAOutput, nodeBInput);
console.log(connection.isSubset);  // true ✅
console.log(connection.direction); // "sourceOutput ⊆ targetInput"

// Si incompatible, le diagnostic explique pourquoi
if (!connection.isSubset) {
  console.log(checker.formatResult("NodeA → NodeB", connection));
}
```

---

### Validation de réponse API

Vérifier qu'une réponse API réelle est compatible avec ce qu'un consommateur attend.

```ts
const apiResponse = {
  type: "object",
  properties: {
    status: { type: "integer", minimum: 100, maximum: 599 },
    data: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              name: { type: "string", minLength: 1 },
              role: { type: "string", enum: ["admin", "user", "viewer"] },
            },
            required: ["id", "email", "name", "role"],
          },
        },
        total: { type: "integer", minimum: 0 },
      },
      required: ["users", "total"],
    },
  },
  required: ["status", "data"],
};

const consumerExpects = {
  type: "object",
  properties: {
    status: { type: "integer" },
    data: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
            },
            required: ["id", "email"],
          },
        },
      },
      required: ["users"],
    },
  },
  required: ["data"],
};

const result = checker.canConnect(apiResponse, consumerExpects);
console.log(result.isSubset); // true ✅
// L'API retourne plus de données que ce que le consommateur attend,
// mais TOUTES les données requises sont présentes et du bon type.
```

---

### Union discriminée

Vérifier qu'une union discriminée (`oneOf` avec un champ discriminant) est compatible avec un schema d'entrée flexible.

```ts
const output = {
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "success" },
        data: { type: "object" },
      },
      required: ["type", "data"],
    },
    {
      type: "object",
      properties: {
        type: { const: "error" },
        message: { type: "string" },
        code: { type: "integer" },
      },
      required: ["type", "message"],
    },
  ],
};

const input = {
  type: "object",
  properties: {
    type: { type: "string" },
  },
  required: ["type"],
};

// Chaque branche de l'union a un champ "type" de type string
checker.isSubset(output, input); // true ✅
```

---

### Formulaire conditionnel

Valider qu'un formulaire rempli par l'utilisateur est compatible avec un schema conditionnel.

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

// Output d'un formulaire "business" rempli
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

// Sans résolution, le if/then/else brut cause un faux négatif
checker.isSubset(businessOutput, formSchema); // false ❌

// Avec résolution, le schéma conditionnel est aplati
const result = checker.checkResolved(businessOutput, formSchema, {
  accountType: "business",
});
console.log(result.isSubset);          // true ✅
console.log(result.resolvedSup.branch); // "then"

// Output d'un formulaire "personal" rempli
const personalOutput = {
  type: "object",
  properties: {
    accountType: { const: "personal", type: "string", enum: ["personal", "business"] },
    email: { type: "string", format: "email" },
    firstName: { type: "string", minLength: 1 },
    lastName: { type: "string", minLength: 1 },
  },
  required: ["accountType", "email", "firstName", "lastName"],
  additionalProperties: false,
};

const personalResult = checker.checkResolved(personalOutput, formSchema, {
  accountType: "personal",
});
console.log(personalResult.isSubset);          // true ✅
console.log(personalResult.resolvedSup.branch); // "else"
```

---

## Types exportés

```ts
import type {
  SubsetResult,
  ConnectionResult,
  ResolvedConditionResult,
  SchemaDiff,
  BranchType,
  BranchResult,
} from "json-schema-compatibility-checker";
```

### `SchemaDiff`

```ts
interface SchemaDiff {
  /** Chemin JSON-path-like vers la divergence (ex: "properties.user.required") */
  path: string;
  /** Type de divergence */
  type: "added" | "removed" | "changed";
  /** Valeur dans le schema original (sub) */
  expected: unknown;
  /** Valeur dans le schema mergé (intersection) */
  actual: unknown;
}
```

### `SubsetResult`

```ts
interface SubsetResult {
  /** true si sub ⊆ sup */
  isSubset: boolean;
  /** Le schema résultant de l'intersection allOf(sub, sup), ou null si incompatible */
  merged: JSONSchema7Definition | null;
  /** Différences structurelles détectées entre sub et l'intersection */
  diffs: SchemaDiff[];
}
```

### `ConnectionResult`

```ts
interface ConnectionResult extends SubsetResult {
  /** Direction lisible du check */
  direction: string;
}
```

### `ResolvedConditionResult`

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

## Limitations connues

### 1. Cross-keyword constraints

La librairie utilise une comparaison **structurelle** : elle compare les mots-clés individuellement. Elle ne peut pas raisonner sur des relations entre mots-clés différents mais sémantiquement liés.

```ts
// Sémantiquement, {exclusiveMinimum: 5} ⊆ {minimum: 0} est VRAI (x>5 implique x≥0)
// Mais le merge ajoute minimum:0, ce qui rend merged ≠ sub structurellement
checker.isSubset(
  { type: "number", exclusiveMinimum: 5 },
  { type: "number", minimum: 0 }
); // false (faux négatif)
```

### 2. `oneOf` — exclusivité non vérifiée

La librairie traite `oneOf` comme `anyOf` pour la vérification de sous-ensemble. L'exclusivité sémantique (exactement une branche doit matcher) n'est **pas** vérifiée.

```ts
const overlapping = {
  oneOf: [
    { type: "string", minLength: 1 },    // branches qui se chevauchent
    { type: "string", maxLength: 100 },
  ],
};
// En strict oneOf, "abc" matcherait les DEUX branches → rejeté
// La librairie ne détecte pas ce chevauchement
```

### 3. Patterns regex — approche probabiliste

La comparaison de patterns regex utilise un **échantillonnage** (200 samples par défaut). C'est une heuristique, pas une preuve formelle.

- **Faux négatifs** certains : si un counter-example est trouvé, l'exclusion est garantie
- **Faux positifs** possibles : si tous les échantillons passent, ce n'est pas une preuve formelle (mais très improbable avec 200 samples)
- Les patterns avec backreferences complexes peuvent poser problème

### 4. `if/then/else` — nécessite des données discriminantes

Les schemas avec `if/then/else` ne peuvent pas être comparés directement via `isSubset` car le merge brut ajoute les mots-clés conditionnels. Il faut utiliser `checkResolved()` avec les données discriminantes.

### 5. `$ref` — non supporté

Les références `$ref` ne sont pas résolues par la librairie. Il faut dé-référencer le schema avant de l'utiliser.

### 6. `patternProperties` — support partiel

Les `patternProperties` sont normalisés et comparés structurellement, mais la comparaison sémantique des patterns comme clés n'est pas effectuée.

---

## Architecture interne

La librairie est organisée en modules spécialisés, orchestrés par la façade `JsonSchemaCompatibilityChecker` :

```
┌──────────────────────────────────────────────────┐
│        JsonSchemaCompatibilityChecker            │
│                  (Façade)                        │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Normalizer   │  │    Condition Resolver     │  │
│  │              │  │                          │  │
│  │ - Infer type │  │ - Evaluate if            │  │
│  │ - enum→const │  │ - Merge then/else        │  │
│  │ - not(not(X))│  │ - Recurse in allOf       │  │
│  │ - Recurse    │  │ - Nested properties      │  │
│  └──────────────┘  └──────────────────────────┘  │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Merge Engine  │  │    Subset Checker         │  │
│  │              │  │                          │  │
│  │ - allOf merge│  │ - Atomic: A∩B ≡ A ?     │  │
│  │ - Conflict   │  │ - Branched sub (anyOf)   │  │
│  │   detection  │  │ - Branched sup (anyOf)   │  │
│  │ - Compare    │  │ - evaluateNot            │  │
│  └──────────────┘  │ - stripNotFromSup        │  │
│                     │ - stripPatternFromSup    │  │
│  ┌──────────────┐  └──────────────────────────┘  │
│  │    Differ     │                               │
│  │              │  ┌──────────────────────────┐  │
│  │ - computeDiff│  │    Pattern Subset         │  │
│  │ - Recurse    │  │                          │  │
│  │ - Properties │  │ - isPatternSubset        │  │
│  └──────────────┘  │ - arePatternsEquivalent  │  │
│                     │ - isTrivialPattern       │  │
│  ┌──────────────┐  └──────────────────────────┘  │
│  │  Formatter    │                               │
│  │              │  ┌──────────────────────────┐  │
│  │ - formatResult│  │    Format Validator       │  │
│  │ - Diff lines │  │                          │  │
│  └──────────────┘  │ - validateFormat         │  │
│                     │ - isFormatSubset         │  │
│                     │ - Format hierarchy       │  │
│                     └──────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Flux de vérification `isSubset(sub, sup)`

```
1. Normalize(sub), Normalize(sup)
2. Detect branches (anyOf/oneOf) in sub and sup
3. For each branch combination:
   a. evaluateNot() — pre-check not compatibility
   b. stripNotFromSup() — remove compatible not constraints
   c. stripPatternFromSup() — handle pattern inclusion via sampling
   d. engine.merge(sub, sup) — compute intersection
   e. normalize(merged)
   f. engine.isEqual(normalized_sub, normalized_merged) ?
      → true: sub ⊆ sup ✅
      → false: compute diffs, sub ⊄ sup ❌
```

### Dépendances

| Package | Usage |
|---|---|
| `@x0k/json-schema-merge` | Merge engine pour `allOf` resolution |
| `lodash` | Utilitaires (isEqual, mapValues, union, etc.) |
| `class-validator` | Validation des formats (email, URL, UUID, etc.) |
| `randexp` | Génération de strings pour le sampling de patterns |

---

## Licence

Projet privé.
