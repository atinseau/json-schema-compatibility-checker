# Architecture interne

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
│  │Semantic Errors│                               │
│  │              │  ┌──────────────────────────┐  │
│  │-computeErrors│  │    Pattern Subset         │  │
│  │ - Recurse    │  │                          │  │
│  │ - Properties │  │ - isPatternSubset        │  │
│  └──────────────┘  │ - arePatternsEquivalent  │  │
│                     │ - isTrivialPattern       │  │
│  ┌──────────────┐  └──────────────────────────┘  │
│  │  Formatter    │                               │
│  │              │  ┌──────────────────────────┐  │
│  │ - formatResult│  │    Format Validator       │  │
│  │ - Error lines│  │                          │  │
│  └──────────────┘  │ - validateFormat         │  │
│                     │ - isFormatSubset         │  │
│  ┌──────────────┐  │ - Format hierarchy       │  │
│  │Data Narrowing │  └──────────────────────────┘  │
│  │              │                                │
│  │-narrowSchema │                                │
│  │ WithData     │                                │
│  │ - enum match │                                │
│  │ - Recurse    │                                │
│  └──────────────┘                                │
└──────────────────────────────────────────────────┘
```

---

## Flux de vérification `isSubset(sub, sup)`

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

---

## Dépendances

| Package | Usage |
|---|---|
| `@x0k/json-schema-merge` | Merge engine pour `allOf` resolution |
| `class-validator` | Validation des formats (email, URL, UUID, etc.) |
| `randexp` | Génération de strings pour le sampling de patterns |