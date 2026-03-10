# 📊 Benchmark Report

> Generated on **Tue, Mar 10, 2026 at 14:11:40**

## 🖥️ Environment

| Property | Value |
|:---------|:------|
| **Runtime** | bun |
| **CPU** | Apple M3 Max @ 3.8 GHz |
| **Arch** | arm64-darwin |
| **Benchmarks** | 374 across 11 files |

## Check Connection

> 📄 `check-connection.bench.ts` — 11 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `simple: identical schemas (compatible)` | 7.33 ns | 6.90 ns | 11.70 ns | 50.3% | 136.35M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +14.1% |
| 🟢 | `simple: empty ↔ empty (compatible)` | 7.33 ns | 6.82 ns | 10.54 ns | 47.2% | 136.33M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.4% |
| 🟢 | `simple: string value (compatible)` | 890.83 ns | 750.00 ns | 3.96 µs | 178.0% | 1.12M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +8.2% |
| 🟡 | `real-world: discriminated union → flexible input (compatible)` | 1.85 µs | 1.75 µs | 2.58 µs | 98.0% | 539.29K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -1.6% |
| 🟡 | `simple: type conflict (incompatible)` | 2.31 µs | 2.08 µs | 6.79 µs | 103.8% | 433.81K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +4.1% |
| 🟡 | `real-world: webhook → strict event (incompatible)` | 2.36 µs | 2.24 µs | 3.07 µs | 13.1% | 424.48K ops/s | `░▒▒▒█▒▒▒▒▒░░░░░░░░░░` | ⬆️ +3.3% |
| 🟡 | `real-world: paginated output → expected input (compatible)` | 2.40 µs | 2.36 µs | 2.68 µs | 3.6% | 416.67K ops/s | `░░█▒▒░░░░░░░░░░░░░░░` | ⬆️ +5.1% |
| 🟡 | `real-world: API response → expected input (compatible)` | 2.97 µs | 2.93 µs | 3.48 µs | 5.3% | 336.77K ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +5.2% |
| 🟡 | `order: strict output → loose input (compatible)` | 3.12 µs | 3.09 µs | 3.31 µs | 2.7% | 320.58K ops/s | `░░░█▒░░░░░░░░░░░░░░░` | ⬆️ +2.9% |
| 🟡 | `integration: closed output + format + not (compatible)` | 3.44 µs | 3.38 µs | 4.09 µs | 10.6% | 290.31K ops/s | `░░▒▒▒▒▒█▒▒▒▒▒░░░░░░░` | ⬆️ +16.4% |
| 🟡 | `order: loose input → strict output (incompatible, reverse)` | 4.80 µs | 4.17 µs | 9.88 µs | 521.1% | 208.22K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +12.2% |

> **Spread:** fastest `simple: identical schemas (compatible)` is **654.8x** faster than slowest `order: loose input → strict output (incompatible, reverse)`

---

## Check Resolved

> 📄 `check-resolved.bench.ts` — 16 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟡 | `comparison: isSubset WITHOUT resolution (false negative)` | 2.46 µs | 2.33 µs | 3.35 µs | 13.2% | 405.82K ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +16.9% |
| 🟡 | `constraints: invalid runtime data` | 2.76 µs | 2.76 µs | 2.98 µs | 4.3% | 361.82K ops/s | `░░░░░░▒▒▒█▒▒▒░░░░░░░` | ⬆️ +1.2% |
| 🟡 | `constraints: valid runtime data` | 3.14 µs | 2.88 µs | 7.25 µs | 80.4% | 318.79K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +5.7% |
| 🟡 | `single data: else resolution` | 4.32 µs | 4.18 µs | 5.02 µs | 7.8% | 231.51K ops/s | `░░▒▒█▒▒▒▒░░░░░░░░░░░` | ⬆️ +4.0% |
| 🟡 | `violating resolved branch (text → wrong type)` | 4.52 µs | 4.38 µs | 5.66 µs | 10.3% | 221.31K ops/s | `░▒▒█▒▒░░░░░░░░░░░░░░` | ⬆️ +8.8% |
| 🟡 | `form: incomplete output ⊄ conditional form (missing required)` | 5.26 µs | 4.92 µs | 7.34 µs | 17.4% | 190.13K ops/s | `░▒▒█▒▒▒▒░░░░░░░░░░░░` | ➡️ +0.3% |
| 🟡 | `pattern: resolved sup adds pattern constraint` | 5.53 µs | 4.67 µs | 13.79 µs | 211.5% | 180.79K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.9% |
| 🟡 | `single data: then resolution` | 5.63 µs | 4.63 µs | 15.13 µs | 532.9% | 177.47K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +27.2% |
| 🟡 | `else-branch match (data → number)` | 7.00 µs | 6.00 µs | 15.42 µs | 581.3% | 142.88K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +4.3% |
| 🟡 | `comparison: check WITH resolution (correct)` | 7.26 µs | 6.97 µs | 8.80 µs | 10.6% | 137.74K ops/s | `░▒▒█▒▒░░░░░░░░░░░░░░` | ⬆️ +42.0% |
| 🟡 | `then-branch match (text → string)` | 7.75 µs | 6.29 µs | 17.63 µs | 558.7% | 128.98K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -1.2% |
| 🟡 | `sub with own conditions: both resolved` | 8.34 µs | 8.00 µs | 9.34 µs | 9.0% | 119.90K ops/s | `░▒▒▒█▒▒▒▒▒▒▒▒░░░░░░░` | ➡️ +0.5% |
| 🟠 | `nested: safe config (recursive resolution)` | 12.81 µs | 11.00 µs | 24.21 µs | 356.1% | 78.06K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ -0.6% |
| 🟠 | `form: personal output ⊆ conditional form (resolved)` | 15.14 µs | 13.33 µs | 27.46 µs | 210.5% | 66.06K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -5.0% |
| 🟠 | `allOf: multiple conditions in allOf resolved` | 15.15 µs | 13.21 µs | 28.71 µs | 242.0% | 65.99K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -3.6% |
| 🟠 | `form: business output ⊆ conditional form (resolved)` | 15.98 µs | 14.00 µs | 28.67 µs | 227.0% | 62.56K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -9.3% |

> **Spread:** fastest `comparison: isSubset WITHOUT resolution (false negative)` is **6.5x** faster than slowest `form: business output ⊆ conditional form (resolved)`

---

## Check

> 📄 `check.bench.ts` — 21 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `formatResult: passing (✅)` | 22.39 ns | 21.54 ns | 29.76 ns | 19.7% | 44.66M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬇️ -10.3% |
| 🟢 | `formatResult: type clash (❌)` | 233.30 ns | 242.35 ns | 285.78 ns | 12.1% | 4.29M ops/s | `░░░░▒▒▒▒▒█▒░░░░░░░░░` | ⬆️ +10.9% |
| 🟢 | `formatResult: nested diffs (❌)` | 239.88 ns | 227.92 ns | 289.88 ns | 11.2% | 4.17M ops/s | `░░░░▒▒█▒▒▒▒▒▒░░░░░░░` | ⬆️ +7.2% |
| 🟢 | `compatible: string (no diffs)` | 341.30 ns | 334.35 ns | 436.31 ns | 8.3% | 2.93M ops/s | `░░░▒▒█░░░░░░░░░░░░░░` | ⬆️ +6.8% |
| 🟢 | `formatResult: failing with diffs (❌)` | 404.77 ns | 402.33 ns | 534.54 ns | 12.2% | 2.47M ops/s | `░░░░▒▒▒█▒▒░░░░░░░░░░` | ⬇️ -3.2% |
| 🟢 | `compatible: numeric range (no diffs)` | 440.54 ns | 432.44 ns | 533.24 ns | 5.6% | 2.27M ops/s | `░░░▒█░░░░░░░░░░░░░░░` | ⬆️ +4.4% |
| 🟢 | `incompatible: pattern added` | 747.98 ns | 710.49 ns | 1.65 µs | 20.1% | 1.34M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +13.2% |
| 🟢 | `incompatible: numeric constraint changes` | 811.01 ns | 767.13 ns | 1.73 µs | 19.5% | 1.23M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +15.7% |
| 🟡 | `compatible: object (no diffs)` | 1.01 µs | 997.85 ns | 1.13 µs | 3.2% | 991.69K ops/s | `░░░▒█▒░░░░░░░░░░░░░░` | ⬆️ +5.1% |
| 🟡 | `incompatible: conflicting types → null merge` | 1.26 µs | 1.24 µs | 1.37 µs | 3.4% | 793.57K ops/s | `░░░▒▒█▒▒░░░░░░░░░░░░` | ⬆️ +5.1% |
| 🟡 | `incompatible: enum changes` | 1.40 µs | 1.32 µs | 2.70 µs | 20.6% | 714.43K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +33.8% |
| 🟡 | `incompatible: missing required (diffs)` | 1.94 µs | 1.82 µs | 3.26 µs | 16.0% | 515.01K ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +16.4% |
| 🟡 | `incompatible: multiple diffs reported` | 2.12 µs | 1.98 µs | 3.84 µs | 19.8% | 471.95K ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +21.4% |
| 🟡 | `incompatible: additionalProperties constraint` | 2.29 µs | 2.20 µs | 3.48 µs | 14.7% | 437.28K ops/s | `░▒▒█▒░░░░░░░░░░░░░░░` | ⬆️ +18.2% |
| 🟡 | `incompatible: anyOf no matching branch` | 2.41 µs | 2.38 µs | 2.60 µs | 3.8% | 414.58K ops/s | `░░░░░░░▒█▒▒▒▒░░░░░░░` | ⬇️ -5.0% |
| 🟡 | `real-world: webhook payload ⊄ strict event (incompatible)` | 2.88 µs | 2.78 µs | 4.38 µs | 13.8% | 347.44K ops/s | `░▒▒█░░░░░░░░░░░░░░░░` | ⬆️ +10.1% |
| 🟡 | `real-world: API response ⊆ expected input (compatible)` | 3.61 µs | 3.57 µs | 3.93 µs | 3.8% | 277.39K ops/s | `░░░░▒█▒▒▒░░░░░░░░░░░` | ⬆️ +13.5% |
| 🟡 | `incompatible: nested object diffs (3 levels)` | 4.60 µs | 4.45 µs | 5.83 µs | 11.1% | 217.54K ops/s | `░▒▒█▒▒░░░░░░░░░░░░░░` | ⬆️ +18.6% |
| 🟡 | `incompatible: oneOf extra branch` | 4.65 µs | 4.64 µs | 4.93 µs | 2.7% | 214.90K ops/s | `░░░░░░░░▒▒█▒▒░░░░░░░` | ⬆️ +6.9% |
| 🟡 | `incompatible: anyOf branch rejection` | 4.93 µs | 4.90 µs | 5.12 µs | 2.0% | 203.04K ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` | ⬇️ -5.8% |
| 🟡 | `incompatible: deep nesting diffs (3 levels)` | 4.94 µs | 4.82 µs | 5.91 µs | 9.4% | 202.46K ops/s | `░░░░▒▒▒█▒▒░░░░░░░░░░` | ⬆️ +25.1% |

> **Spread:** fastest `formatResult: passing (✅)` is **220.6x** faster than slowest `incompatible: deep nesting diffs (3 levels)`

---

## Constraints

> 📄 `constraints.bench.ts` — 18 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `root constraint: invalid uuid string` | 420.70 ns | 412.88 ns | 531.89 ns | 7.3% | 2.38M ops/s | `░░░░░█▒░░░░░░░░░░░░░` | ⬆️ +24.7% |
| 🟢 | `root constraint: valid uuid string` | 518.58 ns | 417.00 ns | 2.13 µs | 141.4% | 1.93M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.4% |
| 🟢 | `multiple constraints: invalid value` | 751.27 ns | 715.91 ns | 939.15 ns | 10.6% | 1.33M ops/s | `░░▒█▒▒▒▒▒░░░░░░░░░░░` | ⬇️ -1.4% |
| 🟢 | `patternProperties constraints: invalid object` | 803.70 ns | 778.96 ns | 1.25 µs | 11.3% | 1.24M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +79.0% |
| 🟡 | `multiple constraints: valid value` | 1.01 µs | 834.00 ns | 4.25 µs | 105.5% | 987.33K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -34.7% |
| 🟡 | `array item constraints: valid array` | 1.13 µs | 1.04 µs | 1.75 µs | 85.3% | 887.38K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +69.8% |
| 🟡 | `array item constraints: invalid array` | 1.14 µs | 1.14 µs | 1.22 µs | 2.2% | 876.10K ops/s | `░░░▒█▒░░░░░░░░░░░░░░` | ⬆️ +36.8% |
| 🟡 | `nested constraints: valid object` | 1.16 µs | 1.00 µs | 4.46 µs | 128.7% | 861.72K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +7.9% |
| 🟡 | `nested constraints: invalid object` | 1.24 µs | 1.23 µs | 1.38 µs | 4.5% | 806.12K ops/s | `░▒▒▒█▒▒▒░░░░░░░░░░░░` | ⬆️ +15.5% |
| 🟡 | `dependencies constraints: invalid object` | 1.38 µs | 1.45 µs | 1.87 µs | 13.6% | 724.97K ops/s | `░▒▒▒▒▒▒█░░░░░░░░░░░░` | ⬆️ +8.3% |
| 🟡 | `patternProperties constraints: valid object` | 1.47 µs | 1.33 µs | 5.75 µs | 72.3% | 679.71K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +54.6% |
| 🟡 | `dependencies constraints: valid object` | 1.60 µs | 1.33 µs | 5.58 µs | 78.6% | 626.01K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -52.9% |
| 🟡 | `comparison: runtime check WITHOUT constraint registry` | 1.70 µs | 1.68 µs | 1.87 µs | 2.8% | 588.26K ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ➡️ +0.7% |
| 🟡 | `additionalProperties constraints: invalid object` | 1.80 µs | 1.71 µs | 2.51 µs | 13.7% | 555.57K ops/s | `░▒▒█▒▒▒░░░░░░░░░░░░░` | ⬆️ +8.1% |
| 🟡 | `additionalProperties constraints: valid object` | 1.93 µs | 1.79 µs | 5.42 µs | 68.9% | 518.20K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +17.9% |
| 🟡 | `simple constraints: valid object` | 2.23 µs | 2.20 µs | 2.37 µs | 2.4% | 448.49K ops/s | `░▒█▒▒▒░░░░░░░░░░░░░░` | ⬆️ +6.5% |
| 🟡 | `simple constraints: invalid object` | 2.36 µs | 2.35 µs | 2.48 µs | 2.1% | 424.42K ops/s | `░░░░░▒▒▒█░░░░░░░░░░░` | ⬆️ +1.5% |
| 🟡 | `comparison: runtime check WITH constraint registry` | 2.72 µs | 2.71 µs | 2.92 µs | 2.9% | 367.52K ops/s | `░░░░▒▒█▒▒░░░░░░░░░░░` | ⬇️ -19.8% |

> **Spread:** fastest `root constraint: invalid uuid string` is **6.5x** faster than slowest `comparison: runtime check WITH constraint registry`

---

## Intersect

> 📄 `intersect.bench.ts` — 76 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `boolean: false ∩ false → false` | 3.97 ns | 3.94 ns | 5.11 ns | 6.0% | 251.84M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +43.6% |
| 🟢 | `idempotent: schema ∩ itself` | 5.08 ns | 4.77 ns | 6.94 ns | 11.0% | 196.95M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +38.6% |
| 🟢 | `boolean: true ∩ true` | 6.50 ns | 6.43 ns | 8.16 ns | 4.8% | 153.85M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +7.7% |
| 🟢 | `boolean: false ∩ schema → false` | 19.61 ns | 19.31 ns | 23.43 ns | 4.6% | 50.99M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +77.6% |
| 🟢 | `boolean: true ∩ false → false` | 22.68 ns | 22.43 ns | 26.25 ns | 3.5% | 44.09M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +77.6% |
| 🟢 | `boolean: true ∩ schema → schema` | 23.84 ns | 23.57 ns | 27.75 ns | 3.5% | 41.95M ops/s | `░░░█░░░░░░░░░░░░░░░░` | ⬆️ +83.8% |
| 🟢 | `const: same value → preserved` | 30.55 ns | 30.15 ns | 35.01 ns | 4.2% | 32.73M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +9.1% |
| 🟢 | `format: same format → preserved` | 35.22 ns | 35.11 ns | 43.14 ns | 7.8% | 28.40M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +12.0% |
| 🟢 | `const: different → null` | 82.33 ns | 81.61 ns | 90.27 ns | 2.6% | 12.15M ops/s | `░░░░░▒█░░░░░░░░░░░░░` | ⬆️ +1.9% |
| 🟢 | `format: incompatible → null` | 133.96 ns | 132.98 ns | 156.69 ns | 4.6% | 7.47M ops/s | `░░░░░▒█░░░░░░░░░░░░░` | ➡️ +0.6% |
| 🟢 | `empty: {} ∩ {} → {}` | 157.97 ns | 133.08 ns | 654.29 ns | 231.6% | 6.33M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +18.8% |
| 🟢 | `object: closed + extra required → null` | 235.39 ns | 236.33 ns | 262.77 ns | 3.9% | 4.25M ops/s | `░░░▒▒█░░░░░░░░░░░░░░` | ⬆️ +9.6% |
| 🟢 | `string: format + plain` | 279.24 ns | 277.51 ns | 301.19 ns | 2.7% | 3.58M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +9.8% |
| 🟢 | `numeric: multipleOf from one side only` | 283.45 ns | 281.22 ns | 312.64 ns | 3.1% | 3.53M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +6.5% |
| 🟢 | `const: compatible type → const + type` | 287.32 ns | 285.28 ns | 310.03 ns | 2.9% | 3.48M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +7.5% |
| 🟢 | `type: integer ∩ number → integer` | 305.42 ns | 301.05 ns | 338.39 ns | 4.1% | 3.27M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +8.7% |
| 🟢 | `array: uniqueItems true wins` | 314.41 ns | 292.54 ns | 489.21 ns | 15.4% | 3.18M ops/s | `░█▒░░░░░░░░░░░░░░░░░` | ⬆️ +6.9% |
| 🟢 | `type: number ∩ integer → integer (commutative)` | 326.69 ns | 324.64 ns | 353.52 ns | 2.8% | 3.06M ops/s | `░░░█░░░░░░░░░░░░░░░░` | ⬆️ +5.3% |
| 🟢 | `numeric: multipleOf(6) ∩ multipleOf(3)` | 335.41 ns | 331.79 ns | 371.40 ns | 3.6% | 2.98M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +4.4% |
| 🟢 | `string: tighter maxLength wins` | 371.78 ns | 369.69 ns | 397.17 ns | 2.1% | 2.69M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +8.5% |
| 🟢 | `numeric: exclusiveMaximum tighter wins` | 372.68 ns | 370.31 ns | 401.89 ns | 2.4% | 2.68M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +7.2% |
| 🟢 | `string: tighter minLength wins` | 373.15 ns | 371.03 ns | 403.93 ns | 2.3% | 2.68M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +4.5% |
| 🟢 | `numeric: exclusiveMinimum tighter wins` | 382.96 ns | 379.90 ns | 423.21 ns | 3.0% | 2.61M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +4.6% |
| 🟢 | `numeric: tighter maximum wins` | 386.96 ns | 384.74 ns | 417.96 ns | 3.0% | 2.58M ops/s | `░░▒█▒░░░░░░░░░░░░░░░` | ⬆️ +3.3% |
| 🟢 | `type array: multi ∩ single` | 392.79 ns | 387.90 ns | 438.99 ns | 4.0% | 2.55M ops/s | `░░█▒░░░░░░░░░░░░░░░░` | ⬆️ +10.4% |
| 🟢 | `numeric: tighter minimum wins` | 396.51 ns | 374.56 ns | 593.67 ns | 14.0% | 2.52M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬇️ -4.3% |
| 🟢 | `numeric: compatible ranges` | 414.26 ns | 407.10 ns | 519.54 ns | 7.2% | 2.41M ops/s | `░░░░▒█▒░░░░░░░░░░░░░` | ⬆️ +77.9% |
| 🟢 | `array: maxItems tighter wins` | 418.44 ns | 387.77 ns | 666.87 ns | 17.0% | 2.39M ops/s | `▒█▒░░░░░░░░░░░░░░░░░` | ⬆️ +3.3% |
| 🟢 | `array: minItems tighter wins` | 420.38 ns | 379.11 ns | 722.42 ns | 20.0% | 2.38M ops/s | `█▒▒░░░░░░░░░░░░░░░░░` | ➡️ +0.4% |
| 🟢 | `empty: {} ∩ typed → typed` | 439.69 ns | 397.83 ns | 771.99 ns | 25.1% | 2.27M ops/s | `░█▒░░░░░░░░░░░░░░░░░` | ⬆️ +2.4% |
| 🟢 | `maxProperties: tighter wins` | 443.86 ns | 398.47 ns | 751.12 ns | 21.2% | 2.25M ops/s | `▒█▒░░░░░░░░░░░░░░░░░` | ➡️ +0.6% |
| 🟢 | `minProperties: tighter wins` | 444.04 ns | 388.23 ns | 773.57 ns | 24.4% | 2.25M ops/s | `░█▒▒▒░░░░░░░░░░░░░░░` | ⬇️ -11.5% |
| 🟢 | `string: pattern + minLength` | 452.30 ns | 426.73 ns | 958.05 ns | 40.4% | 2.21M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +5.5% |
| 🟢 | `logical: not preserved through merge` | 452.51 ns | 440.10 ns | 723.06 ns | 15.7% | 2.21M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +12.7% |
| 🟢 | `logical: anyOf ∩ compatible type` | 453.78 ns | 433.38 ns | 895.45 ns | 46.4% | 2.20M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.3% |
| 🟢 | `string: minLength + maxLength` | 467.27 ns | 429.78 ns | 980.40 ns | 50.6% | 2.14M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +7.0% |
| 🟢 | `numeric: exclusiveMin + minimum (both kept)` | 472.74 ns | 438.36 ns | 972.94 ns | 41.0% | 2.12M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +3.1% |
| 🟢 | `const ∩ enum containing const` | 475.18 ns | 438.27 ns | 984.23 ns | 46.7% | 2.10M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +75.5% |
| 🟢 | `commutativity: numeric A∩B` | 479.53 ns | 471.59 ns | 530.45 ns | 4.2% | 2.09M ops/s | `░░▒█▒▒▒░░░░░░░░░░░░░` | ⬆️ +12.2% |
| 🟢 | `string: all keywords combined` | 482.24 ns | 446.22 ns | 991.43 ns | 51.0% | 2.07M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.2% |
| 🟢 | `type array: common types preserved` | 489.04 ns | 483.96 ns | 578.92 ns | 3.6% | 2.04M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +13.9% |
| 🟢 | `commutativity: numeric B∩A` | 496.02 ns | 491.73 ns | 536.78 ns | 2.8% | 2.02M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +10.2% |
| 🟢 | `numeric: multipleOf(6) ∩ multipleOf(4) → LCM` | 498.49 ns | 478.40 ns | 861.28 ns | 39.9% | 2.01M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +4.3% |
| 🟢 | `format: one format + constraints` | 521.18 ns | 503.18 ns | 770.25 ns | 16.8% | 1.92M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +8.3% |
| 🟢 | `array: items + constraints from other` | 531.53 ns | 502.98 ns | 951.93 ns | 30.2% | 1.88M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.9% |
| 🟢 | `commutativity: string A∩B` | 554.95 ns | 529.96 ns | 1.10 µs | 34.8% | 1.80M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +19.0% |
| 🟢 | `numeric: min from one + max from other` | 555.57 ns | 457.47 ns | 1.22 µs | 50.5% | 1.80M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -5.6% |
| 🟢 | `commutativity: string B∩A` | 565.75 ns | 547.78 ns | 1.09 µs | 36.3% | 1.77M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +15.7% |
| 🟢 | `contains: schemas merged` | 570.90 ns | 568.19 ns | 631.67 ns | 2.7% | 1.75M ops/s | `░░░▒█▒░░░░░░░░░░░░░░` | ⬆️ +8.7% |
| 🟢 | `object: required union` | 608.16 ns | 569.78 ns | 1.12 µs | 33.2% | 1.64M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +4.5% |
| 🟢 | `logical: allOf flattened into merge` | 643.44 ns | 622.89 ns | 1.17 µs | 28.7% | 1.55M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +17.6% |
| 🟢 | `array: items schemas merged` | 661.38 ns | 646.88 ns | 740.12 ns | 4.6% | 1.51M ops/s | `░░▒█▒▒▒░░░░░░░░░░░░░` | ⬆️ +9.4% |
| 🟢 | `object: additionalProperties false ∩ true` | 769.30 ns | 766.71 ns | 863.80 ns | 4.8% | 1.30M ops/s | `░░░░▒▒█░░░░░░░░░░░░░` | ⬆️ +8.5% |
| 🟢 | `commutativity: enum A∩B` | 769.74 ns | 752.38 ns | 1.08 µs | 11.7% | 1.30M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ➡️ -0.8% |
| 🟢 | `enum: commutative check` | 786.65 ns | 765.25 ns | 975.43 ns | 18.9% | 1.27M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +2.5% |
| 🟢 | `enum: large overlap` | 786.66 ns | 736.49 ns | 1.07 µs | 22.6% | 1.27M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -4.6% |
| 🟢 | `enum: overlapping → common values` | 789.04 ns | 756.83 ns | 1.17 µs | 12.4% | 1.27M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +3.7% |
| 🟢 | `object: overlapping property merged` | 813.12 ns | 802.14 ns | 900.39 ns | 3.4% | 1.23M ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` | ⬆️ +4.1% |
| 🟢 | `patternProperties: different patterns → both kept` | 820.24 ns | 733.91 ns | 1.35 µs | 27.9% | 1.22M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ -0.9% |
| 🟢 | `object: disjoint properties combined` | 843.48 ns | 807.39 ns | 1.42 µs | 20.7% | 1.19M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +12.3% |
| 🟢 | `dependencies: disjoint keys → both kept` | 882.87 ns | 666.00 ns | 7.04 µs | 358.2% | 1.13M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -28.0% |
| 🟢 | `object: additionalProperties schema ∩ schema` | 932.16 ns | 913.70 ns | 1.04 µs | 4.0% | 1.07M ops/s | `░░▒█▒▒▒▒░░░░░░░░░░░░` | ⬆️ +12.8% |
| 🟢 | `commutativity: enum B∩A` | 936.94 ns | 778.61 ns | 1.47 µs | 28.9% | 1.07M ops/s | `░▒█▒▒▒▒▒▒░░░░░░░░░░░` | ⬇️ -20.9% |
| 🟡 | `dependencies: array form merged` | 1.02 µs | 895.83 ns | 1.88 µs | 29.0% | 979.64K ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +3.9% |
| 🟡 | `const: incompatible type → null` | 1.03 µs | 1.03 µs | 1.14 µs | 3.0% | 972.44K ops/s | `░▒▒▒▒█▒░░░░░░░░░░░░░` | ⬆️ +9.0% |
| 🟡 | `type: incompatible (string ∩ number) → null` | 1.05 µs | 1.05 µs | 1.14 µs | 3.2% | 948.70K ops/s | `░░░▒▒▒█▒▒▒░░░░░░░░░░` | ⬆️ +9.7% |
| 🟡 | `array: tuple items merged by index` | 1.15 µs | 1.15 µs | 1.30 µs | 6.1% | 871.93K ops/s | `░░░░▒▒▒▒█▒▒░░░░░░░░░` | ⬆️ +10.9% |
| 🟡 | `commutativity: object B∩A` | 1.16 µs | 1.13 µs | 1.43 µs | 14.5% | 865.08K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬇️ -13.8% |
| 🟡 | `commutativity: object A∩B` | 1.16 µs | 1.13 µs | 1.46 µs | 14.2% | 862.92K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +3.4% |
| 🟡 | `type array: disjoint → null` | 1.27 µs | 1.27 µs | 1.37 µs | 3.7% | 788.88K ops/s | `░░░▒▒▒▒▒█▒▒░░░░░░░░░` | ⬆️ +9.5% |
| 🟡 | `dependencies: schema form merged` | 1.34 µs | 1.29 µs | 2.04 µs | 21.0% | 744.12K ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +2.1% |
| 🟡 | `enum: disjoint → null` | 1.40 µs | 1.40 µs | 1.51 µs | 2.9% | 715.35K ops/s | `░░▒▒▒█▒░░░░░░░░░░░░░` | ⬆️ +7.3% |
| 🟡 | `patternProperties: same pattern → merged` | 1.62 µs | 1.37 µs | 3.13 µs | 33.0% | 616.88K ops/s | `░█▒▒▒░░░░░░░░░░░░░░░` | ⬇️ -4.5% |
| 🟡 | `complex: array of typed objects` | 1.66 µs | 1.57 µs | 2.52 µs | 24.7% | 603.15K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +17.4% |
| 🟡 | `complex: full object merge` | 1.93 µs | 1.84 µs | 2.49 µs | 15.8% | 516.82K ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +9.6% |
| 🟡 | `complex: nested objects both contribute` | 2.73 µs | 2.49 µs | 4.25 µs | 22.6% | 366.46K ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` | ⬆️ +5.0% |

> **Spread:** fastest `boolean: false ∩ false → false` is **687.2x** faster than slowest `complex: nested objects both contribute`

---

## Is Equal

> 📄 `is-equal.bench.ts` — 20 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `identical: empty schemas` | 14.40 ns | 13.56 ns | 17.88 ns | 12.0% | 69.45M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.2% |
| 🟢 | `identical: boolean true === true` | 22.54 ns | 22.67 ns | 26.15 ns | 3.8% | 44.37M ops/s | `░░░▒█░░░░░░░░░░░░░░░` | ⬆️ +1.9% |
| 🟢 | `different: boolean true vs false` | 23.95 ns | 23.66 ns | 27.44 ns | 3.9% | 41.75M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +2.3% |
| 🟢 | `normalization: pre-normalized values` | 75.79 ns | 74.62 ns | 91.52 ns | 6.9% | 13.19M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +9.7% |
| 🟢 | `format: identical` | 76.09 ns | 75.12 ns | 85.29 ns | 7.5% | 13.14M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +5.7% |
| 🟢 | `normalization: const vs const+type (equal after normalize)` | 78.02 ns | 75.56 ns | 99.89 ns | 8.9% | 12.82M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +22.3% |
| 🟢 | `different: string vs number` | 79.87 ns | 77.13 ns | 101.22 ns | 9.5% | 12.52M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +13.7% |
| 🟢 | `identical: same reference` | 83.34 ns | 80.77 ns | 109.05 ns | 10.3% | 12.00M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +19.0% |
| 🟢 | `format: different` | 92.64 ns | 91.12 ns | 110.20 ns | 6.4% | 10.79M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +12.4% |
| 🟢 | `different: extra property` | 112.19 ns | 110.70 ns | 131.37 ns | 5.6% | 8.91M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +7.2% |
| 🟢 | `enum: identical (5 values)` | 129.68 ns | 127.45 ns | 158.63 ns | 7.0% | 7.71M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +3.8% |
| 🟢 | `enum: different (last value differs)` | 137.61 ns | 135.80 ns | 163.16 ns | 6.0% | 7.27M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +2.3% |
| 🟢 | `propertyNames: identical` | 158.65 ns | 155.90 ns | 194.78 ns | 7.1% | 6.30M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +7.0% |
| 🟢 | `different: required mismatch` | 220.11 ns | 217.12 ns | 266.83 ns | 5.1% | 4.54M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +5.8% |
| 🟢 | `anyOf: identical branches` | 235.16 ns | 232.33 ns | 313.93 ns | 5.5% | 4.25M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +9.9% |
| 🟢 | `identical: different references (simple)` | 248.59 ns | 246.35 ns | 325.94 ns | 5.5% | 4.02M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +10.3% |
| 🟢 | `patternProperties: identical` | 296.00 ns | 292.43 ns | 342.16 ns | 4.7% | 3.38M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +8.2% |
| 🟢 | `oneOf: identical discriminated union` | 591.28 ns | 589.89 ns | 619.44 ns | 1.8% | 1.69M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +12.5% |
| 🟢 | `deeply nested: identical 4-level schemas` | 742.68 ns | 737.32 ns | 827.61 ns | 2.6% | 1.35M ops/s | `░░█▒░░░░░░░░░░░░░░░░` | ⬆️ +13.1% |
| 🟡 | `complex: identical complex schemas` | 1.23 µs | 1.21 µs | 1.33 µs | 3.1% | 813.96K ops/s | `░░░▒█▒▒▒░░░░░░░░░░░░` | ⬆️ +13.3% |

> **Spread:** fastest `identical: empty schemas` is **85.3x** faster than slowest `complex: identical complex schemas`

---

## Is Subset

> 📄 `is-subset.bench.ts` — 55 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `boolean: false ⊆ false` | 0.28 ns | 0.18 ns | 3.29 ns | 197.9% | 3548.27M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +1.4% |
| 🟢 | `boolean: true ⊆ true` | 0.66 ns | 0.18 ns | 4.22 ns | 180.9% | 1506.32M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -10.7% |
| 🟢 | `type: string ⊆ string (true)` | 1.64 ns | 1.90 ns | 2.39 ns | 22.1% | 609.43M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +3.9% |
| 🟢 | `identity: A ⊆ A (simple object)` | 2.30 ns | 2.24 ns | 3.49 ns | 14.1% | 435.70M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ +0.2% |
| 🟢 | `identity: A ⊆ A (complex schema)` | 2.33 ns | 2.26 ns | 3.88 ns | 14.2% | 428.60M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ +0.4% |
| 🟢 | `empty: {} ⊆ {}` | 24.66 ns | 23.20 ns | 36.07 ns | 19.7% | 40.55M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +17.1% |
| 🟢 | `boolean: false ⊆ true` | 29.02 ns | 29.93 ns | 38.38 ns | 13.8% | 34.46M ops/s | `░░▒▒█░░░░░░░░░░░░░░░` | ⬆️ +69.0% |
| 🟢 | `any schema ⊆ true (true)` | 41.00 ns | 39.97 ns | 53.39 ns | 13.0% | 24.39M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +74.3% |
| 🟢 | `true ⊄ concrete schema (false)` | 77.19 ns | 72.59 ns | 106.17 ns | 13.1% | 12.96M ops/s | `░█▒░░░░░░░░░░░░░░░░░` | ⬆️ +60.7% |
| 🟢 | `not: number ⊆ not(string) (true)` | 167.74 ns | 173.96 ns | 239.47 ns | 17.1% | 5.96M ops/s | `░░▒▒▒█▒░░░░░░░░░░░░░` | ⬆️ +2.4% |
| 🟢 | `type: integer ⊆ number (true)` | 348.19 ns | 342.23 ns | 424.40 ns | 5.7% | 2.87M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬇️ -4.8% |
| 🟢 | `const number ⊆ type number (true)` | 363.69 ns | 361.95 ns | 391.02 ns | 2.5% | 2.75M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +12.4% |
| 🟢 | `const string ⊆ type string (true)` | 379.22 ns | 376.62 ns | 425.06 ns | 3.7% | 2.64M ops/s | `░░░▒█░░░░░░░░░░░░░░░` | ⬆️ +13.5% |
| 🟢 | `not: string+not(const) ⊆ string (true)` | 383.37 ns | 380.77 ns | 420.57 ns | 4.1% | 2.61M ops/s | `░░▒▒█░░░░░░░░░░░░░░░` | ⬆️ +14.9% |
| 🟢 | `format: email ⊆ string (true)` | 384.21 ns | 380.14 ns | 431.78 ns | 4.6% | 2.60M ops/s | `░░▒▒█░░░░░░░░░░░░░░░` | ⬆️ +13.2% |
| 🟢 | `numeric: multipleOf(6) ⊆ multipleOf(3) (true)` | 412.61 ns | 403.19 ns | 497.09 ns | 7.4% | 2.42M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +10.9% |
| 🟢 | `numeric: exclusiveMin 5 ⊆ exclusiveMin 0 (true)` | 416.50 ns | 412.84 ns | 471.17 ns | 3.7% | 2.40M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +8.8% |
| 🟢 | `format: email ⊆ idn-email (true)` | 455.92 ns | 452.72 ns | 535.80 ns | 3.3% | 2.19M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +12.0% |
| 🟢 | `numeric: strict [5,10] ⊆ loose [0,100] (true)` | 466.11 ns | 460.23 ns | 527.58 ns | 4.7% | 2.15M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +10.0% |
| 🟢 | `string: strict ⊆ loose (true)` | 475.56 ns | 471.87 ns | 609.40 ns | 7.2% | 2.10M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +13.0% |
| 🟢 | `format: uri ⊆ iri (true)` | 531.76 ns | 482.75 ns | 895.21 ns | 20.9% | 1.88M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +1.1% |
| 🟢 | `type: number ⊄ integer (false)` | 563.43 ns | 532.53 ns | 1.06 µs | 41.9% | 1.77M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -1.4% |
| 🟢 | `atomic ⊆ anyOf matching (true)` | 590.34 ns | 545.67 ns | 1.64 µs | 74.7% | 1.69M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.2% |
| 🟢 | `contains: strict ⊆ loose (true)` | 593.56 ns | 582.32 ns | 673.11 ns | 5.1% | 1.68M ops/s | `░▒█▒▒▒░░░░░░░░░░░░░░` | ⬆️ +11.0% |
| 🟢 | `array: strict ⊆ loose (true)` | 681.76 ns | 645.91 ns | 1.03 µs | 13.1% | 1.47M ops/s | `▒█▒░░░░░░░░░░░░░░░░░` | ⬆️ +13.4% |
| 🟢 | `array: uniqueItems ⊆ no uniqueItems (true)` | 686.27 ns | 683.59 ns | 774.73 ns | 6.4% | 1.46M ops/s | `░▒▒▒▒▒▒█▒▒▒▒▒░░░░░░░` | ⬆️ +10.8% |
| 🟢 | `format: string ⊄ email (false)` | 702.28 ns | 663.05 ns | 1.23 µs | 34.2% | 1.42M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +6.6% |
| 🟢 | `enum: small ⊆ large (true)` | 711.76 ns | 707.15 ns | 754.46 ns | 2.8% | 1.40M ops/s | `░░█▒░░░░░░░░░░░░░░░░` | ⬆️ +3.9% |
| 🟢 | `enum: single value ⊆ type (true)` | 731.88 ns | 696.71 ns | 1.26 µs | 23.3% | 1.37M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +11.4% |
| 🟢 | `numeric: multipleOf(3) ⊄ multipleOf(6) (false)` | 749.78 ns | 712.76 ns | 953.16 ns | 13.2% | 1.33M ops/s | `░█▒░░░░░░░░░░░░░░░░░` | ⬆️ +8.5% |
| 🟢 | `numeric: loose [0,100] ⊄ strict [5,10] (false)` | 759.80 ns | 730.24 ns | 1.25 µs | 26.1% | 1.32M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +6.5% |
| 🟢 | `type array: [string,number] ⊄ [string] (false)` | 760.11 ns | 709.37 ns | 1.26 µs | 49.2% | 1.32M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +20.9% |
| 🟢 | `string: loose ⊄ strict (false)` | 789.00 ns | 744.22 ns | 1.26 µs | 25.8% | 1.27M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +8.5% |
| 🟢 | `type array: [string] ⊆ [string,null] (true)` | 794.85 ns | 755.71 ns | 1.08 µs | 37.3% | 1.26M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.4% |
| 🟢 | `type array: [string,null] ⊄ [string] (false)` | 832.95 ns | 798.30 ns | 1.40 µs | 36.7% | 1.20M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +13.4% |
| 🟢 | `type array: [string] ⊆ [string,number] (true)` | 840.19 ns | 760.66 ns | 1.61 µs | 46.5% | 1.19M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +12.6% |
| 🟡 | `type: string ⊄ number (false)` | 1.08 µs | 1.07 µs | 1.16 µs | 3.4% | 926.96K ops/s | `░░░▒▒█▒▒░░░░░░░░░░░░` | ⬆️ +15.5% |
| 🟡 | `const string ⊄ type number (false)` | 1.13 µs | 1.10 µs | 1.55 µs | 9.5% | 881.42K ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` | ⬆️ +11.5% |
| 🟡 | `required: more ⊆ less (true)` | 1.20 µs | 1.19 µs | 1.34 µs | 4.3% | 836.43K ops/s | `░░░░▒▒█▒░░░░░░░░░░░░` | ⬇️ -6.6% |
| 🟡 | `additionalProps: closed ⊆ open (true)` | 1.30 µs | 1.28 µs | 1.51 µs | 4.7% | 768.40K ops/s | `░░█▒░░░░░░░░░░░░░░░░` | ⬆️ +9.9% |
| 🟡 | `enum: large ⊄ small (false)` | 1.34 µs | 1.30 µs | 1.76 µs | 13.5% | 748.49K ops/s | `░░▒▒█▒▒▒▒░░░░░░░░░░░` | ⬆️ +8.2% |
| 🟡 | `array: loose ⊄ strict (false)` | 1.34 µs | 1.28 µs | 1.86 µs | 22.7% | 747.39K ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +16.1% |
| 🟡 | `required: less ⊄ more (false)` | 1.67 µs | 1.62 µs | 2.40 µs | 9.5% | 599.28K ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +13.1% |
| 🟡 | `anyOf: sub ⊆ sup (true)` | 1.84 µs | 1.84 µs | 1.93 µs | 2.5% | 543.63K ops/s | `░░░░▒▒▒▒█▒▒▒░░░░░░░░` | ⬆️ +9.2% |
| 🟡 | `additionalProps: open ⊄ closed (false)` | 1.94 µs | 1.90 µs | 2.35 µs | 7.0% | 514.53K ops/s | `░░▒█▒▒░░░░░░░░░░░░░░` | ⬆️ +15.7% |
| 🟡 | `deep 3-level: strict ⊆ loose (true)` | 2.37 µs | 2.34 µs | 2.60 µs | 3.6% | 421.31K ops/s | `░▒▒█▒▒▒▒░░░░░░░░░░░░` | ⬆️ +19.4% |
| 🟡 | `deep 4-level: strict ⊆ loose (true)` | 2.80 µs | 2.80 µs | 2.91 µs | 1.7% | 356.53K ops/s | `░░░░░▒▒▒█▒▒░░░░░░░░░` | ⬆️ +20.6% |
| 🟡 | `atomic ⊄ anyOf no match (false)` | 3.01 µs | 2.97 µs | 3.60 µs | 9.9% | 332.21K ops/s | `░░░▒▒▒▒█▒▒▒▒░░░░░░░░` | ⬆️ +5.9% |
| 🟡 | `deep 5-level: strict ⊆ loose (true)` | 3.37 µs | 3.35 µs | 3.48 µs | 1.4% | 296.90K ops/s | `░░░▒▒█▒▒▒▒░░░░░░░░░░` | ⬆️ +18.7% |
| 🟡 | `anyOf: sup ⊄ sub (false)` | 3.97 µs | 4.03 µs | 4.14 µs | 3.5% | 251.70K ops/s | `░░░░░░░░░░▒▒▒▒▒█▒░░░` | ⬆️ +10.4% |
| 🟡 | `deep 3-level: loose ⊄ strict (false)` | 4.16 µs | 4.02 µs | 4.35 µs | 14.5% | 240.57K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +23.9% |
| 🟡 | `oneOf discriminated ⊆ oneOf loose (true)` | 5.07 µs | 5.06 µs | 5.35 µs | 2.8% | 197.09K ops/s | `░░░░▒▒▒▒█▒▒▒░░░░░░░░` | ⬆️ +11.9% |
| 🟡 | `wide 20-prop schema vs 15-prop` | 5.93 µs | 5.92 µs | 6.04 µs | 1.2% | 168.73K ops/s | `░░▒▒▒▒▒▒▒█▒▒▒▒░░░░░░` | ⬆️ +12.0% |
| 🟡 | `deep 5-level: loose ⊄ strict (false)` | 6.00 µs | 5.84 µs | 6.39 µs | 11.5% | 166.55K ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +10.5% |
| 🟡 | `wide 15-prop schema vs 20-prop` | 9.86 µs | 9.78 µs | 10.28 µs | 3.6% | 101.45K ops/s | `░░░▒▒▒█▒▒▒░░░░░░░░░░` | ⬆️ +6.8% |

> **Spread:** fastest `boolean: false ⊆ false` is **34976.3x** faster than slowest `wide 15-prop schema vs 20-prop`

---

## Normalize

> 📄 `normalize.bench.ts` — 27 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `const: string` | 3.00 ns | 2.87 ns | 3.80 ns | 19.6% | 333.78M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -3.4% |
| 🟢 | `const: number` | 3.00 ns | 2.88 ns | 3.96 ns | 16.9% | 333.19M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -3.6% |
| 🟢 | `const: integer` | 3.07 ns | 2.90 ns | 5.57 ns | 19.1% | 325.55M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -2.6% |
| 🟢 | `const: boolean` | 3.32 ns | 3.00 ns | 6.10 ns | 26.2% | 301.38M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.8% |
| 🟢 | `boolean schema: false` | 3.80 ns | 3.73 ns | 4.61 ns | 6.4% | 262.87M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +11.3% |
| 🟢 | `boolean schema: true` | 4.32 ns | 4.17 ns | 5.88 ns | 10.9% | 231.61M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -1.3% |
| 🟢 | `enum: homogeneous [1,2,3]` | 4.57 ns | 3.93 ns | 8.82 ns | 34.3% | 218.86M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬇️ -7.9% |
| 🟢 | `const: object` | 4.74 ns | 3.60 ns | 8.46 ns | 41.0% | 211.11M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +1.2% |
| 🟢 | `complex schema (all keywords)` | 5.31 ns | 5.28 ns | 6.12 ns | 3.9% | 188.35M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ➡️ +0.6% |
| 🟢 | `contains (const)` | 5.32 ns | 5.30 ns | 6.08 ns | 3.1% | 187.87M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +5.5% |
| 🟢 | `oneOf branches (3 const)` | 5.32 ns | 5.30 ns | 6.12 ns | 3.0% | 187.86M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.0% |
| 🟢 | `additionalProperties (const)` | 5.32 ns | 5.29 ns | 6.18 ns | 3.2% | 187.83M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +6.6% |
| 🟢 | `patternProperties (2 patterns)` | 5.33 ns | 5.29 ns | 6.35 ns | 4.0% | 187.51M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.5% |
| 🟢 | `nested properties (3 const/enum props)` | 5.35 ns | 5.30 ns | 6.41 ns | 4.9% | 186.99M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +1.7% |
| 🟢 | `deeply nested (4 levels)` | 5.35 ns | 5.30 ns | 6.51 ns | 5.4% | 186.94M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ➡️ +0.2% |
| 🟢 | `array items (single const)` | 5.36 ns | 5.30 ns | 6.44 ns | 4.2% | 186.46M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +1.5% |
| 🟢 | `tuple items (3 const values)` | 5.37 ns | 5.30 ns | 6.60 ns | 8.2% | 186.39M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ +0.2% |
| 🟢 | `double negation not(not(X))` | 5.48 ns | 5.31 ns | 7.40 ns | 11.4% | 182.64M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +8.1% |
| 🟢 | `simple string (no inference)` | 5.48 ns | 5.30 ns | 7.71 ns | 12.6% | 182.47M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +14.7% |
| 🟢 | `const + enum (const ∉ enum)` | 5.49 ns | 5.32 ns | 7.59 ns | 13.5% | 182.12M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.5% |
| 🟢 | `enum: heterogeneous ['a',1,true,null]` | 5.56 ns | 5.39 ns | 7.66 ns | 13.9% | 179.85M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -12.9% |
| 🟢 | `const + enum (const ∈ enum)` | 5.57 ns | 5.40 ns | 7.46 ns | 17.6% | 179.52M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -5.2% |
| 🟢 | `anyOf branches (3 const)` | 5.61 ns | 5.57 ns | 6.52 ns | 3.2% | 178.20M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -4.5% |
| 🟢 | `propertyNames (double negation)` | 5.62 ns | 5.58 ns | 6.82 ns | 6.7% | 177.81M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -4.8% |
| 🟢 | `triple negation not(not(not(X)))` | 6.01 ns | 5.86 ns | 8.05 ns | 10.7% | 166.42M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +6.4% |
| 🟢 | `const: array` | 6.72 ns | 6.56 ns | 8.70 ns | 11.1% | 148.90M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +1.1% |
| 🟢 | `const: null` | 6.97 ns | 6.80 ns | 9.04 ns | 11.1% | 143.41M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +1.3% |

> **Spread:** fastest `const: string` is **2.3x** faster than slowest `const: null`

---

## Pattern Subset

> 📄 `pattern-subset.bench.ts` — 40 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `equivalent: identical patterns` | 0.07 ns | 0.07 ns | 0.09 ns | 120.7% | 13396.13M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ -0.3% |
| 🟢 | `identity: identical simple pattern` | 0.08 ns | 0.07 ns | 0.09 ns | 145.1% | 13318.64M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +1.8% |
| 🟢 | `identity: identical complex pattern` | 0.08 ns | 0.07 ns | 0.10 ns | 213.6% | 12080.10M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +2.9% |
| 🟢 | `non-trivial: abc` | 7.60 ns | 7.45 ns | 10.27 ns | 10.4% | 131.60M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +8.2% |
| 🟢 | `inclusion: literal ⊆ class (^abc$ ⊆ ^[a-z]+$)` | 8.58 ns | 7.83 ns | 48.15 ns | 61.7% | 116.49M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +35.3% |
| 🟢 | `inclusion: any ⊆ .* (universal)` | 8.64 ns | 7.86 ns | 47.55 ns | 61.1% | 115.80M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +1.4% |
| 🟢 | `sample count: default (^[a-z]{3}$ ⊆ ^[a-z]+$)` | 8.73 ns | 7.88 ns | 50.44 ns | 67.2% | 114.61M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -3.0% |
| 🟢 | `exclusion: letters ⊄ digits` | 8.75 ns | 7.88 ns | 48.29 ns | 63.7% | 114.33M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -2.2% |
| 🟢 | `trivial: empty string` | 8.81 ns | 8.69 ns | 11.39 ns | 9.4% | 113.57M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬇️ -10.6% |
| 🟢 | `sample count: low (50)` | 12.53 ns | 7.88 ns | 51.99 ns | 103.4% | 79.83M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ +0.6% |
| 🟢 | `non-trivial: ^[a-z]+$` | 12.58 ns | 12.48 ns | 14.88 ns | 4.4% | 79.52M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ➡️ -0.4% |
| 🟢 | `inclusion: any ⊆ .+ (non-empty universal)` | 13.59 ns | 7.77 ns | 67.60 ns | 115.6% | 73.57M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -6.5% |
| 🟢 | `non-equivalent: different cardinality` | 13.65 ns | 8.23 ns | 53.53 ns | 102.8% | 73.28M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ -1.0% |
| 🟢 | `non-trivial: ^[0-9]{3}$` | 13.86 ns | 13.42 ns | 17.78 ns | 8.4% | 72.17M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬇️ -2.1% |
| 🟢 | `trivial: (?:.*) (group universal)` | 14.96 ns | 14.80 ns | 17.95 ns | 5.7% | 66.87M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ➡️ +0.3% |
| 🟢 | `trivial: .+ (non-empty universal)` | 15.41 ns | 15.91 ns | 20.16 ns | 12.5% | 64.88M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬇️ -2.4% |
| 🟢 | `exclusion: digits ⊄ letters` | 16.31 ns | 7.75 ns | 98.68 ns | 137.3% | 61.30M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -27.8% |
| 🟢 | `trivial: ^.*$ (anchored universal)` | 18.39 ns | 18.34 ns | 21.62 ns | 5.6% | 54.39M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬇️ -10.6% |
| 🟢 | `trivial: .* (universal)` | 21.55 ns | 21.25 ns | 27.05 ns | 10.1% | 46.40M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬇️ -19.7% |
| 🟢 | `batch: 5 non-trivial patterns` | 31.76 ns | 31.43 ns | 35.92 ns | 4.7% | 31.49M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +1.2% |
| 🟢 | `sample count: high (500)` | 41.96 ns | 42.00 ns | 166.00 ns | 197.2% | 23.83M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.4% |
| 🟢 | `exclusion: uppercase ⊄ lowercase` | 43.52 ns | 43.67 ns | 54.23 ns | 9.0% | 22.98M ops/s | `░▒▒█░░░░░░░░░░░░░░░░` | ➡️ +0.3% |
| 🟢 | `exclusion: wider range ⊄ narrower` | 44.01 ns | 41.41 ns | 67.88 ns | 18.7% | 22.72M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ➡️ -1.0% |
| 🟢 | `inclusion: fixed quant ⊆ unbounded (^[a-z]{3}$ ⊆ ^[a-z]+$)` | 46.58 ns | 42.00 ns | 167.00 ns | 270.0% | 21.47M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +14.4% |
| 🟢 | `non-equivalent: disjoint character sets` | 48.30 ns | 49.23 ns | 61.50 ns | 12.4% | 20.70M ops/s | `░░▒▒█░░░░░░░░░░░░░░░` | ➡️ -0.4% |
| 🟢 | `inclusion: email-like ⊆ contains-@` | 48.59 ns | 42.00 ns | 208.00 ns | 190.9% | 20.58M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +11.5% |
| 🟢 | `inclusion: anchored prefix ⊆ partial (^[A-Z]{2}[0-9]{3}$ ⊆ ^[A-Z])` | 48.82 ns | 42.00 ns | 167.00 ns | 310.6% | 20.49M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +14.3% |
| 🟢 | `exclusion: unbounded ⊄ fixed` | 48.82 ns | 49.84 ns | 66.50 ns | 14.0% | 20.48M ops/s | `░▒▒█░░░░░░░░░░░░░░░░` | ⬆️ +4.5% |
| 🟢 | `realistic: SKU format ⊆ alphanumeric-dash` | 49.02 ns | 42.00 ns | 167.00 ns | 230.7% | 20.40M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.5% |
| 🟢 | `exclusion: alphanumeric ⊄ digits only` | 51.56 ns | 49.71 ns | 61.86 ns | 9.6% | 19.40M ops/s | `░░░█▒░░░░░░░░░░░░░░░` | ⬆️ +3.4% |
| 🟢 | `batch: 10 trivial patterns` | 61.09 ns | 60.03 ns | 70.51 ns | 4.3% | 16.37M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +3.3% |
| 🟢 | `inclusion: digits ⊆ alphanumeric` | 83.92 ns | 83.00 ns | 250.00 ns | 190.6% | 11.92M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +17.9% |
| 🟢 | `inclusion: sub-range ⊆ full range (^[a-f]+$ ⊆ ^[a-z]+$)` | 86.87 ns | 83.00 ns | 375.00 ns | 228.1% | 11.51M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +16.6% |
| 🟢 | `inclusion: fixed quant ⊆ range (^[0-9]{3}$ ⊆ ^[0-9]{1,5}$)` | 88.05 ns | 83.00 ns | 250.00 ns | 239.6% | 11.36M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -916.0% |
| 🟢 | `realistic: French postal ⊆ 5-digit` | 91.98 ns | 83.00 ns | 458.00 ns | 177.5% | 10.87M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -938.3% |
| 🟢 | `inclusion: specific format ⊆ generic (^FR[0-9]{5}$ ⊆ ^[A-Z]{2}[0-9]+$)` | 92.67 ns | 83.00 ns | 250.00 ns | 251.0% | 10.79M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +24.5% |
| 🟢 | `realistic: semver ⊆ digit-dot` | 93.42 ns | 83.00 ns | 459.00 ns | 165.7% | 10.70M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -54.3% |
| 🟢 | `non-equivalent: asymmetric inclusion (subset not equivalence)` | 97.16 ns | 91.40 ns | 119.53 ns | 10.6% | 10.29M ops/s | `░░░█▒░░░░░░░░░░░░░░░` | ⬆️ +1.3% |
| 🟢 | `inclusion: ISO date ⊆ digit-dash` | 106.85 ns | 83.00 ns | 625.00 ns | 213.8% | 9.36M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +7.4% |
| 🟢 | `realistic: UUID v4 ⊆ hex-dash` | 112.23 ns | 83.00 ns | 958.00 ns | 267.9% | 8.91M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +12.9% |

> **Spread:** fastest `equivalent: identical patterns` is **1503.5x** faster than slowest `realistic: UUID v4 ⊆ hex-dash`

---

## Real World

> 📄 `real-world.bench.ts` — 52 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `identity: all-keywords schema ⊆ itself` | 3.66 ns | 3.52 ns | 6.23 ns | 14.7% | 273.44M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ -0.8% |
| 🟢 | `identity: paginated output ⊆ itself` | 4.05 ns | 4.00 ns | 5.24 ns | 11.0% | 247.13M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬇️ -4.2% |
| 🟢 | `identity: API response ⊆ itself` | 4.05 ns | 3.91 ns | 5.77 ns | 14.6% | 247.11M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +5.2% |
| 🟢 | `intersect: all-keywords ∩ itself (idempotent)` | 5.10 ns | 5.03 ns | 6.54 ns | 8.5% | 196.18M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +36.5% |
| 🟢 | `double negation: normalize` | 5.38 ns | 5.29 ns | 6.93 ns | 9.0% | 185.89M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -13.1% |
| 🟢 | `format: email ∩ email (same)` | 5.46 ns | 5.30 ns | 7.88 ns | 13.3% | 183.23M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +32.8% |
| 🟢 | `format: email ∩ uri (conflict → null)` | 156.42 ns | 155.22 ns | 174.89 ns | 3.7% | 6.39M ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` | ➡️ +0.4% |
| 🟢 | `isEqual: all-keywords schema (same ref)` | 250.90 ns | 235.45 ns | 353.53 ns | 13.3% | 3.99M ops/s | `░░█▒▒░░░░░░░░░░░░░░░` | ⬆️ +17.2% |
| 🟢 | `isEqual: normalize + compare (double negation)` | 254.18 ns | 246.09 ns | 440.30 ns | 52.9% | 3.93M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬇️ -2.4% |
| 🟢 | `isEqual: API response vs expected input (different)` | 366.79 ns | 361.83 ns | 412.58 ns | 3.8% | 2.73M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +7.2% |
| 🟢 | `double negation: not(not(string)) ⊆ string` | 436.95 ns | 429.93 ns | 486.61 ns | 4.8% | 2.29M ops/s | `░░▒▒█▒▒▒▒░░░░░░░░░░░` | ⬆️ +3.9% |
| 🟢 | `format: hostname ⊆ idn-hostname` | 492.77 ns | 490.01 ns | 554.89 ns | 4.4% | 2.03M ops/s | `░░░▒▒█▒▒▒░░░░░░░░░░░` | ⬆️ +2.9% |
| 🟢 | `resolveConditions: allOf none match` | 497.22 ns | 364.81 ns | 1.95 µs | 73.2% | 2.01M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -24.3% |
| 🟢 | `format: email ⊆ idn-email` | 497.68 ns | 498.11 ns | 541.57 ns | 4.4% | 2.01M ops/s | `░░░▒▒▒█▒▒░░░░░░░░░░░` | ➡️ +0.5% |
| 🟢 | `format: uri ⊆ iri` | 511.72 ns | 504.72 ns | 609.01 ns | 5.8% | 1.95M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ➡️ -0.8% |
| 🟢 | `resolveConditions: nested config (fast)` | 562.94 ns | 251.89 ns | 1.73 µs | 87.0% | 1.78M ops/s | `▒█▒▒▒▒▒▒▒░░░░░░░░░░░` | ⬇️ -160.6% |
| 🟡 | `resolveConditions: allOf both match` | 1.22 µs | 924.62 ns | 3.13 µs | 50.4% | 821.87K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬇️ -29.0% |
| 🟡 | `constraints: nested valid runtime check` | 1.35 µs | 1.05 µs | 4.27 µs | 58.4% | 742.42K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -13.4% |
| 🟡 | `constraints: nested invalid runtime check` | 1.47 µs | 1.18 µs | 4.55 µs | 57.5% | 679.75K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -11.3% |
| 🟡 | `check: discriminated union → flexible input` | 2.13 µs | 2.11 µs | 2.36 µs | 3.4% | 469.72K ops/s | `░▒▒█▒▒░░░░░░░░░░░░░░` | ⬆️ +7.9% |
| 🟡 | `resolveConditions: nested config (safe)` | 2.84 µs | 2.72 µs | 4.26 µs | 32.2% | 351.51K ops/s | `░░░░░▒▒▒▒█▒▒▒▒▒▒░░░░` | ⬇️ -142.7% |
| 🟡 | `check: paginated output → expected input` | 2.93 µs | 2.90 µs | 3.10 µs | 2.9% | 341.43K ops/s | `░░░░░▒▒█▒▒▒░░░░░░░░░` | ⬆️ +1.2% |
| 🟡 | `pipeline: check + formatResult (webhook)` | 3.13 µs | 2.98 µs | 3.90 µs | 10.1% | 319.19K ops/s | `░░▒█▒▒▒▒▒░░░░░░░░░░░` | ⬆️ +1.4% |
| 🟡 | `check: webhook → strict event (incompatible)` | 3.46 µs | 2.88 µs | 8.58 µs | 128.5% | 289.30K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -9.3% |
| 🟡 | `deep 5-level: intersect` | 3.63 µs | 3.63 µs | 3.73 µs | 1.6% | 275.69K ops/s | `░░░░░░▒▒▒▒█▒▒░░░░░░░` | ➡️ +0.1% |
| 🟡 | `wide 10-prop: intersect` | 3.66 µs | 3.61 µs | 4.01 µs | 2.9% | 273.43K ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +8.7% |
| 🟡 | `intersect: paginated output ∩ paginated input` | 3.78 µs | 3.20 µs | 6.38 µs | 30.8% | 264.64K ops/s | `░▒█▒▒▒▒░░░░░░░░░░░░░` | ⬇️ -28.9% |
| 🟡 | `check: closed source + format + not` | 3.85 µs | 3.79 µs | 4.86 µs | 12.4% | 259.62K ops/s | `░░░▒▒▒▒█▒▒▒░░░░░░░░░` | ⬆️ +19.4% |
| 🟡 | `constraints: simple valid runtime check` | 3.92 µs | 3.58 µs | 8.38 µs | 40.4% | 255.40K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -1.2% |
| 🟡 | `deep 5-level: strict ⊆ loose` | 3.94 µs | 3.87 µs | 4.27 µs | 5.7% | 253.91K ops/s | `░░▒▒▒▒▒█▒▒▒▒▒▒▒▒░░░░` | ➡️ -0.4% |
| 🟡 | `pipeline: normalize + isSubset (API response)` | 3.95 µs | 4.03 µs | 4.17 µs | 4.6% | 252.92K ops/s | `░░▒▒▒▒▒▒▒▒▒▒▒▒█▒▒░░░` | ➡️ +0.0% |
| 🟡 | `wide 10-prop: strict ⊆ loose` | 4.06 µs | 4.06 µs | 4.28 µs | 2.4% | 246.01K ops/s | `░░░░░▒▒▒█▒░░░░░░░░░░` | ➡️ +0.9% |
| 🟡 | `check: API response → expected input (compatible)` | 4.07 µs | 3.63 µs | 8.13 µs | 39.7% | 245.51K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -3.7% |
| 🟡 | `intersect: API response ∩ expected input` | 4.18 µs | 4.15 µs | 4.45 µs | 4.2% | 239.43K ops/s | `░░░▒▒▒▒▒█▒▒▒▒▒░░░░░░` | ⬇️ -1.8% |
| 🟡 | `constraints: simple invalid runtime check` | 4.63 µs | 3.56 µs | 9.65 µs | 45.3% | 216.12K ops/s | `▒█▒▒░░░░░░░░░░░░░░░░` | ⬇️ -26.3% |
| 🟡 | `pipeline: resolveConditions + check (form)` | 5.09 µs | 4.82 µs | 6.32 µs | 10.5% | 196.45K ops/s | `░▒▒█▒▒▒░░░░░░░░░░░░░` | ⬆️ +10.8% |
| 🟡 | `deep 8-level: intersect` | 5.35 µs | 5.36 µs | 5.46 µs | 1.6% | 186.93K ops/s | `░░░░▒▒▒▒▒▒▒█▒▒▒▒▒░░░` | ⬆️ +3.5% |
| 🟡 | `deep 8-level: strict ⊆ loose` | 5.61 µs | 5.61 µs | 5.66 µs | 0.8% | 178.14K ops/s | `░░░░▒▒▒▒█▒▒░░░░░░░░░` | ➡️ +0.1% |
| 🟡 | `deep 5-level: loose ⊄ strict` | 6.88 µs | 6.74 µs | 7.70 µs | 6.4% | 145.44K ops/s | `░░░░░▒█▒▒▒░░░░░░░░░░` | ⬇️ -3.9% |
| 🟡 | `deep 5-level: check (detailed diffs)` | 7.54 µs | 7.33 µs | 8.79 µs | 10.3% | 132.55K ops/s | `░░░░░▒█▒▒▒░░░░░░░░░░` | ⬇️ -5.3% |
| 🟡 | `wide 10-prop: check` | 8.29 µs | 8.22 µs | 8.91 µs | 4.4% | 120.58K ops/s | `░░░▒▒▒▒█▒▒▒░░░░░░░░░` | ⬆️ +6.7% |
| 🟡 | `deep 8-level: loose ⊄ strict` | 9.66 µs | 9.46 µs | 10.71 µs | 5.4% | 103.55K ops/s | `░░░░▒█▒▒▒░░░░░░░░░░░` | ⬆️ +5.6% |
| 🟡 | `wide 30-prop: intersect` | 9.78 µs | 9.68 µs | 10.15 µs | 3.0% | 102.25K ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` | ⬆️ +6.3% |
| 🟠 | `wide 30-prop: strict ⊆ loose` | 10.20 µs | 10.19 µs | 10.44 µs | 1.5% | 98.06K ops/s | `░░░░░▒▒▒▒█▒▒▒▒░░░░░░` | ⬆️ +8.4% |
| 🟠 | `deep 8-level: check (detailed diffs)` | 10.53 µs | 10.53 µs | 11.19 µs | 4.9% | 95.00K ops/s | `░░░░▒▒▒▒█▒░░░░░░░░░░` | ⬆️ +2.7% |
| 🟠 | `check+conditions: personal output ⊆ form (resolved)` | 13.93 µs | 13.95 µs | 14.19 µs | 3.0% | 71.81K ops/s | `░░░░░░░░░▒▒█░░░░░░░░` | ➡️ +0.3% |
| 🟠 | `wide 50-prop: intersect` | 15.19 µs | 15.05 µs | 15.86 µs | 2.8% | 65.82K ops/s | `░░░▒▒█▒░░░░░░░░░░░░░` | ⬆️ +5.0% |
| 🟠 | `check+conditions: business output ⊆ form (resolved)` | 15.44 µs | 14.63 µs | 26.42 µs | 40.8% | 64.76K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -1.1% |
| 🟠 | `wide 50-prop: strict ⊆ loose` | 16.05 µs | 15.97 µs | 16.40 µs | 1.7% | 62.29K ops/s | `░░░▒▒▒█▒▒▒▒▒▒░░░░░░░` | ⬆️ +5.8% |
| 🟠 | `pipeline: normalize + intersect + isEqual (commutativity)` | 16.74 µs | 15.52 µs | 17.11 µs | 19.9% | 59.75K ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +2.5% |
| 🟠 | `wide 30-prop: check` | 24.08 µs | 23.24 µs | 26.30 µs | 14.1% | 41.53K ops/s | `░░▒▒█░░░░░░░░░░░░░░░` | ⬆️ +1.7% |
| 🟠 | `wide 50-prop: check` | 41.78 µs | 40.47 µs | 48.89 µs | 12.0% | 23.94K ops/s | `░░▒▒▒█▒░░░░░░░░░░░░░` | ⬆️ +2.0% |

> **Spread:** fastest `identity: all-keywords schema ⊆ itself` is **11423.9x** faster than slowest `wide 50-prop: check`

---

## Resolve Conditions

> 📄 `resolve-conditions.bench.ts` — 38 benchmarks

|  | Benchmark | avg | p50 | p99 | σ | ops/s | Distribution | Δ |
|:--:|:---|---:|---:|---:|---:|---:|:---|:--:|
| 🟢 | `passthrough: no if/then/else` | 31.76 ns | 31.35 ns | 40.29 ns | 12.6% | 31.49M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬇️ -52.7% |
| 🟢 | `if anyOf: user role` | 97.48 ns | 91.20 ns | 151.12 ns | 15.8% | 10.26M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +36.4% |
| 🟢 | `property override: no override` | 105.86 ns | 102.35 ns | 142.01 ns | 10.0% | 9.45M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +16.4% |
| 🟢 | `additionalProperties override: true → false` | 129.18 ns | 114.79 ns | 234.08 ns | 26.3% | 7.74M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +34.4% |
| 🟢 | `if not: personal type → else` | 153.12 ns | 107.64 ns | 693.42 ns | 84.4% | 6.53M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ➡️ -0.9% |
| 🟢 | `simple: missing discriminant (empty data)` | 185.05 ns | 182.66 ns | 211.72 ns | 5.1% | 5.40M ops/s | `░░▒█░░░░░░░░░░░░░░░░` | ⬆️ +15.2% |
| 🟢 | `simple: else-branch (personal)` | 190.16 ns | 188.38 ns | 220.76 ns | 5.1% | 5.26M ops/s | `░░█░░░░░░░░░░░░░░░░░` | ⬆️ +14.6% |
| 🟢 | `if not: business type → then` | 191.86 ns | 125.00 ns | 1.25 µs | 153.0% | 5.21M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.9% |
| 🟢 | `nested: fast config → else (recursive)` | 199.73 ns | 197.69 ns | 229.21 ns | 4.5% | 5.01M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +41.9% |
| 🟢 | `simple: then-branch (business)` | 202.67 ns | 194.00 ns | 265.32 ns | 13.0% | 4.93M ops/s | `░░▒▒█▒▒▒░░░░░░░░░░░░` | ⬆️ +8.8% |
| 🟢 | `evaluate: nested object data (FR)` | 210.46 ns | 167.00 ns | 1.29 µs | 144.0% | 4.75M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +13.3% |
| 🟢 | `evaluate: nested object data (US)` | 213.10 ns | 136.64 ns | 1.05 µs | 99.6% | 4.69M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -24.0% |
| 🟢 | `allOf mixed: conditional + non-conditional (normal)` | 228.53 ns | 221.54 ns | 301.13 ns | 8.5% | 4.38M ops/s | `▒█░░░░░░░░░░░░░░░░░░` | ⬆️ +25.5% |
| 🟢 | `if anyOf: admin role` | 276.02 ns | 125.00 ns | 6.92 µs | 413.1% | 3.62M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -45.7% |
| 🟢 | `allOf else: production → else` | 285.89 ns | 279.53 ns | 352.48 ns | 6.9% | 3.50M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +24.5% |
| 🟢 | `if/then only: matching → then` | 335.24 ns | 166.00 ns | 7.79 µs | 382.6% | 2.98M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -66.6% |
| 🟢 | `allOf: no conditions match` | 357.42 ns | 354.47 ns | 403.97 ns | 3.8% | 2.80M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +16.0% |
| 🟢 | `if/then only: not matching → no extra constraints` | 360.30 ns | 216.79 ns | 1.00 µs | 85.2% | 2.78M ops/s | `▒▒▒█▒▒▒▒▒▒▒▒░░░░░░░░` | ⬇️ -44.1% |
| 🟢 | `evaluate: numeric minimum (adult)` | 362.24 ns | 125.00 ns | 8.79 µs | 367.5% | 2.76M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -65.5% |
| 🟢 | `evaluate: pattern match (valid)` | 395.00 ns | 167.00 ns | 9.08 µs | 341.3% | 2.53M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -80.9% |
| 🟢 | `allOf: second condition only` | 443.57 ns | 439.85 ns | 513.45 ns | 3.5% | 2.25M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬆️ +15.7% |
| 🟢 | `allOf else: debug → then` | 454.67 ns | 416.00 ns | 1.58 µs | 80.9% | 2.20M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +4.1% |
| 🟢 | `allOf: first condition only` | 457.75 ns | 461.73 ns | 533.66 ns | 6.2% | 2.18M ops/s | `░▒▒▒▒█▒░░░░░░░░░░░░░` | ⬆️ +27.7% |
| 🟢 | `allOf mixed: conditional + non-conditional (secret)` | 467.41 ns | 417.00 ns | 1.58 µs | 66.6% | 2.14M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +7.9% |
| 🟢 | `evaluate: numeric minimum (minor)` | 538.18 ns | 544.21 ns | 1.03 µs | 52.7% | 1.86M ops/s | `░░░▒▒▒▒▒▒█▒▒▒▒▒░░░░░` | ⬇️ -332.7% |
| 🟢 | `evaluate: format email (invalid)` | 544.88 ns | 533.52 ns | 649.51 ns | 6.9% | 1.84M ops/s | `░░░▒█▒░░░░░░░░░░░░░░` | ⬆️ +18.8% |
| 🟢 | `evaluate: pattern match (invalid)` | 545.41 ns | 561.30 ns | 1.02 µs | 51.1% | 1.83M ops/s | `░░░░▒▒▒▒▒▒█▒▒▒░░░░░░` | ⬇️ -252.9% |
| 🟢 | `combined: top-level + allOf (number)` | 547.56 ns | 535.66 ns | 647.75 ns | 5.2% | 1.83M ops/s | `░▒█▒░░░░░░░░░░░░░░░░` | ⬆️ +24.4% |
| 🟢 | `allOf: both conditions match` | 567.98 ns | 562.02 ns | 626.93 ns | 3.6% | 1.76M ops/s | `░█░░░░░░░░░░░░░░░░░░` | ⬆️ +26.7% |
| 🟢 | `array override: minItems 1 → 5` | 653.97 ns | 647.80 ns | 728.11 ns | 3.4% | 1.53M ops/s | `░▒█░░░░░░░░░░░░░░░░░` | ⬇️ -1.4% |
| 🟢 | `property override: maxLength reduced` | 669.91 ns | 541.00 ns | 3.42 µs | 84.6% | 1.49M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -68.1% |
| 🟢 | `evaluate: format email (valid)` | 687.71 ns | 542.00 ns | 2.04 µs | 68.2% | 1.45M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +20.2% |
| 🟢 | `combined: top-level + allOf (text)` | 733.12 ns | 666.00 ns | 2.17 µs | 64.6% | 1.36M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬆️ +14.2% |
| 🟢 | `nested: safe config → then (recursive)` | 769.92 ns | 759.94 ns | 831.48 ns | 3.2% | 1.30M ops/s | `░▒█▒▒░░░░░░░░░░░░░░░` | ⬆️ +26.2% |
| 🟢 | `if allOf: email method` | 922.02 ns | 458.00 ns | 12.79 µs | 246.7% | 1.08M ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -31.8% |
| 🟡 | `enum condition: premium → then` | 1.13 µs | 625.00 ns | 13.33 µs | 201.0% | 881.88K ops/s | `█░░░░░░░░░░░░░░░░░░░` | ⬇️ -10.6% |
| 🟡 | `if allOf: phone method` | 1.23 µs | 1.17 µs | 2.09 µs | 44.0% | 812.21K ops/s | `░░░░▒▒▒▒▒█▒▒▒▒▒░░░░░` | ⬇️ -136.4% |
| 🟡 | `enum condition: free → else` | 1.41 µs | 1.33 µs | 2.32 µs | 40.0% | 707.58K ops/s | `░░░░▒▒▒▒▒█▒▒▒▒▒░░░░░` | ⬇️ -141.7% |

> **Spread:** fastest `passthrough: no if/then/else` is **44.5x** faster than slowest `enum condition: free → else`

---

## Performance Overview

### Performance Tiers

| Tier | Count | % | Bar |
|:-----|------:|--:|:----|
| 🟢 Excellent (< 1µs) | 251 | 67% | █████████████████████████ |
| 🟡 Good (1µs – 10µs) | 110 | 29% | ███████████ |
| 🟠 Moderate (10µs – 100µs) | 13 | 3% | █ |
| 🔴 Slow (> 100µs) | 0 | 0% |  |

### Per-File Summary

| File | Benchmarks | Fastest | Slowest | Median |
|:-----|----------:|:--------|:--------|:-------|
| Check Connection | 11 | 7.33 ns | 4.80 µs | 2.36 µs |
| Check Resolved | 16 | 2.46 µs | 15.98 µs | 7.00 µs |
| Check | 21 | 22.39 ns | 4.94 µs | 1.40 µs |
| Constraints | 18 | 420.70 ns | 2.72 µs | 1.38 µs |
| Intersect | 76 | 3.97 ns | 2.73 µs | 479.53 ns |
| Is Equal | 20 | 14.40 ns | 1.23 µs | 129.68 ns |
| Is Subset | 55 | 0.28 ns | 9.86 µs | 711.76 ns |
| Normalize | 27 | 3.00 ns | 6.97 ns | 5.35 ns |
| Pattern Subset | 40 | 0.07 ns | 112.23 ns | 41.96 ns |
| Real World | 52 | 3.66 ns | 41.78 µs | 3.78 µs |
| Resolve Conditions | 38 | 31.76 ns | 1.41 µs | 395.00 ns |

## Top Performers

### ⚡ Fastest

| # | Benchmark | avg | ops/s | File |
|--:|:----------|----:|------:|:-----|
| 🥇 | `equivalent: identical patterns` | 0.07 ns | 13396.13M | Pattern Subset |
| 🥈 | `identity: identical simple pattern` | 0.08 ns | 13318.64M | Pattern Subset |
| 🥉 | `identity: identical complex pattern` | 0.08 ns | 12080.10M | Pattern Subset |
| 4 | `boolean: false ⊆ false` | 0.28 ns | 3548.27M | Is Subset |
| 5 | `boolean: true ⊆ true` | 0.66 ns | 1506.32M | Is Subset |
| 6 | `type: string ⊆ string (true)` | 1.64 ns | 609.43M | Is Subset |
| 7 | `identity: A ⊆ A (simple object)` | 2.30 ns | 435.70M | Is Subset |
| 8 | `identity: A ⊆ A (complex schema)` | 2.33 ns | 428.60M | Is Subset |
| 9 | `const: string` | 3.00 ns | 333.78M | Normalize |
| 10 | `const: number` | 3.00 ns | 333.19M | Normalize |

### 🐢 Slowest

| # | Benchmark | avg | ops/s | File |
|--:|:----------|----:|------:|:-----|
| 1 | `wide 50-prop: check` | 41.78 µs | 23.94K | Real World |
| 2 | `wide 30-prop: check` | 24.08 µs | 41.53K | Real World |
| 3 | `pipeline: normalize + intersect + isEqual (commutativity)` | 16.74 µs | 59.75K | Real World |
| 4 | `wide 50-prop: strict ⊆ loose` | 16.05 µs | 62.29K | Real World |
| 5 | `form: business output ⊆ conditional form (resolved)` | 15.98 µs | 62.56K | Check Resolved |
| 6 | `check+conditions: business output ⊆ form (resolved)` | 15.44 µs | 64.76K | Real World |
| 7 | `wide 50-prop: intersect` | 15.19 µs | 65.82K | Real World |
| 8 | `allOf: multiple conditions in allOf resolved` | 15.15 µs | 65.99K | Check Resolved |
| 9 | `form: personal output ⊆ conditional form (resolved)` | 15.14 µs | 66.06K | Check Resolved |
| 10 | `check+conditions: personal output ⊆ form (resolved)` | 13.93 µs | 71.81K | Real World |

### 🎯 Most Stable (lowest jitter)

| # | Benchmark | avg | σ | File |
|--:|:----------|----:|--:|:-----|
| 1 | `deep 8-level: strict ⊆ loose` | 5.61 µs | 0.8% | Real World |
| 2 | `wide 20-prop schema vs 15-prop` | 5.93 µs | 1.2% | Is Subset |
| 3 | `deep 5-level: strict ⊆ loose (true)` | 3.37 µs | 1.4% | Is Subset |
| 4 | `wide 30-prop: strict ⊆ loose` | 10.20 µs | 1.5% | Real World |
| 5 | `deep 8-level: intersect` | 5.35 µs | 1.6% | Real World |

### 🎲 Most Volatile (highest jitter)

| # | Benchmark | avg | σ | File |
|--:|:----------|----:|--:|:-----|
| 1 | `else-branch match (data → number)` | 7.00 µs | 581.3% | Check Resolved |
| 2 | `then-branch match (text → string)` | 7.75 µs | 558.7% | Check Resolved |
| 3 | `single data: then resolution` | 5.63 µs | 532.9% | Check Resolved |
| 4 | `order: loose input → strict output (incompatible, reverse)` | 4.80 µs | 521.1% | Check Connection |
| 5 | `if anyOf: admin role` | 276.02 ns | 413.1% | Resolve Conditions |

## Distribution Analysis

### Latency Histogram

```
  < 100 ns         │██████████████████████████████ 103
  100 ns – 500 ns  │███████████████████████████  91
  500 ns – 1 µs    │█████████████████  57
  1 µs – 5 µs      │███████████████████████████  91
  5 µs – 10 µs     │██████  19
  10 µs – 50 µs    │████  13
```

### Overall Statistics

| Metric | Value |
|:-------|------:|
| **Total benchmarks** | 374 |
| **Overall mean** | 1.73 µs |
| **Overall median** | 482.24 ns |
| **Overall P90** | 4.60 µs |
| **Fastest** | 0.07 ns (`equivalent: identical patterns`) |
| **Slowest** | 41.78 µs (`wide 50-prop: check`) |
| **Spread** | 559666x |
| **Avg jitter** | 45.3% |

## 📈 Comparison with Previous Run

> **262** improved · **79** regressed · **33** stable

### ⬆️ Improved

| Benchmark | Before | After | Change | File |
|:----------|-------:|------:|-------:|:-----|
| `boolean: true ∩ schema → schema` | 146.84 ns | 23.84 ns | **+83.8%** | Intersect |
| `patternProperties constraints: invalid object` | 3.83 µs | 803.70 ns | **+79.0%** | Constraints |
| `numeric: compatible ranges` | 1.87 µs | 414.26 ns | **+77.9%** | Intersect |
| `boolean: true ∩ false → false` | 101.42 ns | 22.68 ns | **+77.6%** | Intersect |
| `boolean: false ∩ schema → false` | 87.64 ns | 19.61 ns | **+77.6%** | Intersect |
| `const ∩ enum containing const` | 1.94 µs | 475.18 ns | **+75.5%** | Intersect |
| `any schema ⊆ true (true)` | 159.24 ns | 41.00 ns | **+74.3%** | Is Subset |
| `array item constraints: valid array` | 3.73 µs | 1.13 µs | **+69.8%** | Constraints |
| `boolean: false ⊆ true` | 93.55 ns | 29.02 ns | **+69.0%** | Is Subset |
| `true ⊄ concrete schema (false)` | 196.46 ns | 77.19 ns | **+60.7%** | Is Subset |

### ⬇️ Regressed

| Benchmark | Before | After | Change | File |
|:----------|-------:|------:|-------:|:-----|
| `realistic: French postal ⊆ 5-digit` | 8.86 ns | 91.98 ns | **-938.3%** | Pattern Subset |
| `inclusion: fixed quant ⊆ range (^[0-9]{3}$ ⊆ ^[0-9]{1,5}$)` | 8.67 ns | 88.05 ns | **-916.0%** | Pattern Subset |
| `evaluate: numeric minimum (minor)` | 124.38 ns | 538.18 ns | **-332.7%** | Resolve Conditions |
| `evaluate: pattern match (invalid)` | 154.56 ns | 545.41 ns | **-252.9%** | Resolve Conditions |
| `resolveConditions: nested config (fast)` | 215.98 ns | 562.94 ns | **-160.6%** | Real World |
| `resolveConditions: nested config (safe)` | 1.17 µs | 2.84 µs | **-142.7%** | Real World |
| `enum condition: free → else` | 584.80 ns | 1.41 µs | **-141.7%** | Resolve Conditions |
| `if allOf: phone method` | 520.83 ns | 1.23 µs | **-136.4%** | Resolve Conditions |
| `evaluate: pattern match (valid)` | 218.34 ns | 395.00 ns | **-80.9%** | Resolve Conditions |
| `property override: maxLength reduced` | 398.41 ns | 669.91 ns | **-68.1%** | Resolve Conditions |

---

*Generated by benchmark runner · 374 benchmarks · Tue, Mar 10, 2026 at 14:11:40*
