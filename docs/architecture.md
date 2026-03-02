# Architecture interne

La librairie est organisée en modules spécialisés, orchestrés par la façade `JsonSchemaCompatibilityChecker` et le `MergeEngine` :

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
│  │ - merge /    │  │ - Atomic: A∩B ≡ A ?     │  │
│  │   mergeOrThrow│  │ - Branched sub (anyOf)   │  │
│  │   (allOf ∩)  │  │ - Branched sup (anyOf)   │  │
│  │ - overlay    │  │ - evaluateNot            │  │
│  │   (deep spread│  │ - stripNotFromSup        │  │
│  │    last wins) │  │ - stripPatternFromSup    │  │
│  │ - Conflict   │  └──────────────────────────┘  │
│  │   detection  │                                │
│  │ - Compare    │  ┌──────────────────────────┐  │
│  └──────────────┘  │    Pattern Subset         │  │
│                     │                          │  │
│  ┌──────────────┐  │ - isPatternSubset        │  │
│  │Semantic Errors│  │ - arePatternsEquivalent  │  │
│  │              │  │ - isTrivialPattern       │  │
│  │-computeErrors│  └──────────────────────────┘  │
│  │ - Recurse    │                                │
│  │ - Properties │  ┌──────────────────────────┐  │
│  └──────────────┘  │    Format Validator       │  │
│                     │                          │  │
│  ┌──────────────┐  │ - validateFormat         │  │
│  │  Formatter    │  │ - isFormatSubset         │  │
│  │              │  │ - Format hierarchy       │  │
│  │ - formatResult│  └──────────────────────────┘  │
│  │ - Error lines│                                │
│  └──────────────┘                                │
│                                                  │
│  ┌──────────────┐                                │
│  │Data Narrowing │                               │
│  │              │                                │
│  │-narrowSchema │                                │
│  │ WithData     │                                │
│  │ - enum match │                                │
│  │ - Recurse    │                                │
│  └──────────────┘                                │
└──────────────────────────────────────────────────┘
```

---

## MergeEngine : deux opérations, deux sémantiques

Le `MergeEngine` expose deux opérations fondamentalement différentes pour combiner des schemas :

```
merge(A, B)  =  allOf([A, B])     Intersection ensembliste (commutative)
                                   → garde la contrainte la plus restrictive
                                   → utilisé en interne par le subset checker

overlay(base, override)            Deep spread séquentiel (NON commutative)
                                   → last writer wins par propriété
                                   → recurse dans les objets imbriqués
                                   → utilisé pour accumuler du contexte
```

### Quand utiliser quoi ?

```
Pipeline séquentiel (Node1 → Node2 → Node3) :
  context = overlay(overlay(node1.output, node2.output), node3.output)

Convergence de branches parallèles :
       ┌── Path A ──┐
  Start                 Merge ──→ merge(contextA, contextB)
       └── Path B ──┘

Vérification de compatibilité :
  sub ⊆ sup  ⟺  merge(sub, sup) ≡ sub
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

## Flux de `overlay(base, override)`

```
1. Boolean fast paths (false/true)
2. If either schema is not object-like → override replaces entirely
3. Both object-like:
   a. For each property in base: copy to result
   b. For each property in override:
      - If exists in base AND both are object-like → recurse overlay()
      - Otherwise → override replaces
   c. required = union(base.required, override.required)
   d. Object-level keywords: override wins if present, else base kept
```

---

## Dépendances

| Package | Usage |
|---|---|
| `@x0k/json-schema-merge` | Merge engine pour `allOf` resolution |
| `class-validator` | Validation des formats (email, URL, UUID, etc.) |
| `randexp` | Génération de strings pour le sampling de patterns |