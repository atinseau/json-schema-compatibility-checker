# Limitations connues

## 1. Cross-keyword constraints

La librairie utilise une comparaison **structurelle** : elle compare les mots-clés individuellement. Elle ne peut pas raisonner sur des relations entre mots-clés différents mais sémantiquement liés.

```ts
// Sémantiquement, {exclusiveMinimum: 5} ⊆ {minimum: 0} est VRAI (x>5 implique x≥0)
// Mais le merge ajoute minimum:0, ce qui rend merged ≠ sub structurellement
checker.isSubset(
  { type: "number", exclusiveMinimum: 5 },
  { type: "number", minimum: 0 }
); // false (faux négatif)
```

## 2. `oneOf` — exclusivité non vérifiée

La librairie traite `oneOf` comme `anyOf` pour la vérification de sous-ensemble. L'exclusivité sémantique (exactement une branche doit matcher) n'est **pas** vérifiée. En revanche, `oneOf`/`anyOf` est supporté aussi bien au niveau racine qu'imbriqué dans les propriétés d'objets et les items de tableaux (voir section 7).

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

## 3. Patterns regex — approche probabiliste

La comparaison de patterns regex utilise un **échantillonnage** (200 samples par défaut). C'est une heuristique, pas une preuve formelle.

- **Faux négatifs** certains : si un counter-example est trouvé, l'exclusion est garantie
- **Faux positifs** possibles : si tous les échantillons passent, ce n'est pas une preuve formelle (mais très improbable avec 200 samples)
- Les patterns avec backreferences complexes peuvent poser problème

## 4. `if/then/else` — nécessite des données discriminantes

Les schemas avec `if/then/else` ne peuvent pas être comparés directement via `isSubset` car le merge brut ajoute les mots-clés conditionnels. Il faut utiliser `check(sub, sup, { subData })` avec les données discriminantes.

## 5. `$ref` — non supporté

Les références `$ref` ne sont pas résolues par la librairie. Il faut dé-référencer le schema avant de l'utiliser.

## 6. `patternProperties` — support partiel

Les `patternProperties` sont normalisés et comparés structurellement, mais la comparaison sémantique des patterns comme clés n'est pas effectuée.

## 7. Nested branching fallback — scope limité

Quand `oneOf`/`anyOf` apparaît **à l'intérieur** des propriétés d'un objet ou des items d'un tableau, le merge engine (`@x0k/json-schema-merge`) ne peut pas distribuer `allOf` sur ces branches. La librairie détecte automatiquement cette situation et utilise un **fallback propriété-par-propriété** qui réutilise la logique de branching existante sur chaque sous-schema individuellement.

Ce fallback couvre :
- ✅ `properties` (comparaison propriété par propriété)
- ✅ `required` (inclusion des champs requis)
- ✅ `additionalProperties` (contraintes sur les propriétés supplémentaires)
- ✅ `items` (items de tableaux)
- ✅ Branching des deux côtés (sub et sup peuvent avoir `oneOf`/`anyOf`)
- ✅ Profondeur arbitraire (objet > objet > oneOf)

Ce fallback ne couvre **pas** :
- ❌ `minProperties` / `maxProperties` — ces mots-clés au niveau objet sont rares en pratique et sont gérés correctement par le merge quand le branching n'est pas impliqué
- ❌ `patternProperties` — seules les `properties` nommées sont comparées
- ❌ `dependencies` (forme schema) — non traversé par le fallback

```ts
// ✅ Fonctionne : type concret ⊆ propriété avec oneOf
checker.isSubset(
  { type: "object", properties: { v: { type: "string" } }, required: ["v"] },
  {
    type: "object",
    properties: { v: { oneOf: [{ type: "string" }, { type: "number" }] } },
    required: ["v"],
  }
); // true

// ✅ Fonctionne : oneOf imbriqué dans les items de tableaux
checker.isSubset(
  {
    type: "object",
    properties: { items: { type: "array", items: { type: "string" } } },
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
); // true
```

> **Note** : Le fallback est activé automatiquement et uniquement quand le merge échoue. Il n'y a aucun overhead sur les schemas sans branching imbriqué grâce au guard `hasNestedBranching()`.