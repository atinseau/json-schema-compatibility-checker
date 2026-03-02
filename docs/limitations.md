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