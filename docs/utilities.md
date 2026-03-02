# Fonctions utilitaires

En plus de la classe principale, la librairie exporte des fonctions utilitaires pour travailler avec les patterns regex.

```ts
import {
  isPatternSubset,
  arePatternsEquivalent,
  isTrivialPattern,
} from "json-schema-compatibility-checker";
```

---

## `isPatternSubset(sub, sup)`

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

## `arePatternsEquivalent(a, b)`

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

## `isTrivialPattern(pattern)`

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
