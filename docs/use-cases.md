# Cas d'usage concrets

## Sommaire

- [Connexion de nœuds dans un orchestrateur](#connexion-de-nœuds-dans-un-orchestrateur)
- [Validation de réponse API](#validation-de-réponse-api)
- [Union discriminée](#union-discriminée)
- [Formulaire conditionnel](#formulaire-conditionnel)
- [Validation partielle — données connues au design-time](#validation-partielle--données-connues-au-design-time)

---

## Connexion de nœuds dans un orchestrateur

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

const result = checker.check(nodeAOutput, nodeBInput);
console.log(result.isSubset);  // true ✅

// Si incompatible, le diagnostic explique pourquoi
if (!result.isSubset) {
  console.log(checker.formatResult("NodeA → NodeB", result));
}
```

---

## Validation de réponse API

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

const result = checker.check(apiResponse, consumerExpects);
console.log(result.isSubset); // true ✅
// L'API retourne plus de données que ce que le consommateur attend,
// mais TOUTES les données requises sont présentes et du bon type.
```

---

## Union discriminée

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

## Formulaire conditionnel

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
const result = checker.check(businessOutput, formSchema, {
  data: { accountType: "business" },
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

const personalResult = checker.check(personalOutput, formSchema, {
  data: { accountType: "personal" },
});
console.log(personalResult.isSubset);          // true ✅
console.log(personalResult.resolvedSup.branch); // "else"
```

---

## Validation partielle — données connues au design-time

Dans un orchestrateur, il est fréquent de connaître **certaines** valeurs de propriétés au moment du design (ex. un `accountId` sélectionné par l'utilisateur), tandis que les autres propriétés seront fournies par d'autres sources au runtime. On veut valider les valeurs connues (enum, format, contraintes custom) **sans** faux négatifs sur les propriétés manquantes.

Le mode `partial` résout ce problème : il supprime `required` et `additionalProperties` du schema avant la validation AJV, de sorte que seules les propriétés **présentes** dans `data` sont validées.

```ts
const checker = new JsonSchemaCompatibilityChecker({
  constraints: {
    AccountExists: async (value) => {
      const exists = await checkAccountInDatabase(value as string);
      return { valid: exists, message: "Account not found" };
    },
  },
});

const nodeInput = {
  type: "object",
  properties: {
    accountId: {
      type: "string",
      enum: ["acc-001", "acc-002", "acc-003"],
      constraints: ["AccountExists"],
    },
    meetingId: { type: "string" },
    extraField: { type: "number" },
  },
  required: ["accountId", "meetingId", "extraField"],
};

// Au design-time, seul accountId est connu.
// meetingId et extraField seront fournis par d'autres nœuds au runtime.
const partialData = { accountId: "acc-001" };
```

### Sans `partial` — faux négatifs sur les propriétés manquantes

```ts
const result = await checker.check(nodeInput, nodeInput, {
  data: partialData,
  validate: { sup: true },
});

console.log(result.errors);
// [
//   { key: "$sup.meetingId", expected: "meetingId: string", received: "undefined" },
//   { key: "$sup.extraField", expected: "extraField: number", received: "undefined" },
// ]
// ❌ Faux négatifs — meetingId et extraField ne sont pas encore disponibles
```

### Avec `partial: true` — validation des valeurs présentes uniquement

```ts
const result = await checker.check(nodeInput, nodeInput, {
  data: partialData,
  validate: { sup: { partial: true } },
});

console.log(result.isSubset); // true ✅
console.log(result.errors);   // []
// ✅ accountId est dans l'enum → OK
// ✅ La contrainte AccountExists est évaluée → OK
// ✅ meetingId et extraField absents → ignorés (mode partial)
```

### Données partielles avec valeur invalide

```ts
const result = await checker.check(nodeInput, nodeInput, {
  data: { accountId: "bad_value" },
  validate: { sup: { partial: true } },
});

console.log(result.errors);
// [
//   { key: "$sup.accountId", expected: "acc-001, acc-002, or acc-003", received: "bad_value" }
// ]
// ✅ Seule l'erreur enum pour la propriété présente
// ✅ Pas d'erreurs pour meetingId ou extraField
```

### Mode partial récursif — objets imbriqués

Le mode `partial` s'applique récursivement : les `required` et `additionalProperties` sont supprimés à **chaque niveau** de profondeur.

```ts
const schema = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        name: { type: "string" },
        role: { type: "string", enum: ["admin", "user"] },
      },
      required: ["name", "role"],
    },
    meetingId: { type: "string" },
  },
  required: ["user", "meetingId"],
};

const result = await checker.check(schema, schema, {
  data: { user: { role: "invalid_role" } },
  validate: { sup: { partial: true } },
});

console.log(result.errors);
// [
//   { key: "$sup.user.role", expected: "admin or user", received: "invalid_role" }
// ]
// ✅ meetingId manquant au root → pas vérifié
// ✅ user.name manquant dans l'objet imbriqué → pas vérifié
// ✅ user.role présent avec une valeur invalide → erreur rapportée
```

### Utilisation mixte — partial sur sup, full sur sub

On peut combiner le mode partial sur un target et le mode complet sur l'autre :

```ts
const result = await checker.check(sub, sup, {
  data: partialData,
  validate: {
    sub: true,                  // validation complète (required, additionalProperties)
    sup: { partial: true },     // validation partielle (uniquement les propriétés présentes)
  },
});
```
