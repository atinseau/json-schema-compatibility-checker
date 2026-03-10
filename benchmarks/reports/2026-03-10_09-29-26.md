# 📊 Benchmark Report

> Generated on **Tue, Mar 10, 2026 at 10:29:26**

## 🖥️ Environment

| Property | Value |
|:---------|:------|
| **Runtime** | bun |
| **CPU** | Apple M3 Max @ 3.88 GHz |
| **Arch** | arm64-darwin |
| **Benchmarks** | 350 across 10 files |

## Check Connection

> 📄 `check-connection.bench.ts` — 11 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `simple: empty ↔ empty (compatible)` | 7.34 ns | 6.75 ns | 10.97 ns | 51.2% | 136.29M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `simple: identical schemas (compatible)` | 7.46 ns | 6.91 ns | 11.78 ns | 54.2% | 134.04M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `simple: string value (compatible)` | 887.12 ns | 750.00 ns | 4.21 µs | 196.4% | 1.13M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `real-world: discriminated union → flexible input (compatible)` | 1.46 µs | 1.45 µs | 1.59 µs | 3.2% | 685.32K ops/s | `░░▒▒█▒▒░░░░░░░░░░░░░` |
| 🟡 | `real-world: paginated output → expected input (compatible)` | 1.91 µs | 1.90 µs | 2.03 µs | 2.4% | 523.70K ops/s | `░░░▒▒▒█▒▒░░░░░░░░░░░` |
| 🟡 | `real-world: webhook → strict event (incompatible)` | 2.07 µs | 1.92 µs | 2.77 µs | 16.3% | 483.21K ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` |
| 🟡 | `simple: type conflict (incompatible)` | 2.22 µs | 1.96 µs | 7.04 µs | 95.1% | 450.89K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `real-world: API response → expected input (compatible)` | 2.52 µs | 2.49 µs | 3.01 µs | 5.4% | 397.40K ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟡 | `order: strict output → loose input (compatible)` | 2.70 µs | 2.69 µs | 2.88 µs | 2.6% | 370.12K ops/s | `░░▒▒▒█▒▒░░░░░░░░░░░░` |
| 🟡 | `integration: closed output + format + not (compatible)` | 3.15 µs | 2.88 µs | 5.33 µs | 502.2% | 317.33K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `order: loose input → strict output (incompatible, reverse)` | 4.26 µs | 3.67 µs | 8.42 µs | 627.3% | 234.91K ops/s | `█░░░░░░░░░░░░░░░░░░░` |

> **Spread:** fastest `simple: empty ↔ empty (compatible)` is **580.2x** faster than slowest `order: loose input → strict output (incompatible, reverse)`

---

## Check Resolved

> 📄 `check-resolved.bench.ts` — 14 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟡 | `comparison: isSubset WITHOUT resolution (false negative)` | 2.27 µs | 2.09 µs | 3.32 µs | 16.2% | 440.95K ops/s | `░█▒▒░░░░░░░░░░░░░░░░` |
| 🟡 | `violating resolved branch (text → wrong type)` | 3.91 µs | 3.73 µs | 5.04 µs | 11.6% | 255.81K ops/s | `▒▒█▒░░░░░░░░░░░░░░░░` |
| 🟡 | `single data: else resolution` | 3.95 µs | 3.88 µs | 4.51 µs | 7.6% | 252.99K ops/s | `░▒▒▒▒▒█▒▒▒▒▒▒░░░░░░░` |
| 🟡 | `form: incomplete output ⊄ conditional form (missing required)` | 4.54 µs | 3.95 µs | 6.39 µs | 21.2% | 220.11K ops/s | `░▒█▒▒▒▒▒▒░░░░░░░░░░░` |
| 🟡 | `single data: then resolution` | 5.03 µs | 4.21 µs | 12.96 µs | 532.4% | 198.65K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `pattern: resolved sup adds pattern constraint` | 5.12 µs | 4.29 µs | 12.71 µs | 266.9% | 195.31K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `else-branch match (data → number)` | 6.44 µs | 5.50 µs | 14.58 µs | 574.4% | 155.37K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `then-branch match (text → string)` | 7.21 µs | 5.67 µs | 16.67 µs | 626.8% | 138.75K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `comparison: check WITH resolution (correct)` | 7.29 µs | 6.94 µs | 8.55 µs | 10.6% | 137.15K ops/s | `░░░▒▒█▒▒▒▒▒▒░░░░░░░░` |
| 🟡 | `sub with own conditions: both resolved` | 7.59 µs | 7.20 µs | 9.04 µs | 10.8% | 131.72K ops/s | `░▒▒▒█▒▒▒▒▒▒▒▒▒░░░░░░` |
| 🟠 | `nested: safe config (recursive resolution)` | 11.86 µs | 10.25 µs | 21.00 µs | 353.0% | 84.32K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟠 | `form: personal output ⊆ conditional form (resolved)` | 11.91 µs | 10.38 µs | 21.75 µs | 287.6% | 84.00K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟠 | `form: business output ⊆ conditional form (resolved)` | 12.57 µs | 10.83 µs | 22.75 µs | 289.0% | 79.57K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟠 | `allOf: multiple conditions in allOf resolved` | 14.01 µs | 12.17 µs | 26.54 µs | 263.8% | 71.39K ops/s | `█░░░░░░░░░░░░░░░░░░░` |

> **Spread:** fastest `comparison: isSubset WITHOUT resolution (false negative)` is **6.2x** faster than slowest `allOf: multiple conditions in allOf resolved`

---

## Check

> 📄 `check.bench.ts` — 21 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `formatResult: passing (✅)` | 21.77 ns | 21.52 ns | 27.03 ns | 18.3% | 45.94M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `formatResult: type clash (❌)` | 226.67 ns | 234.54 ns | 286.54 ns | 13.2% | 4.41M ops/s | `░░░░░▒▒▒█▒░░░░░░░░░░` |
| 🟢 | `formatResult: nested diffs (❌)` | 250.42 ns | 252.36 ns | 408.13 ns | 17.5% | 3.99M ops/s | `░▒▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `compatible: string (no diffs)` | 290.87 ns | 286.70 ns | 381.72 ns | 7.2% | 3.44M ops/s | `░░░█░░░░░░░░░░░░░░░░` |
| 🟢 | `formatResult: failing with diffs (❌)` | 384.25 ns | 391.84 ns | 469.27 ns | 11.4% | 2.60M ops/s | `░░░░▒▒▒▒▒█▒░░░░░░░░░` |
| 🟢 | `compatible: numeric range (no diffs)` | 395.73 ns | 392.66 ns | 484.95 ns | 6.1% | 2.53M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `incompatible: pattern added` | 688.02 ns | 629.38 ns | 1.80 µs | 27.0% | 1.45M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `incompatible: numeric constraint changes` | 833.64 ns | 720.70 ns | 1.73 µs | 31.4% | 1.20M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `compatible: object (no diffs)` | 877.74 ns | 875.82 ns | 972.15 ns | 2.9% | 1.14M ops/s | `░░░░░▒█▒░░░░░░░░░░░░` |
| 🟡 | `incompatible: conflicting types → null merge` | 1.19 µs | 1.17 µs | 1.33 µs | 4.1% | 842.88K ops/s | `░░░░█▒▒▒░░░░░░░░░░░░` |
| 🟡 | `incompatible: enum changes` | 1.34 µs | 1.18 µs | 2.63 µs | 29.7% | 743.73K ops/s | `░█▒▒░░░░░░░░░░░░░░░░` |
| 🟡 | `incompatible: missing required (diffs)` | 1.69 µs | 1.59 µs | 3.32 µs | 20.9% | 591.20K ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `incompatible: multiple diffs reported` | 1.78 µs | 1.67 µs | 3.81 µs | 22.5% | 563.14K ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `incompatible: additionalProperties constraint` | 2.08 µs | 2.00 µs | 3.37 µs | 15.7% | 481.19K ops/s | `░░█▒░░░░░░░░░░░░░░░░` |
| 🟡 | `incompatible: anyOf no matching branch` | 2.29 µs | 2.29 µs | 2.41 µs | 3.7% | 437.22K ops/s | `░░░░░░░░░░▒▒▒█▒▒▒░░░` |
| 🟡 | `real-world: webhook payload ⊄ strict event (incompatible)` | 2.46 µs | 2.32 µs | 3.86 µs | 16.1% | 406.29K ops/s | `░▒█▒░░░░░░░░░░░░░░░░` |
| 🟡 | `real-world: API response ⊆ expected input (compatible)` | 3.00 µs | 2.94 µs | 3.40 µs | 4.9% | 333.08K ops/s | `░░░▒█▒▒▒▒░░░░░░░░░░░` |
| 🟡 | `incompatible: nested object diffs (3 levels)` | 4.22 µs | 3.95 µs | 5.54 µs | 12.8% | 236.78K ops/s | `░▒█▒▒▒▒▒▒▒░░░░░░░░░░` |
| 🟡 | `incompatible: anyOf branch rejection` | 4.34 µs | 4.34 µs | 4.44 µs | 1.4% | 230.17K ops/s | `░░░░░░▒▒█▒▒▒░░░░░░░░` |
| 🟡 | `incompatible: oneOf extra branch` | 4.34 µs | 4.39 µs | 4.51 µs | 3.4% | 230.17K ops/s | `░░░░░░░░▒▒▒▒▒█▒▒░░░░` |
| 🟡 | `incompatible: deep nesting diffs (3 levels)` | 4.73 µs | 4.72 µs | 5.84 µs | 10.5% | 211.27K ops/s | `░░░▒▒▒▒█▒░░░░░░░░░░░` |

> **Spread:** fastest `formatResult: passing (✅)` is **217.4x** faster than slowest `incompatible: deep nesting diffs (3 levels)`

---

## Intersect

> 📄 `intersect.bench.ts` — 76 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `boolean: false ∩ false → false` | 6.68 ns | 6.63 ns | 8.53 ns | 11.6% | 149.67M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean: true ∩ true` | 6.70 ns | 6.63 ns | 8.71 ns | 11.8% | 149.35M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `idempotent: schema ∩ itself` | 7.91 ns | 7.82 ns | 9.89 ns | 6.4% | 126.50M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: same value → preserved` | 31.05 ns | 30.78 ns | 37.30 ns | 6.3% | 32.20M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: same format → preserved` | 38.77 ns | 38.25 ns | 58.49 ns | 14.1% | 25.79M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean: false ∩ schema → false` | 70.55 ns | 68.96 ns | 99.19 ns | 12.8% | 14.18M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: different → null` | 80.76 ns | 80.50 ns | 91.50 ns | 3.4% | 12.38M ops/s | `░░░░█░░░░░░░░░░░░░░░` |
| 🟢 | `boolean: true ∩ false → false` | 88.73 ns | 84.99 ns | 162.26 ns | 16.7% | 11.27M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean: true ∩ schema → schema` | 117.20 ns | 114.12 ns | 162.36 ns | 9.4% | 8.53M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: incompatible → null` | 137.75 ns | 133.69 ns | 217.05 ns | 13.5% | 7.26M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `empty: {} ∩ {} → {}` | 172.27 ns | 142.15 ns | 642.05 ns | 220.4% | 5.80M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `object: closed + extra required → null` | 240.99 ns | 240.30 ns | 296.48 ns | 8.2% | 4.15M ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` |
| 🟢 | `string: format + plain` | 251.11 ns | 249.85 ns | 279.28 ns | 4.0% | 3.98M ops/s | `░░░█░░░░░░░░░░░░░░░░` |
| 🟢 | `const: compatible type → const + type` | 259.82 ns | 258.15 ns | 297.01 ns | 3.8% | 3.85M ops/s | `░░░█░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: multipleOf from one side only` | 279.14 ns | 255.41 ns | 522.34 ns | 22.0% | 3.58M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `array: uniqueItems true wins` | 282.99 ns | 280.51 ns | 334.42 ns | 6.0% | 3.53M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `type: integer ∩ number → integer` | 296.84 ns | 273.31 ns | 538.69 ns | 21.6% | 3.37M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type: number ∩ integer → integer (commutative)` | 299.30 ns | 298.94 ns | 325.27 ns | 3.0% | 3.34M ops/s | `░░░░█░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: multipleOf(6) ∩ multipleOf(3)` | 330.19 ns | 307.26 ns | 546.65 ns | 17.4% | 3.03M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: tighter minimum wins` | 337.61 ns | 336.74 ns | 363.07 ns | 3.0% | 2.96M ops/s | `░░░░█░░░░░░░░░░░░░░░` |
| 🟢 | `type array: multi ∩ single` | 339.91 ns | 335.00 ns | 426.25 ns | 7.3% | 2.94M ops/s | `░░▒▒█░░░░░░░░░░░░░░░` |
| 🟢 | `empty: {} ∩ typed → typed` | 341.52 ns | 310.33 ns | 832.52 ns | 69.7% | 2.93M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `string: tighter minLength wins` | 346.98 ns | 346.50 ns | 376.43 ns | 2.8% | 2.88M ops/s | `░░░░▒█░░░░░░░░░░░░░░` |
| 🟢 | `string: tighter maxLength wins` | 350.37 ns | 349.38 ns | 385.65 ns | 2.9% | 2.85M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: exclusiveMaximum tighter wins` | 364.35 ns | 341.47 ns | 572.05 ns | 16.2% | 2.74M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: tighter maximum wins` | 367.68 ns | 344.72 ns | 578.47 ns | 16.3% | 2.72M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: compatible ranges` | 369.69 ns | 362.30 ns | 477.99 ns | 6.6% | 2.70M ops/s | `░░░█░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: exclusiveMinimum tighter wins` | 373.98 ns | 347.95 ns | 595.54 ns | 16.8% | 2.67M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `array: maxItems tighter wins` | 377.18 ns | 375.72 ns | 420.47 ns | 4.9% | 2.65M ops/s | `░░░░▒█▒░░░░░░░░░░░░░` |
| 🟢 | `minProperties: tighter wins` | 377.50 ns | 376.16 ns | 419.26 ns | 4.6% | 2.65M ops/s | `░░░▒█▒░░░░░░░░░░░░░░` |
| 🟢 | `maxProperties: tighter wins` | 380.41 ns | 377.13 ns | 422.95 ns | 4.1% | 2.63M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `array: minItems tighter wins` | 384.77 ns | 379.81 ns | 498.26 ns | 6.6% | 2.60M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `string: pattern + minLength` | 424.89 ns | 387.18 ns | 901.49 ns | 55.4% | 2.35M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `string: minLength + maxLength` | 425.06 ns | 394.83 ns | 2.00 µs | 43.9% | 2.35M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: min from one + max from other` | 431.73 ns | 401.42 ns | 2.03 µs | 44.3% | 2.32M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `commutativity: numeric A∩B` | 432.83 ns | 428.10 ns | 518.36 ns | 5.4% | 2.31M ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` |
| 🟢 | `string: all keywords combined` | 438.06 ns | 407.42 ns | 2.12 µs | 46.2% | 2.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const ∩ enum containing const` | 438.37 ns | 401.16 ns | 892.27 ns | 45.4% | 2.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type array: common types preserved` | 444.28 ns | 436.70 ns | 561.27 ns | 7.1% | 2.25M ops/s | `░░▒█▒░░░░░░░░░░░░░░░` |
| 🟢 | `logical: not preserved through merge` | 455.21 ns | 409.91 ns | 948.42 ns | 60.9% | 2.20M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `commutativity: numeric B∩A` | 458.67 ns | 457.56 ns | 522.29 ns | 4.4% | 2.18M ops/s | `░░░░░▒▒█░░░░░░░░░░░░` |
| 🟢 | `numeric: exclusiveMin + minimum (both kept)` | 465.96 ns | 401.87 ns | 969.81 ns | 51.9% | 2.15M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `logical: anyOf ∩ compatible type` | 474.63 ns | 416.85 ns | 1.02 µs | 54.2% | 2.11M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: one format + constraints` | 485.22 ns | 449.21 ns | 1.04 µs | 54.4% | 2.06M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `commutativity: string A∩B` | 506.34 ns | 474.17 ns | 801.73 ns | 39.2% | 1.97M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `array: items + constraints from other` | 507.20 ns | 463.02 ns | 1.11 µs | 49.8% | 1.97M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: multipleOf(6) ∩ multipleOf(4) → LCM` | 512.00 ns | 439.04 ns | 960.75 ns | 44.2% | 1.95M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `commutativity: string B∩A` | 518.05 ns | 476.81 ns | 1.11 µs | 40.0% | 1.93M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `object: required union` | 566.19 ns | 531.99 ns | 2.01 µs | 33.4% | 1.77M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `contains: schemas merged` | 594.42 ns | 589.13 ns | 712.92 ns | 4.9% | 1.68M ops/s | `░░░░▒█▒░░░░░░░░░░░░░` |
| 🟢 | `array: items schemas merged` | 614.35 ns | 608.87 ns | 755.00 ns | 5.5% | 1.63M ops/s | `░░░▒▒█░░░░░░░░░░░░░░` |
| 🟢 | `dependencies: disjoint keys → both kept` | 614.81 ns | 564.70 ns | 1.20 µs | 39.1% | 1.63M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `logical: allOf flattened into merge` | 644.93 ns | 604.02 ns | 977.10 ns | 31.9% | 1.55M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: large overlap` | 691.46 ns | 652.74 ns | 1.05 µs | 25.6% | 1.45M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `object: additionalProperties false ∩ true` | 699.83 ns | 698.21 ns | 825.34 ns | 5.3% | 1.43M ops/s | `░░░░░▒█░░░░░░░░░░░░░` |
| 🟢 | `commutativity: enum B∩A` | 727.29 ns | 679.81 ns | 948.52 ns | 24.5% | 1.37M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `object: overlapping property merged` | 729.84 ns | 716.86 ns | 828.09 ns | 4.2% | 1.37M ops/s | `░░░░░█▒▒░░░░░░░░░░░░` |
| 🟢 | `patternProperties: different patterns → both kept` | 734.96 ns | 692.21 ns | 1.96 µs | 24.2% | 1.36M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: overlapping → common values` | 737.43 ns | 713.33 ns | 979.42 ns | 22.5% | 1.36M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: commutative check` | 737.90 ns | 695.05 ns | 1.02 µs | 22.6% | 1.36M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `commutativity: enum A∩B` | 742.47 ns | 688.05 ns | 1.05 µs | 20.2% | 1.35M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `dependencies: array form merged` | 754.01 ns | 701.35 ns | 1.13 µs | 26.2% | 1.33M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `object: disjoint properties combined` | 773.88 ns | 725.02 ns | 1.87 µs | 22.9% | 1.29M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `object: additionalProperties schema ∩ schema` | 862.90 ns | 862.09 ns | 962.26 ns | 4.5% | 1.16M ops/s | `░░░░░░▒▒▒█▒░░░░░░░░░` |
| 🟢 | `array: tuple items merged by index` | 928.71 ns | 921.73 ns | 1.07 µs | 5.4% | 1.08M ops/s | `░░░░░░▒▒█▒░░░░░░░░░░` |
| 🟢 | `commutativity: object B∩A` | 945.66 ns | 899.69 ns | 2.25 µs | 21.1% | 1.06M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `commutativity: object A∩B` | 963.64 ns | 915.14 ns | 1.42 µs | 19.3% | 1.04M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `const: incompatible type → null` | 1.02 µs | 1.02 µs | 1.08 µs | 2.4% | 982.52K ops/s | `░░░▒▒▒▒█▒░░░░░░░░░░░` |
| 🟡 | `type: incompatible (string ∩ number) → null` | 1.04 µs | 1.04 µs | 1.08 µs | 2.0% | 962.35K ops/s | `░░░░░░▒▒█▒▒░░░░░░░░░` |
| 🟡 | `dependencies: schema form merged` | 1.13 µs | 1.08 µs | 2.69 µs | 24.4% | 885.17K ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟡 | `patternProperties: same pattern → merged` | 1.19 µs | 1.11 µs | 2.73 µs | 23.6% | 843.56K ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `type array: disjoint → null` | 1.30 µs | 1.29 µs | 1.48 µs | 6.1% | 767.68K ops/s | `░░░▒▒█▒▒░░░░░░░░░░░░` |
| 🟡 | `enum: disjoint → null` | 1.36 µs | 1.37 µs | 1.42 µs | 2.4% | 735.57K ops/s | `░░░░▒▒▒▒▒█▒░░░░░░░░░` |
| 🟡 | `complex: array of typed objects` | 1.37 µs | 1.26 µs | 2.15 µs | 31.6% | 730.31K ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `complex: full object merge` | 1.63 µs | 1.54 µs | 3.32 µs | 20.1% | 613.71K ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟡 | `complex: nested objects both contribute` | 2.20 µs | 2.12 µs | 3.82 µs | 17.0% | 453.71K ops/s | `░▒█░░░░░░░░░░░░░░░░░` |

> **Spread:** fastest `boolean: false ∩ false → false` is **329.9x** faster than slowest `complex: nested objects both contribute`

---

## Is Equal

> 📄 `is-equal.bench.ts` — 20 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `identical: empty schemas` | 13.62 ns | 12.67 ns | 17.22 ns | 15.0% | 73.42M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identical: boolean true === true` | 23.13 ns | 22.75 ns | 28.40 ns | 7.3% | 43.23M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `different: boolean true vs false` | 25.07 ns | 24.89 ns | 33.42 ns | 9.1% | 39.89M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `normalization: pre-normalized values` | 78.19 ns | 76.49 ns | 104.96 ns | 9.5% | 12.79M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: identical` | 80.33 ns | 78.32 ns | 106.36 ns | 11.6% | 12.45M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `different: string vs number` | 81.20 ns | 77.95 ns | 106.64 ns | 12.6% | 12.31M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `normalization: const vs const+type (equal after normalize)` | 82.58 ns | 79.13 ns | 120.49 ns | 13.0% | 12.11M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identical: same reference` | 84.94 ns | 82.02 ns | 113.45 ns | 12.9% | 11.77M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: different` | 92.58 ns | 90.68 ns | 117.03 ns | 9.3% | 10.80M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `different: extra property` | 111.79 ns | 109.73 ns | 134.95 ns | 7.3% | 8.95M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: identical (5 values)` | 125.77 ns | 124.47 ns | 152.33 ns | 5.1% | 7.95M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: different (last value differs)` | 141.99 ns | 139.52 ns | 170.33 ns | 8.0% | 7.04M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `propertyNames: identical` | 165.51 ns | 153.60 ns | 379.38 ns | 25.4% | 6.04M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `different: required mismatch` | 227.41 ns | 221.78 ns | 343.37 ns | 11.1% | 4.40M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `anyOf: identical branches` | 244.11 ns | 237.32 ns | 335.74 ns | 8.6% | 4.10M ops/s | `░░▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `identical: different references (simple)` | 249.75 ns | 243.94 ns | 335.04 ns | 7.8% | 4.00M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `patternProperties: identical` | 294.78 ns | 289.60 ns | 375.16 ns | 6.4% | 3.39M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `oneOf: identical discriminated union` | 632.85 ns | 627.32 ns | 728.37 ns | 3.3% | 1.58M ops/s | `░░░░█░░░░░░░░░░░░░░░` |
| 🟢 | `deeply nested: identical 4-level schemas` | 832.43 ns | 760.35 ns | 1.48 µs | 22.2% | 1.20M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `complex: identical complex schemas` | 1.27 µs | 1.25 µs | 1.40 µs | 4.1% | 785.75K ops/s | `░▒▒█▒▒▒░░░░░░░░░░░░░` |

> **Spread:** fastest `identical: empty schemas` is **93.4x** faster than slowest `complex: identical complex schemas`

---

## Is Subset

> 📄 `is-subset.bench.ts` — 55 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `boolean: false ⊆ false` | 0.27 ns | 0.18 ns | 3.03 ns | 181.2% | 3671.36M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean: true ⊆ true` | 0.56 ns | 0.18 ns | 3.35 ns | 176.6% | 1776.61M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type: string ⊆ string (true)` | 1.65 ns | 1.90 ns | 2.47 ns | 23.6% | 606.35M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `identity: A ⊆ A (simple object)` | 2.41 ns | 2.30 ns | 3.77 ns | 74.0% | 415.38M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identity: A ⊆ A (complex schema)` | 2.47 ns | 2.27 ns | 4.97 ns | 61.4% | 405.17M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `empty: {} ⊆ {}` | 25.22 ns | 22.69 ns | 71.86 ns | 38.2% | 39.65M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean: false ⊆ true` | 95.09 ns | 79.03 ns | 273.84 ns | 46.0% | 10.52M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `not: number ⊆ not(string) (true)` | 163.11 ns | 172.78 ns | 229.91 ns | 16.1% | 6.13M ops/s | `░▒▒▒▒▒█░░░░░░░░░░░░░` |
| 🟢 | `any schema ⊆ true (true)` | 169.03 ns | 139.12 ns | 333.00 ns | 34.4% | 5.92M ops/s | `▒█▒░░░░░░░░░░░░░░░░░` |
| 🟢 | `true ⊄ concrete schema (false)` | 191.65 ns | 179.01 ns | 336.12 ns | 18.0% | 5.22M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `type: integer ⊆ number (true)` | 317.48 ns | 310.10 ns | 385.58 ns | 5.8% | 3.15M ops/s | `░░░█▒▒░░░░░░░░░░░░░░` |
| 🟢 | `const number ⊆ type number (true)` | 349.51 ns | 347.56 ns | 374.10 ns | 2.4% | 2.86M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `not: string+not(const) ⊆ string (true)` | 351.86 ns | 347.73 ns | 395.97 ns | 4.2% | 2.84M ops/s | `░░▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `const string ⊆ type string (true)` | 354.49 ns | 351.90 ns | 386.21 ns | 3.2% | 2.82M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: email ⊆ string (true)` | 357.13 ns | 352.77 ns | 429.98 ns | 5.5% | 2.80M ops/s | `░░░█▒░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: multipleOf(6) ⊆ multipleOf(3) (true)` | 390.45 ns | 381.61 ns | 484.77 ns | 7.1% | 2.56M ops/s | `░░▒█▒░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: exclusiveMin 5 ⊆ exclusiveMin 0 (true)` | 406.77 ns | 403.28 ns | 516.74 ns | 6.6% | 2.46M ops/s | `░░▒▒█░░░░░░░░░░░░░░░` |
| 🟢 | `format: uri ⊆ iri (true)` | 438.36 ns | 431.11 ns | 508.15 ns | 4.4% | 2.28M ops/s | `░░▒█▒░░░░░░░░░░░░░░░` |
| 🟢 | `string: strict ⊆ loose (true)` | 458.05 ns | 457.19 ns | 600.94 ns | 6.9% | 2.18M ops/s | `░░░▒▒█░░░░░░░░░░░░░░` |
| 🟢 | `format: email ⊆ idn-email (true)` | 459.04 ns | 452.66 ns | 548.19 ns | 3.8% | 2.18M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: strict [5,10] ⊆ loose [0,100] (true)` | 460.58 ns | 449.35 ns | 550.56 ns | 6.6% | 2.17M ops/s | `░▒▒█▒▒░░░░░░░░░░░░░░` |
| 🟢 | `type: number ⊄ integer (false)` | 540.95 ns | 513.90 ns | 1.04 µs | 35.3% | 1.85M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `array: uniqueItems ⊆ no uniqueItems (true)` | 554.47 ns | 542.69 ns | 624.58 ns | 3.9% | 1.80M ops/s | `░█▒▒▒░░░░░░░░░░░░░░░` |
| 🟢 | `atomic ⊆ anyOf matching (true)` | 555.53 ns | 481.22 ns | 1.60 µs | 83.8% | 1.80M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `array: strict ⊆ loose (true)` | 593.58 ns | 581.49 ns | 747.43 ns | 6.4% | 1.68M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `contains: strict ⊆ loose (true)` | 602.69 ns | 599.32 ns | 661.57 ns | 2.8% | 1.66M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `format: string ⊄ email (false)` | 719.63 ns | 603.59 ns | 1.46 µs | 41.2% | 1.39M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: single value ⊆ type (true)` | 725.26 ns | 669.96 ns | 1.43 µs | 30.3% | 1.38M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: multipleOf(3) ⊄ multipleOf(6) (false)` | 737.15 ns | 709.04 ns | 1.08 µs | 13.8% | 1.36M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `string: loose ⊄ strict (false)` | 739.19 ns | 702.67 ns | 1.03 µs | 24.8% | 1.35M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `numeric: loose [0,100] ⊄ strict [5,10] (false)` | 740.41 ns | 714.74 ns | 974.36 ns | 18.7% | 1.35M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type array: [string] ⊆ [string,null] (true)` | 774.16 ns | 703.33 ns | 1.24 µs | 48.9% | 1.29M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type array: [string,number] ⊄ [string] (false)` | 778.97 ns | 709.98 ns | 1.26 µs | 47.7% | 1.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type array: [string,null] ⊄ [string] (false)` | 784.07 ns | 708.00 ns | 1.30 µs | 47.9% | 1.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `type array: [string] ⊆ [string,number] (true)` | 785.24 ns | 698.17 ns | 1.40 µs | 46.2% | 1.27M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: small ⊆ large (true)` | 805.18 ns | 716.73 ns | 1.27 µs | 21.4% | 1.24M ops/s | `░▒█▒▒▒░░░░░░░░░░░░░░` |
| 🟡 | `required: more ⊆ less (true)` | 1.04 µs | 1.02 µs | 1.21 µs | 6.4% | 965.48K ops/s | `░░▒▒█▒▒▒░░░░░░░░░░░░` |
| 🟡 | `type: string ⊄ number (false)` | 1.18 µs | 1.19 µs | 1.28 µs | 3.7% | 844.04K ops/s | `░░░░▒▒▒▒▒█▒▒░░░░░░░░` |
| 🟡 | `array: loose ⊄ strict (false)` | 1.20 µs | 1.15 µs | 1.57 µs | 21.6% | 831.45K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `const string ⊄ type number (false)` | 1.26 µs | 1.20 µs | 1.58 µs | 10.2% | 792.61K ops/s | `░▒▒█▒▒▒░░░░░░░░░░░░░` |
| 🟡 | `additionalProps: closed ⊆ open (true)` | 1.35 µs | 1.34 µs | 1.50 µs | 4.9% | 742.54K ops/s | `░░░░░▒▒█▒▒░░░░░░░░░░` |
| 🟡 | `enum: large ⊄ small (false)` | 1.38 µs | 1.19 µs | 2.36 µs | 28.0% | 726.04K ops/s | `░█▒▒▒░░░░░░░░░░░░░░░` |
| 🟡 | `required: less ⊄ more (false)` | 1.81 µs | 1.73 µs | 2.36 µs | 23.0% | 551.05K ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟡 | `anyOf: sub ⊆ sup (true)` | 1.86 µs | 1.85 µs | 2.09 µs | 3.5% | 536.80K ops/s | `░░▒█▒░░░░░░░░░░░░░░░` |
| 🟡 | `deep 3-level: strict ⊆ loose (true)` | 2.59 µs | 2.58 µs | 2.85 µs | 6.3% | 385.65K ops/s | `░░░░░░░░░▒▒█▒▒▒░░░░░` |
| 🟡 | `additionalProps: open ⊄ closed (false)` | 2.69 µs | 2.32 µs | 4.68 µs | 29.3% | 372.23K ops/s | `░▒█▒▒▒▒▒░░░░░░░░░░░░` |
| 🟡 | `atomic ⊄ anyOf no match (false)` | 2.99 µs | 2.86 µs | 3.67 µs | 10.0% | 334.99K ops/s | `░░░░▒█▒▒▒░░░░░░░░░░░` |
| 🟡 | `deep 4-level: strict ⊆ loose (true)` | 2.99 µs | 3.08 µs | 3.21 µs | 5.5% | 334.66K ops/s | `░░░▒▒▒▒▒▒▒▒▒▒█░░░░░░` |
| 🟡 | `deep 5-level: strict ⊆ loose (true)` | 3.71 µs | 3.74 µs | 3.94 µs | 3.8% | 269.66K ops/s | `░░░░░░░░░░░▒▒▒█░░░░░` |
| 🟡 | `anyOf: sup ⊄ sub (false)` | 4.07 µs | 4.10 µs | 4.24 µs | 3.2% | 245.93K ops/s | `░░░░░░░░▒▒▒▒█▒░░░░░░` |
| 🟡 | `deep 3-level: loose ⊄ strict (false)` | 4.36 µs | 4.23 µs | 5.12 µs | 12.1% | 229.19K ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟡 | `oneOf discriminated ⊆ oneOf loose (true)` | 5.37 µs | 5.34 µs | 5.59 µs | 2.4% | 186.36K ops/s | `░░░░░░░▒▒█▒▒▒░░░░░░░` |
| 🟡 | `wide 20-prop schema vs 15-prop` | 6.07 µs | 5.96 µs | 6.46 µs | 3.5% | 164.86K ops/s | `░░▒▒█▒▒▒▒▒▒▒░░░░░░░░` |
| 🟡 | `deep 5-level: loose ⊄ strict (false)` | 6.42 µs | 5.84 µs | 8.85 µs | 20.3% | 155.83K ops/s | `░▒▒█▒▒░░░░░░░░░░░░░░` |
| 🟠 | `wide 15-prop schema vs 20-prop` | 10.60 µs | 9.53 µs | 12.73 µs | 18.5% | 94.36K ops/s | `▒▒▒█▒▒▒▒▒▒▒▒░░░░░░░░` |

> **Spread:** fastest `boolean: false ⊆ false` is **38908.2x** faster than slowest `wide 15-prop schema vs 20-prop`

---

## Normalize

> 📄 `normalize.bench.ts` — 27 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `const: number` | 2.89 ns | 2.85 ns | 3.61 ns | 6.6% | 346.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: integer` | 2.99 ns | 2.88 ns | 5.47 ns | 13.4% | 334.14M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: string` | 3.14 ns | 3.09 ns | 4.04 ns | 7.4% | 318.49M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: boolean` | 3.28 ns | 2.99 ns | 5.87 ns | 22.9% | 304.73M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean schema: false` | 3.84 ns | 3.81 ns | 4.60 ns | 5.9% | 260.68M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: homogeneous [1,2,3]` | 3.95 ns | 3.57 ns | 7.80 ns | 36.4% | 253.29M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `boolean schema: true` | 4.25 ns | 4.23 ns | 4.94 ns | 3.6% | 235.14M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: object` | 4.37 ns | 3.58 ns | 6.87 ns | 32.9% | 228.72M ops/s | `▒█▒▒▒▒▒░░░░░░░░░░░░░` |
| 🟢 | `tuple items (3 const values)` | 5.32 ns | 5.29 ns | 6.32 ns | 5.0% | 188.00M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `propertyNames (double negation)` | 5.32 ns | 5.28 ns | 6.29 ns | 3.6% | 187.96M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `complex schema (all keywords)` | 5.32 ns | 5.29 ns | 6.31 ns | 3.6% | 187.96M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `deeply nested (4 levels)` | 5.32 ns | 5.29 ns | 6.28 ns | 3.3% | 187.95M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `contains (const)` | 5.32 ns | 5.29 ns | 6.30 ns | 3.6% | 187.93M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `oneOf branches (3 const)` | 5.32 ns | 5.29 ns | 6.44 ns | 4.5% | 187.90M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `additionalProperties (const)` | 5.33 ns | 5.29 ns | 6.32 ns | 4.1% | 187.76M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `double negation not(not(X))` | 5.33 ns | 5.29 ns | 6.38 ns | 3.5% | 187.50M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `anyOf branches (3 const)` | 5.35 ns | 5.30 ns | 6.43 ns | 4.0% | 187.01M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const + enum (const ∈ enum)` | 5.37 ns | 5.30 ns | 6.44 ns | 4.5% | 186.33M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `patternProperties (2 patterns)` | 5.38 ns | 5.30 ns | 6.51 ns | 6.2% | 185.96M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `array items (single const)` | 5.40 ns | 5.38 ns | 6.40 ns | 5.1% | 185.16M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `triple negation not(not(not(X)))` | 5.57 ns | 5.53 ns | 6.54 ns | 3.7% | 179.59M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const + enum (const ∉ enum)` | 5.57 ns | 5.53 ns | 6.56 ns | 3.6% | 179.53M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `enum: heterogeneous ['a',1,true,null]` | 5.58 ns | 5.54 ns | 6.64 ns | 4.2% | 179.16M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `nested properties (3 const/enum props)` | 5.84 ns | 5.81 ns | 6.86 ns | 4.5% | 171.15M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `simple string (no inference)` | 6.15 ns | 6.08 ns | 7.28 ns | 3.8% | 162.68M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: array` | 6.52 ns | 6.39 ns | 7.85 ns | 18.2% | 153.42M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `const: null` | 6.83 ns | 6.78 ns | 8.09 ns | 5.2% | 146.40M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |

> **Spread:** fastest `const: number` is **2.4x** faster than slowest `const: null`

---

## Pattern Subset

> 📄 `pattern-subset.bench.ts` — 40 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `equivalent: identical patterns` | 0.07 ns | 0.07 ns | 0.09 ns | 122.0% | 13479.45M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identity: identical simple pattern` | 0.08 ns | 0.07 ns | 0.09 ns | 145.2% | 13279.76M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identity: identical complex pattern` | 0.08 ns | 0.07 ns | 0.09 ns | 214.4% | 12111.80M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `trivial: empty string` | 8.04 ns | 7.88 ns | 10.19 ns | 6.9% | 124.39M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `non-trivial: abc` | 8.32 ns | 8.29 ns | 9.69 ns | 4.6% | 120.26M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: literal ⊆ class (^abc$ ⊆ ^[a-z]+$)` | 8.37 ns | 7.63 ns | 49.35 ns | 65.0% | 119.46M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `exclusion: letters ⊄ digits` | 8.46 ns | 7.68 ns | 50.54 ns | 66.8% | 118.25M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `sample count: default (^[a-z]{3}$ ⊆ ^[a-z]+$)` | 8.58 ns | 7.77 ns | 49.88 ns | 66.5% | 116.54M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: any ⊆ .* (universal)` | 8.66 ns | 7.78 ns | 51.72 ns | 68.5% | 115.43M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `non-trivial: ^[a-z]+$` | 12.58 ns | 12.45 ns | 15.41 ns | 5.6% | 79.50M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `non-equivalent: different cardinality` | 13.16 ns | 8.09 ns | 53.61 ns | 104.8% | 75.97M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `non-trivial: ^[0-9]{3}$` | 14.15 ns | 14.05 ns | 16.29 ns | 3.4% | 70.65M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `trivial: .+ (non-empty universal)` | 14.61 ns | 13.67 ns | 17.98 ns | 8.9% | 68.45M ops/s | `░█▒░░░░░░░░░░░░░░░░░` |
| 🟢 | `trivial: (?:.*) (group universal)` | 15.01 ns | 14.79 ns | 17.87 ns | 4.9% | 66.63M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: any ⊆ .+ (non-empty universal)` | 15.35 ns | 7.83 ns | 78.86 ns | 124.1% | 65.13M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `trivial: ^.*$ (anchored universal)` | 16.86 ns | 16.60 ns | 20.20 ns | 6.1% | 59.32M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `sample count: low (50)` | 18.99 ns | 7.69 ns | 103.06 ns | 138.1% | 52.65M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `trivial: .* (universal)` | 19.03 ns | 18.88 ns | 24.26 ns | 9.0% | 52.55M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `exclusion: digits ⊄ letters` | 19.36 ns | 7.73 ns | 104.95 ns | 138.0% | 51.64M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `batch: 5 non-trivial patterns` | 31.44 ns | 31.18 ns | 34.67 ns | 3.7% | 31.81M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `exclusion: uppercase ⊄ lowercase` | 42.44 ns | 42.68 ns | 50.19 ns | 7.0% | 23.56M ops/s | `░░▒▒▒█░░░░░░░░░░░░░░` |
| 🟢 | `exclusion: wider range ⊄ narrower` | 43.08 ns | 40.93 ns | 61.05 ns | 13.4% | 23.21M ops/s | `░░▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `non-equivalent: disjoint character sets` | 47.66 ns | 48.24 ns | 57.15 ns | 12.1% | 20.98M ops/s | `░░░░▒▒█▒▒░░░░░░░░░░░` |
| 🟢 | `exclusion: alphanumeric ⊄ digits only` | 51.72 ns | 48.44 ns | 64.08 ns | 10.8% | 19.33M ops/s | `░░░░░▒█▒▒▒▒░░░░░░░░░` |
| 🟢 | `batch: 10 trivial patterns` | 60.34 ns | 59.84 ns | 64.94 ns | 3.0% | 16.57M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `sample count: high (500)` | 61.29 ns | 42.00 ns | 334.00 ns | 153.3% | 16.32M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `exclusion: unbounded ⊄ fixed` | 62.48 ns | 55.00 ns | 113.76 ns | 33.6% | 16.01M ops/s | `░░▒▒█▒▒▒░░░░░░░░░░░░` |
| 🟢 | `inclusion: email-like ⊆ contains-@` | 64.58 ns | 42.00 ns | 417.00 ns | 205.7% | 15.49M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: fixed quant ⊆ unbounded (^[a-z]{3}$ ⊆ ^[a-z]+$)` | 68.47 ns | 42.00 ns | 458.00 ns | 276.5% | 14.60M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: anchored prefix ⊆ partial (^[A-Z]{2}[0-9]{3}$ ⊆ ^[A-Z])` | 95.20 ns | 42.00 ns | 500.00 ns | 186.1% | 10.50M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `non-equivalent: asymmetric inclusion (subset not equivalence)` | 99.60 ns | 94.01 ns | 123.89 ns | 11.7% | 10.04M ops/s | `░░░░░░▒█▒▒▒▒▒░░░░░░░` |
| 🟢 | `realistic: SKU format ⊆ alphanumeric-dash` | 110.17 ns | 83.00 ns | 500.00 ns | 134.1% | 9.08M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: digits ⊆ alphanumeric` | 124.92 ns | 83.00 ns | 500.00 ns | 197.9% | 8.00M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: sub-range ⊆ full range (^[a-f]+$ ⊆ ^[a-z]+$)` | 131.31 ns | 83.00 ns | 500.00 ns | 215.5% | 7.62M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: fixed quant ⊆ range (^[0-9]{3}$ ⊆ ^[0-9]{1,5}$)` | 148.20 ns | 84.00 ns | 500.00 ns | 149.8% | 6.75M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `realistic: UUID v4 ⊆ hex-dash` | 158.24 ns | 84.00 ns | 1.13 µs | 177.1% | 6.32M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: specific format ⊆ generic (^FR[0-9]{5}$ ⊆ ^[A-Z]{2}[0-9]+$)` | 176.06 ns | 125.00 ns | 500.00 ns | 145.6% | 5.68M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `realistic: semver ⊆ digit-dot` | 177.83 ns | 125.00 ns | 667.00 ns | 113.4% | 5.62M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `realistic: French postal ⊆ 5-digit` | 191.96 ns | 125.00 ns | 667.00 ns | 125.7% | 5.21M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `inclusion: ISO date ⊆ digit-dash` | 209.41 ns | 167.00 ns | 833.00 ns | 141.9% | 4.78M ops/s | `█░░░░░░░░░░░░░░░░░░░` |

> **Spread:** fastest `equivalent: identical patterns` is **2822.7x** faster than slowest `inclusion: ISO date ⊆ digit-dash`

---

## Real World

> 📄 `real-world.bench.ts` — 48 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `identity: all-keywords schema ⊆ itself` | 3.33 ns | 3.19 ns | 5.76 ns | 13.6% | 300.01M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identity: API response ⊆ itself` | 3.84 ns | 3.55 ns | 6.04 ns | 18.4% | 260.71M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `double negation: normalize` | 4.71 ns | 4.57 ns | 6.67 ns | 14.4% | 212.22M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `identity: paginated output ⊆ itself` | 4.92 ns | 4.00 ns | 7.44 ns | 27.1% | 203.19M ops/s | `█▒░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: email ∩ email (same)` | 8.11 ns | 7.91 ns | 10.53 ns | 11.2% | 123.29M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `intersect: all-keywords ∩ itself (idempotent)` | 8.30 ns | 8.25 ns | 9.81 ns | 4.6% | 120.48M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `format: email ∩ uri (conflict → null)` | 161.54 ns | 159.10 ns | 192.50 ns | 6.0% | 6.19M ops/s | `░░░▒█▒░░░░░░░░░░░░░░` |
| 🟢 | `isEqual: normalize + compare (double negation)` | 223.70 ns | 208.66 ns | 448.81 ns | 78.5% | 4.47M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `isEqual: all-keywords schema (same ref)` | 243.21 ns | 231.98 ns | 338.67 ns | 13.5% | 4.11M ops/s | `░░█░░░░░░░░░░░░░░░░░` |
| 🟢 | `isEqual: API response vs expected input (different)` | 352.91 ns | 351.19 ns | 422.97 ns | 3.6% | 2.83M ops/s | `░░░█░░░░░░░░░░░░░░░░` |
| 🟢 | `double negation: not(not(string)) ⊆ string` | 392.51 ns | 386.78 ns | 449.82 ns | 5.4% | 2.55M ops/s | `░░▒▒█▒▒░░░░░░░░░░░░░` |
| 🟢 | `resolveConditions: nested config (fast)` | 401.70 ns | 369.42 ns | 1.07 µs | 48.0% | 2.49M ops/s | `▒▒▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `format: hostname ⊆ idn-hostname` | 433.61 ns | 433.63 ns | 473.36 ns | 3.4% | 2.31M ops/s | `░░░▒▒▒█▒░░░░░░░░░░░░` |
| 🟢 | `format: uri ⊆ iri` | 451.29 ns | 447.77 ns | 498.01 ns | 2.8% | 2.22M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `format: email ⊆ idn-email` | 453.43 ns | 449.51 ns | 485.23 ns | 2.4% | 2.21M ops/s | `░░▒█▒░░░░░░░░░░░░░░░` |
| 🟢 | `resolveConditions: allOf both match` | 806.19 ns | 696.99 ns | 1.77 µs | 33.5% | 1.24M ops/s | `░█▒░░░░░░░░░░░░░░░░░` |
| 🟢 | `resolveConditions: allOf none match` | 862.60 ns | 483.21 ns | 2.97 µs | 79.2% | 1.16M ops/s | `█▒▒▒░░░░░░░░░░░░░░░░` |
| 🟡 | `resolveConditions: nested config (safe)` | 1.15 µs | 1.03 µs | 2.06 µs | 28.4% | 872.36K ops/s | `▒▒▒█▒▒░░░░░░░░░░░░░░` |
| 🟡 | `check: discriminated union → flexible input` | 1.68 µs | 1.67 µs | 1.81 µs | 2.6% | 594.13K ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟡 | `check: paginated output → expected input` | 2.36 µs | 2.35 µs | 2.48 µs | 1.7% | 423.10K ops/s | `░░▒▒█▒▒░░░░░░░░░░░░░` |
| 🟡 | `intersect: paginated output ∩ paginated input` | 2.40 µs | 2.40 µs | 2.46 µs | 0.9% | 416.43K ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` |
| 🟡 | `pipeline: check + formatResult (webhook)` | 2.77 µs | 2.68 µs | 3.17 µs | 7.5% | 360.65K ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` |
| 🟡 | `check: webhook → strict event (incompatible)` | 3.01 µs | 2.63 µs | 7.38 µs | 146.8% | 332.76K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `intersect: API response ∩ expected input` | 3.09 µs | 3.05 µs | 3.25 µs | 2.6% | 323.39K ops/s | `░▒▒█▒▒▒▒░░░░░░░░░░░░` |
| 🟡 | `wide 10-prop: intersect` | 3.28 µs | 3.27 µs | 3.38 µs | 1.2% | 305.31K ops/s | `░▒▒▒█▒░░░░░░░░░░░░░░` |
| 🟡 | `deep 5-level: strict ⊆ loose` | 3.33 µs | 3.25 µs | 3.60 µs | 5.3% | 300.15K ops/s | `░▒▒▒▒█▒▒▒▒▒▒▒▒▒▒▒░░░` |
| 🟡 | `pipeline: normalize + isSubset (API response)` | 3.51 µs | 3.41 µs | 3.77 µs | 5.4% | 284.82K ops/s | `░▒▒▒▒█▒▒▒▒▒▒▒▒▒▒░░░░` |
| 🟡 | `wide 10-prop: strict ⊆ loose` | 3.55 µs | 3.54 µs | 3.62 µs | 0.9% | 281.87K ops/s | `░░░▒▒▒█▒▒░░░░░░░░░░░` |
| 🟡 | `check: API response → expected input (compatible)` | 3.92 µs | 3.58 µs | 8.04 µs | 27.2% | 255.31K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `check: closed source + format + not` | 4.09 µs | 3.54 µs | 8.58 µs | 130.5% | 244.76K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `deep 8-level: intersect` | 4.65 µs | 4.64 µs | 4.73 µs | 0.8% | 214.93K ops/s | `░░░▒▒▒█▒▒░░░░░░░░░░░` |
| 🟡 | `pipeline: resolveConditions + check (form)` | 4.90 µs | 4.75 µs | 5.58 µs | 9.1% | 204.28K ops/s | `░░░▒▒▒█▒▒▒▒▒▒░░░░░░░` |
| 🟡 | `deep 5-level: intersect` | 7.46 µs | 7.22 µs | 11.27 µs | 32.3% | 134.02K ops/s | `░░░░░▒▒▒▒█▒▒░░░░░░░░` |
| 🟡 | `wide 10-prop: check` | 7.56 µs | 7.47 µs | 8.18 µs | 5.9% | 132.33K ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` |
| 🟡 | `deep 5-level: check (detailed diffs)` | 7.73 µs | 7.79 µs | 10.37 µs | 22.6% | 129.31K ops/s | `░▒▒▒▒▒▒█▒░░░░░░░░░░░` |
| 🟡 | `wide 30-prop: intersect` | 8.79 µs | 8.79 µs | 8.88 µs | 0.9% | 113.79K ops/s | `░▒▒▒▒▒▒▒▒▒█▒▒▒░░░░░░` |
| 🟡 | `wide 30-prop: strict ⊆ loose` | 9.30 µs | 9.29 µs | 9.36 µs | 0.4% | 107.49K ops/s | `░░░░░░▒▒█▒▒▒▒▒░░░░░░` |
| 🟡 | `deep 8-level: strict ⊆ loose` | 9.89 µs | 10.53 µs | 14.30 µs | 37.1% | 101.10K ops/s | `░░░░▒▒▒▒▒▒█▒▒▒░░░░░░` |
| 🟠 | `deep 5-level: loose ⊄ strict` | 11.84 µs | 11.37 µs | 15.77 µs | 30.8% | 84.45K ops/s | `░░░░░░▒▒▒█▒░░░░░░░░░` |
| 🟠 | `check+conditions: personal output ⊆ form (resolved)` | 12.68 µs | 12.69 µs | 12.89 µs | 1.6% | 78.85K ops/s | `░░░░░░░░░░▒▒▒█▒░░░░░` |
| 🟠 | `wide 50-prop: intersect` | 13.62 µs | 13.59 µs | 13.70 µs | 0.6% | 73.42K ops/s | `░░▒▒█▒▒▒▒░░░░░░░░░░░` |
| 🟠 | `check+conditions: business output ⊆ form (resolved)` | 13.81 µs | 12.92 µs | 24.79 µs | 47.4% | 72.42K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟠 | `wide 50-prop: strict ⊆ loose` | 14.60 µs | 14.51 µs | 15.14 µs | 1.9% | 68.48K ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟠 | `pipeline: normalize + intersect + isEqual (commutativity)` | 15.30 µs | 14.01 µs | 16.05 µs | 24.5% | 65.36K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟠 | `deep 8-level: loose ⊄ strict` | 16.48 µs | 15.15 µs | 25.30 µs | 46.9% | 60.66K ops/s | `▒▒▒▒▒▒▒█▒▒▒▒░░░░░░░░` |
| 🟠 | `deep 8-level: check (detailed diffs)` | 18.60 µs | 18.50 µs | 28.90 µs | 46.3% | 53.76K ops/s | `▒▒▒▒▒▒▒█▒▒▒▒░░░░░░░░` |
| 🟠 | `wide 30-prop: check` | 30.14 µs | 22.22 µs | 48.86 µs | 36.8% | 33.18K ops/s | `░▒█▒▒▒▒▒▒▒░░░░░░░░░░` |
| 🟠 | `wide 50-prop: check` | 38.21 µs | 37.07 µs | 44.20 µs | 10.2% | 26.17K ops/s | `░▒▒▒▒█▒▒░░░░░░░░░░░░` |

> **Spread:** fastest `identity: all-keywords schema ⊆ itself` is **11464.7x** faster than slowest `wide 50-prop: check`

---

## Resolve Conditions

> 📄 `resolve-conditions.bench.ts` — 38 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution |
|:--:|:---|---:|---:|---:|---:|---:|:---|
| 🟢 | `passthrough: no if/then/else` | 41.26 ns | 39.71 ns | 65.32 ns | 18.6% | 24.24M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: numeric minimum (minor)` | 101.50 ns | 98.32 ns | 130.99 ns | 11.0% | 9.85M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `if anyOf: user role` | 103.19 ns | 97.31 ns | 149.37 ns | 15.0% | 9.69M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `property override: no override` | 121.27 ns | 115.40 ns | 186.08 ns | 17.0% | 8.25M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: pattern match (invalid)` | 124.08 ns | 117.33 ns | 215.08 ns | 17.4% | 8.06M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `additionalProperties override: true → false` | 184.87 ns | 179.87 ns | 294.47 ns | 15.9% | 5.41M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `nested: fast config → else (recursive)` | 189.94 ns | 183.70 ns | 328.00 ns | 12.5% | 5.26M ops/s | `▒█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `simple: missing discriminant (empty data)` | 205.25 ns | 201.02 ns | 254.92 ns | 7.2% | 4.87M ops/s | `░░▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `simple: then-branch (business)` | 211.24 ns | 210.61 ns | 247.87 ns | 7.2% | 4.73M ops/s | `░░▒▒█▒░░░░░░░░░░░░░░` |
| 🟢 | `simple: else-branch (personal)` | 211.65 ns | 208.71 ns | 242.59 ns | 5.7% | 4.72M ops/s | `░░▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: numeric minimum (adult)` | 221.85 ns | 167.00 ns | 1.33 µs | 158.2% | 4.51M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: pattern match (valid)` | 234.93 ns | 167.00 ns | 1.38 µs | 174.9% | 4.26M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `allOf mixed: conditional + non-conditional (normal)` | 251.90 ns | 243.57 ns | 355.99 ns | 10.2% | 3.97M ops/s | `░▒█░░░░░░░░░░░░░░░░░` |
| 🟢 | `allOf else: production → else` | 293.44 ns | 286.03 ns | 412.20 ns | 9.2% | 3.41M ops/s | `░░░█▒░░░░░░░░░░░░░░░` |
| 🟢 | `if anyOf: admin role` | 305.35 ns | 125.00 ns | 7.17 µs | 352.7% | 3.27M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `allOf: no conditions match` | 370.72 ns | 364.47 ns | 441.31 ns | 6.0% | 2.70M ops/s | `░░▒█░░░░░░░░░░░░░░░░` |
| 🟢 | `if/then only: not matching → no extra constraints` | 391.14 ns | 219.21 ns | 1.09 µs | 82.4% | 2.56M ops/s | `░▒█▒▒▒▒▒▒▒▒░░░░░░░░░` |
| 🟢 | `if not: business type → then` | 413.16 ns | 167.00 ns | 8.88 µs | 332.0% | 2.42M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: nested object data (FR)` | 423.13 ns | 167.00 ns | 9.13 µs | 338.3% | 2.36M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `if/then only: matching → then` | 439.05 ns | 167.00 ns | 9.75 µs | 464.4% | 2.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `allOf: first condition only` | 448.16 ns | 442.91 ns | 546.52 ns | 5.5% | 2.23M ops/s | `░░░▒█░░░░░░░░░░░░░░░` |
| 🟢 | `allOf: second condition only` | 454.34 ns | 440.61 ns | 615.68 ns | 9.5% | 2.20M ops/s | `░█▒░░░░░░░░░░░░░░░░░` |
| 🟢 | `if not: personal type → else` | 465.25 ns | 349.35 ns | 1.12 µs | 76.9% | 2.15M ops/s | `▒▒▒▒▒█▒▒▒▒▒▒▒▒░░░░░░` |
| 🟢 | `allOf else: debug → then` | 483.17 ns | 416.00 ns | 1.79 µs | 109.3% | 2.07M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: nested object data (US)` | 487.52 ns | 408.82 ns | 1.16 µs | 67.6% | 2.05M ops/s | `░▒▒▒▒█▒▒▒▒▒▒░░░░░░░░` |
| 🟢 | `allOf: both conditions match` | 539.87 ns | 518.74 ns | 658.45 ns | 9.0% | 1.85M ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` |
| 🟢 | `array override: minItems 1 → 5` | 549.85 ns | 540.02 ns | 666.92 ns | 5.8% | 1.82M ops/s | `░░░▒█▒░░░░░░░░░░░░░░` |
| 🟢 | `combined: top-level + allOf (number)` | 587.16 ns | 583.26 ns | 788.68 ns | 10.6% | 1.70M ops/s | `░█░░░░░░░░░░░░░░░░░░` |
| 🟢 | `allOf mixed: conditional + non-conditional (secret)` | 588.34 ns | 459.00 ns | 2.71 µs | 137.4% | 1.70M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: format email (invalid)` | 591.58 ns | 552.63 ns | 784.47 ns | 11.6% | 1.69M ops/s | `▒█▒▒▒▒░░░░░░░░░░░░░░` |
| 🟢 | `property override: maxLength reduced` | 594.14 ns | 417.00 ns | 4.46 µs | 190.1% | 1.68M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `combined: top-level + allOf (text)` | 780.19 ns | 667.00 ns | 2.25 µs | 86.0% | 1.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `evaluate: format email (valid)` | 873.99 ns | 709.00 ns | 3.08 µs | 116.2% | 1.14M ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟢 | `nested: safe config → then (recursive)` | 923.82 ns | 927.34 ns | 1.21 µs | 7.8% | 1.08M ops/s | `░░░▒▒█░░░░░░░░░░░░░░` |
| 🟡 | `enum condition: free → else` | 1.02 µs | 903.40 ns | 2.11 µs | 57.4% | 979.85K ops/s | `░▒▒▒▒▒█▒▒▒▒▒▒▒░░░░░░` |
| 🟡 | `if allOf: email method` | 1.06 µs | 541.00 ns | 13.54 µs | 226.6% | 939.03K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `enum condition: premium → then` | 1.17 µs | 583.00 ns | 13.79 µs | 235.0% | 857.82K ops/s | `█░░░░░░░░░░░░░░░░░░░` |
| 🟡 | `if allOf: phone method` | 1.38 µs | 1.32 µs | 2.43 µs | 45.9% | 725.15K ops/s | `░░░░▒▒▒▒▒█▒▒▒▒▒░░░░░` |

> **Spread:** fastest `passthrough: no if/then/else` is **33.4x** faster than slowest `if allOf: phone method`

---

## Performance Overview

### Performance Tiers

| Tier | Count | % | Bar |
|:-----|------:|--:|:----|
| 🟢 Excellent (< 1µs) | 252 | 72% | █████████████████████████ |
| 🟡 Good (1µs – 10µs) | 83 | 24% | ████████ |
| 🟠 Moderate (10µs – 100µs) | 15 | 4% | █ |
| 🔴 Slow (> 100µs) | 0 | 0% |  |

### Per-File Summary

| File | Benchmarks | Fastest | Slowest | Median |
|:-----|----------:|:--------|:--------|:-------|
| Check Connection | 11 | 7.34 ns | 4.26 µs | 2.07 µs |
| Check Resolved | 14 | 2.27 µs | 14.01 µs | 7.21 µs |
| Check | 21 | 21.77 ns | 4.73 µs | 1.34 µs |
| Intersect | 76 | 6.68 ns | 2.20 µs | 444.28 ns |
| Is Equal | 20 | 13.62 ns | 1.27 µs | 125.77 ns |
| Is Subset | 55 | 0.27 ns | 10.60 µs | 725.26 ns |
| Normalize | 27 | 2.89 ns | 6.83 ns | 5.32 ns |
| Pattern Subset | 40 | 0.07 ns | 209.41 ns | 42.44 ns |
| Real World | 48 | 3.33 ns | 38.21 µs | 3.28 µs |
| Resolve Conditions | 38 | 41.26 ns | 1.38 µs | 439.05 ns |

## Top Performers

### ⚡ Fastest

| # | Benchmark | avg | ops/s | File |
|--:|:----------|----:|------:|:-----|
| 🥇 | `equivalent: identical patterns` | 0.07 ns | 13479.45M | Pattern Subset |
| 🥈 | `identity: identical simple pattern` | 0.08 ns | 13279.76M | Pattern Subset |
| 🥉 | `identity: identical complex pattern` | 0.08 ns | 12111.80M | Pattern Subset |
| 4 | `boolean: false ⊆ false` | 0.27 ns | 3671.36M | Is Subset |
| 5 | `boolean: true ⊆ true` | 0.56 ns | 1776.61M | Is Subset |
| 6 | `type: string ⊆ string (true)` | 1.65 ns | 606.35M | Is Subset |
| 7 | `identity: A ⊆ A (simple object)` | 2.41 ns | 415.38M | Is Subset |
| 8 | `identity: A ⊆ A (complex schema)` | 2.47 ns | 405.17M | Is Subset |
| 9 | `const: number` | 2.89 ns | 346.28M | Normalize |
| 10 | `const: integer` | 2.99 ns | 334.14M | Normalize |

### 🐢 Slowest

| # | Benchmark | avg | ops/s | File |
|--:|:----------|----:|------:|:-----|
| 1 | `wide 50-prop: check` | 38.21 µs | 26.17K | Real World |
| 2 | `wide 30-prop: check` | 30.14 µs | 33.18K | Real World |
| 3 | `deep 8-level: check (detailed diffs)` | 18.60 µs | 53.76K | Real World |
| 4 | `deep 8-level: loose ⊄ strict` | 16.48 µs | 60.66K | Real World |
| 5 | `pipeline: normalize + intersect + isEqual (commutativity)` | 15.30 µs | 65.36K | Real World |
| 6 | `wide 50-prop: strict ⊆ loose` | 14.60 µs | 68.48K | Real World |
| 7 | `allOf: multiple conditions in allOf resolved` | 14.01 µs | 71.39K | Check Resolved |
| 8 | `check+conditions: business output ⊆ form (resolved)` | 13.81 µs | 72.42K | Real World |
| 9 | `wide 50-prop: intersect` | 13.62 µs | 73.42K | Real World |
| 10 | `check+conditions: personal output ⊆ form (resolved)` | 12.68 µs | 78.85K | Real World |

### 🎯 Most Stable (lowest jitter)

| # | Benchmark | avg | σ | File |
|--:|:----------|----:|--:|:-----|
| 1 | `wide 30-prop: strict ⊆ loose` | 9.30 µs | 0.4% | Real World |
| 2 | `wide 50-prop: intersect` | 13.62 µs | 0.6% | Real World |
| 3 | `deep 8-level: intersect` | 4.65 µs | 0.8% | Real World |
| 4 | `wide 30-prop: intersect` | 8.79 µs | 0.9% | Real World |
| 5 | `intersect: paginated output ∩ paginated input` | 2.40 µs | 0.9% | Real World |

### 🎲 Most Volatile (highest jitter)

| # | Benchmark | avg | σ | File |
|--:|:----------|----:|--:|:-----|
| 1 | `order: loose input → strict output (incompatible, reverse)` | 4.26 µs | 627.3% | Check Connection |
| 2 | `then-branch match (text → string)` | 7.21 µs | 626.8% | Check Resolved |
| 3 | `else-branch match (data → number)` | 6.44 µs | 574.4% | Check Resolved |
| 4 | `single data: then resolution` | 5.03 µs | 532.4% | Check Resolved |
| 5 | `integration: closed output + format + not (compatible)` | 3.15 µs | 502.2% | Check Connection |

## Distribution Analysis

### Latency Histogram

```
  < 100 ns         │██████████████████████████  92
  100 ns – 500 ns  │██████████████████████████████ 105
  500 ns – 1 µs    │████████████████  55
  1 µs – 5 µs      │███████████████████  68
  5 µs – 10 µs     │████  15
  10 µs – 50 µs    │████  15
```

### Overall Statistics

| Metric | Value |
|:-------|------:|
| **Total benchmarks** | 350 |
| **Overall mean** | 1.70 µs |
| **Overall median** | 432.83 ns |
| **Overall P90** | 4.36 µs |
| **Fastest** | 0.07 ns (`equivalent: identical patterns`) |
| **Slowest** | 38.21 µs (`wide 50-prop: check`) |
| **Spread** | 515100x |
| **Avg jitter** | 48.1% |

---

*Generated by benchmark runner · 350 benchmarks · Tue, Mar 10, 2026 at 10:29:26*
