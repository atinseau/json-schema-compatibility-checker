# Guide des fonctionnalités

Cette section présente les fonctionnalités supportées, du plus simple au plus complexe, avec des exemples illustratifs.

[← Retour au README](../README.md)

---

## Sommaire

- [1. Compatibilité de types](#1-compatibilité-de-types)
- [2. Champs requis (`required`)](#2-champs-requis-required)
- [3. Contraintes numériques](#3-contraintes-numériques)
- [4. Contraintes de chaînes](#4-contraintes-de-chaînes)
- [5. `enum` et `const`](#5-enum-et-const)
- [6. Contraintes de tableaux](#6-contraintes-de-tableaux)
- [7. `additionalProperties`](#7-additionalproperties)
- [8. Objets imbriqués](#8-objets-imbriqués)
- [9. `anyOf` / `oneOf`](#9-anyof--oneof)
- [9b. `oneOf`/`anyOf` imbriqués dans les propriétés](#9b-oneofanyof-imbriqués-dans-les-propriétés)
- [10. Négation (`not`)](#10-négation-not)
- [11. Formats (`format`)](#11-formats-format)
- [12. Patterns regex (`pattern`)](#12-patterns-regex-pattern)
- [13. Conditions `if` / `then` / `else`](#13-conditions-if--then--else)
- [14. `allOf` avec conditions](#14-allof-avec-conditions)

---

## 1. Compatibilité de types

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

## 2. Champs requis (`required`)

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
console.log(result.errors);
// [{ key: "age", expected: "number", received: "undefined" }]
```

---

## 3. Contraintes numériques

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

## 4. Contraintes de chaînes

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

## 5. `enum` et `const`

### Enum

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

### Const

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

## 6. Contraintes de tableaux

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

## 7. `additionalProperties`

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
console.log(result.errors);
// [{ key: "age", expected: "not allowed (additionalProperties: false)", received: "number" }]
```

---

## 8. Objets imbriqués

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

// Les erreurs montrent les propriétés manquantes avec un chemin complet
const result = checker.check(shallow, deep);
console.log(result.errors);
// [{ key: "user.profile.bio", expected: "string", received: "undefined" }]
```

---

## 9. `anyOf` / `oneOf`

La librairie supporte `anyOf` et `oneOf` pour la vérification de sous-ensemble.

### anyOf

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

### oneOf

Le `oneOf` est traité comme `anyOf` pour la vérification de sous-ensemble (chaque branche doit être acceptée).

```ts
const result = checker.check(
  { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
  { oneOf: [{ type: "string" }, { type: "number" }] }
);

console.log(result.isSubset); // false
console.log(result.errors);   // erreurs pour la branche non couverte
```

### Unions discriminées

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

## 9b. `oneOf`/`anyOf` imbriqués dans les propriétés

Quand `oneOf`/`anyOf` apparaît **à l'intérieur** des propriétés d'un objet ou des items d'un tableau (et non au niveau racine), le merge engine ne peut pas distribuer `allOf` sur ces branches. La librairie détecte automatiquement cette situation et utilise un **fallback propriété-par-propriété** qui réutilise la logique de branching existante sur chaque sous-schema individuellement.

### Type concret ⊆ propriété avec `oneOf`/`anyOf`

```ts
// obj{ payload: string } ⊆ obj{ payload: oneOf(string, number) }
checker.isSubset(
  {
    type: "object",
    properties: { payload: { type: "string" } },
    required: ["payload"],
  },
  {
    type: "object",
    properties: {
      payload: { oneOf: [{ type: "string" }, { type: "number" }] },
    },
    required: ["payload"],
  }
); // true ✅

// obj{ retry: integer } ⊆ obj{ retry: anyOf(number, null) }
checker.isSubset(
  {
    type: "object",
    properties: { retryCount: { type: "integer" } },
    required: ["retryCount"],
  },
  {
    type: "object",
    properties: {
      retryCount: { anyOf: [{ type: "number" }, { type: "null" }] },
    },
    required: ["retryCount"],
  }
); // true ✅ — integer ⊂ number
```

### `oneOf`/`anyOf` identiques des deux côtés

```ts
// obj{ result: oneOf(s,n) } ⊆ obj{ result: oneOf(s,n) }
const schema = {
  type: "object",
  properties: {
    result: { oneOf: [{ type: "string" }, { type: "number" }] },
  },
  required: ["result"],
};
checker.isSubset(schema, schema); // true ✅
```

### Branches sub ⊆ branches sup

```ts
// obj{ v: oneOf(string) } ⊆ obj{ v: oneOf(string, number) }
checker.isSubset(
  {
    type: "object",
    properties: { v: { oneOf: [{ type: "string" }] } },
    required: ["v"],
  },
  {
    type: "object",
    properties: {
      v: { oneOf: [{ type: "string" }, { type: "number" }] },
    },
    required: ["v"],
  }
); // true ✅

// obj{ v: anyOf(s,n) } ⊄ obj{ v: anyOf(string) } — sup est plus étroit
checker.isSubset(
  {
    type: "object",
    properties: {
      v: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
    required: ["v"],
  },
  {
    type: "object",
    properties: { v: { anyOf: [{ type: "string" }] } },
    required: ["v"],
  }
); // false ❌
```

### Dans les items de tableaux

```ts
// obj{ items: array<string> } ⊆ obj{ items: array<oneOf(string, number)> }
checker.isSubset(
  {
    type: "object",
    properties: {
      items: { type: "array", items: { type: "string" } },
    },
    required: ["items"],
  },
  {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { oneOf: [{ type: "string" }, { type: "number" }] },
      },
    },
    required: ["items"],
  }
); // true ✅
```

### Objets profondément imbriqués

```ts
// obj{ nested: obj{ v: string } } ⊆ obj{ nested: obj{ v: oneOf(s,n) } }
checker.isSubset(
  {
    type: "object",
    properties: {
      nested: {
        type: "object",
        properties: { v: { type: "string" } },
        required: ["v"],
      },
    },
    required: ["nested"],
  },
  {
    type: "object",
    properties: {
      nested: {
        type: "object",
        properties: {
          v: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        required: ["v"],
      },
    },
    required: ["nested"],
  }
); // true ✅
```

### Propriétés multiples avec branching mixte

```ts
// obj{ a: string, b: number } ⊆ obj{ a: oneOf(s,n), b: anyOf(n,null) }
checker.isSubset(
  {
    type: "object",
    properties: { a: { type: "string" }, b: { type: "number" } },
    required: ["a", "b"],
  },
  {
    type: "object",
    properties: {
      a: { oneOf: [{ type: "string" }, { type: "number" }] },
      b: { anyOf: [{ type: "number" }, { type: "null" }] },
    },
    required: ["a", "b"],
  }
); // true ✅

// obj{ a: string, b: boolean } ⊄ obj{ a: oneOf(s,n), b: anyOf(n,null) } — b ne matche pas
checker.isSubset(
  {
    type: "object",
    properties: { a: { type: "string" }, b: { type: "boolean" } },
    required: ["a", "b"],
  },
  {
    type: "object",
    properties: {
      a: { oneOf: [{ type: "string" }, { type: "number" }] },
      b: { anyOf: [{ type: "number" }, { type: "null" }] },
    },
    required: ["a", "b"],
  }
); // false ❌
```

### Branches avec contraintes

```ts
// obj{ v: {type:string, minLength:3} } ⊆ obj{ v: anyOf({type:string, minLength:1}, {type:number}) }
checker.isSubset(
  {
    type: "object",
    properties: { v: { type: "string", minLength: 3 } },
    required: ["v"],
  },
  {
    type: "object",
    properties: {
      v: { anyOf: [{ type: "string", minLength: 1 }, { type: "number" }] },
    },
    required: ["v"],
  }
); // true ✅ — minLength:3 ⊆ minLength:1
```

> **Note** : Ce fallback est activé automatiquement uniquement quand le merge échoue et que `oneOf`/`anyOf` est détecté dans les `properties` ou `items`. Il n'y a aucun overhead sur les schemas sans branching imbriqué. Le fallback ne vérifie pas les mots-clés au niveau objet (`minProperties`/`maxProperties`) — ceux-ci sont gérés par le merge quand le branching n'est pas impliqué.

---

## 10. Négation (`not`)

La librairie gère le mot-clé `not` avec un raisonnement étendu.

### Cas de base

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

### not avec `const` et `enum`

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

### not avec `anyOf` / `oneOf`

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

### Double négation

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

### `not` dans sub comme restriction

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

## 11. Formats (`format`)

La librairie connaît les formats JSON Schema Draft-07 et leur hiérarchie d'inclusion.

### Formats supportés

`date-time`, `date`, `time`, `email`, `idn-email`, `hostname`, `idn-hostname`, `ipv4`, `ipv6`, `uri`, `uri-reference`, `iri`, `iri-reference`, `uri-template`, `uuid`, `json-pointer`, `relative-json-pointer`, `regex`.

### Hiérarchie des formats

```
email       ⊆ idn-email
hostname    ⊆ idn-hostname
uri         ⊆ iri
uri-reference ⊆ iri-reference
```

### Exemples

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

### Runtime validation in `check()`

When you call `check(sub, sup, { data })`, runtime data is not only used to resolve `if/then/else` conditions.

It is also used to validate constraints carried by the resolved schemas:

- `enum`
- `const`
- `format`

This applies even outside conditional branches.

#### `enum` / `const` case

If runtime data is provided, the library checks whether the concrete value is compatible with the relevant `enum` or `const` constraints.

```ts
checker.check(
  { type: "string" },
  { type: "string", enum: ["red", "green", "blue"] },
  { data: "red" }
);
// → subset valide pour cette valeur runtime
```

À l'inverse, si la donnée n'appartient pas à l'`enum`, le check runtime doit échouer :

```ts
checker.check(
  { type: "string" },
  { type: "string", enum: ["red", "green", "blue"] },
  { data: "yellow" }
);
// → incompatible pour cette valeur runtime
```

Le même principe s'applique à `const`.

#### Cas `format`

La validation de `format` ne se limite pas aux conditions `if`.

Si un schéma résolu contient `format: "email"` ou n'importe quel autre format supporté, et qu'une donnée runtime est fournie, cette donnée est aussi validée contre ce format dans le pipeline de `check()`.

```ts
checker.check(
  { type: "string", format: "email" },
  { type: "string", format: "email" },
  { data: "test@example.com" }
);
// → compatible
```

Si la donnée runtime ne respecte pas le format, le résultat doit refléter cette incompatibilité runtime :

```ts
checker.check(
  { type: "string", format: "email" },
  { type: "string", format: "email" },
  { data: "je-ne-suis-pas-un-email" }
);
// → incompatible pour cette valeur runtime
```

Même logique pour un format personnalisé supporté par la librairie, par exemple :

```ts
checker.check(
  {
    type: "string",
    enum: ["red", "green", "blue"],
    format: "color",
  },
  {
    type: "string",
    enum: ["red", "green", "blue"],
    format: "color",
  },
  {
    data: "Je ne suis pas une couleur",
  }
);
// → incompatible pour cette valeur runtime
```

### Formats dans les conditions

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

> En résumé : `format` est évalué à deux endroits distincts :
> - pendant la résolution des conditions `if/then/else`
> - pendant `check()` quand des données runtime sont fournies

---


## 12. Patterns regex (`pattern`)

Les patterns regex sont comparés via une approche par **échantillonnage** (sampling) pour détecter les inclusions.

### Mêmes patterns

```ts
// Même pattern → toujours sous-ensemble
checker.isSubset(
  { type: "string", pattern: "^[a-z]+$" },
  { type: "string", pattern: "^[a-z]+$" }
); // true
```

### Pattern plus restrictif ⊆ pattern plus permissif

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

### Patterns incompatibles

```ts
// Lettres ⊄ chiffres
checker.isSubset(
  { type: "string", pattern: "^[a-z]+$" },
  { type: "string", pattern: "^[0-9]+$" }
); // false
```

### Pattern vs pas de pattern

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

### Patterns dans les propriétés imbriquées

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

## 13. Conditions `if` / `then` / `else`

La librairie peut résoudre les conditions JSON Schema en évaluant le `if` contre des données partielles.

### Résolution simple

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

### Résolution avec des conditions sur `enum`

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

### Conditions imbriquées dans les propriétés

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

### Évaluation avancée du `if`

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

## 14. `allOf` avec conditions

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

### `allOf` combiné avec un `if/then/else` au niveau racine

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
