# JSON Schema Compatibility Checker

> Vérifiez la compatibilité structurelle entre JSON Schemas (Draft-07) grâce à une approche mathématique par intersection ensembliste.

---

## Sommaire

- [Introduction](#introduction)
- [Principe mathématique](#principe-mathématique)
- [Installation](#installation)
- [Démarrage rapide](#démarrage-rapide)
- [API Reference](#api-reference)
- [Documentation complète](#-documentation-complète)
- [Limitations connues](#limitations-connues)
- [Licence](#licence)

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
- ✅ Calcule l'intersection de deux schemas (`allOf` merge)
- ✅ Accumule des schemas séquentiellement via deep spread (`overlay`)
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

### `JsonSchemaCompatibilityChecker`

Toutes les méthodes de vérification de compatibilité sont exposées par la classe `JsonSchemaCompatibilityChecker`.

```ts
const checker = new JsonSchemaCompatibilityChecker();
```

| Méthode | Description | Retour |
|---|---|---|
| `isSubset(sub, sup)` | Vérifie si `sub ⊆ sup` | `boolean` |
| `check(sub, sup)` | Vérifie avec diagnostic détaillé | `SubsetResult` |
| `check(sub, sup, options)` | Vérifie avec résolution des conditions `if/then/else` | `ResolvedSubsetResult` |
| `isEqual(a, b)` | Égalité structurelle après normalisation | `boolean` |
| `intersect(a, b)` | Intersection de deux schemas | `JSONSchema7Definition \| null` |
| `resolveConditions(schema, data)` | Résout les `if/then/else` avec des données | `ResolvedConditionResult` |
| `normalize(schema)` | Normalise un schema (infère types, résout double négation) | `JSONSchema7Definition` |
| `formatResult(label, result)` | Formate un résultat pour le debug | `string` |

### `MergeEngine`

Opérations bas-niveau sur les schemas : intersection (`allOf` merge) et overlay (deep spread séquentiel).

```ts
import { MergeEngine } from "json-schema-compatibility-checker";

const engine = new MergeEngine();
```

| Méthode | Description | Retour |
|---|---|---|
| `merge(a, b)` | Intersection `allOf([a, b])` — retourne `null` si incompatible | `JSONSchema7Definition \| null` |
| `mergeOrThrow(a, b)` | Comme `merge`, mais lève une exception si incompatible | `JSONSchema7Definition` |
| `overlay(base, override)` | Deep spread séquentiel — last writer wins par propriété | `JSONSchema7Definition` |
| `compare(a, b)` | Comparaison structurelle (0 = identique) | `number` |
| `isEqual(a, b)` | Égalité structurelle | `boolean` |

**Exemple rapide — `check` avec diagnostic :**

```ts
const result = checker.check(
  { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  { type: "object", properties: { name: { type: "string" }, age: { type: "number" } }, required: ["name", "age"] }
);

console.log(result.isSubset); // false
console.log(result.errors);
// [{ key: "age", expected: "number", received: "undefined" }]
```

**Exemple rapide — résolution de conditions :**

```ts
const result = checker.check(sub, conditionalSup, {
  subData: { kind: "text" },
});
console.log(result.isSubset);          // true ✅
console.log(result.resolvedSup.branch); // "then"
```

**Exemple rapide — `overlay` pour accumulation séquentielle :**

```ts
import { MergeEngine } from "json-schema-compatibility-checker";

const engine = new MergeEngine();

// Node1 produit accountId avec enum
const node1Output = {
  type: "object",
  properties: { accountId: { type: "string", enum: ["a", "b"] } },
  required: ["accountId"],
};

// Node2 redéfinit accountId en string simple (plus large)
const node2Output = {
  type: "object",
  properties: { accountId: { type: "string" } },
  required: ["accountId"],
};

// ❌ merge (intersection) : garde l'enum — FAUX pour un pipeline séquentiel
engine.merge(node1Output, node2Output);
// → { ..., properties: { accountId: { type: "string", enum: ["a", "b"] } } }

// ✅ overlay (deep spread) : le dernier écrivain gagne — CORRECT
engine.overlay(node1Output, node2Output);
// → { ..., properties: { accountId: { type: "string" } } }
```

👉 Pour la documentation complète de chaque méthode avec tous les exemples, consultez la **[Référence API](./docs/api-reference.md)**.

---

## 📖 Documentation complète

| Page | Description |
|---|---|
| **[Référence API](./docs/api-reference.md)** | Documentation détaillée de chaque méthode (`JsonSchemaCompatibilityChecker` + `MergeEngine`) avec exemples |
| **[Guide des fonctionnalités](./docs/features-guide.md)** | Tour complet des fonctionnalités : types, `required`, contraintes numériques, `enum`/`const`, `anyOf`/`oneOf`, `not`, `format`, `pattern`, conditions `if/then/else`, `allOf`... |
| **[Fonctions utilitaires](./docs/utilities.md)** | `isPatternSubset`, `arePatternsEquivalent`, `isTrivialPattern` |
| **[Cas d'usage concrets](./docs/use-cases.md)** | Connexion de nœuds, pipeline séquentiel (overlay), validation de réponse API, unions discriminées, formulaires conditionnels |
| **[Types exportés](./docs/types.md)** | `SubsetResult`, `SchemaError`, `ResolvedConditionResult`, `ResolvedSubsetResult`, `CheckConditionsOptions` |
| **[Limitations connues](./docs/limitations.md)** | Cross-keyword constraints, `oneOf` exclusivité, patterns probabilistes, `$ref` non supporté |
| **[Architecture interne](./docs/architecture.md)** | Diagramme des modules, flux de vérification, merge vs overlay, dépendances |

---

## Limitations connues

- **Cross-keyword constraints** : `exclusiveMinimum` vs `minimum` peut produire des faux négatifs (limitation structurelle)
- **`oneOf` exclusivité** : traité comme `anyOf` — l'exclusivité sémantique n'est pas vérifiée
- **Patterns regex** : approche probabiliste par échantillonnage (200 samples), pas une preuve formelle
- **`if/then/else`** : nécessite des données discriminantes via `check(sub, sup, { subData })`
- **`$ref`** : non supporté — les schemas doivent être pré-déréférencés
- **`patternProperties`** : support partiel

👉 Détails et exemples dans **[Limitations connues](./docs/limitations.md)**.

---

## Licence

MIT