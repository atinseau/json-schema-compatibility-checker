import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FileResult } from "./collect";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchmarkEntry {
	name: string;
	avg: number;
	min: number;
	max: number;
	p25: number;
	p50: number;
	p75: number;
	p99: number;
	p999: number;
	samples: number;
	opsPerSec: number;
	stddev: number;
	jitter: number;
}

interface BenchmarkGroup {
	label: string;
	entries: BenchmarkEntry[];
}

interface FileReport {
	name: string;
	prettyName: string;
	groups: BenchmarkGroup[];
	totalBenchmarks: number;
	totalErrors: number;
}

interface ReportData {
	timestamp: string;
	runtime: string | null;
	cpu: string | null;
	cpuFreqGHz: number | null;
	arch: string | null;
	files: FileReport[];
	totals: {
		files: number;
		benchmarks: number;
		errors: number;
	};
}

interface PreviousEntry {
	name: string;
	avg: number;
	opsPerSec: number;
}

interface EntryWithFile extends BenchmarkEntry {
	file: string;
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatDuration(ns: number): { value: number; unit: string } {
	if (ns < 1_000) return { value: ns, unit: "ns" };
	if (ns < 1_000_000) return { value: ns / 1_000, unit: "µs" };
	if (ns < 1_000_000_000) return { value: ns / 1_000_000, unit: "ms" };
	return { value: ns / 1_000_000_000, unit: "s" };
}

function fmt(ns: number): string {
	const { value, unit } = formatDuration(ns);
	return `${value.toFixed(2)} ${unit}`;
}

function fmtOps(ops: number): string {
	if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M`;
	if (ops >= 1_000) return `${(ops / 1_000).toFixed(2)}K`;
	return ops.toFixed(0);
}

function fmtPercent(value: number): string {
	const sign = value > 0 ? "+" : "";
	return `${sign}${value.toFixed(1)}%`;
}

function perfBadge(ns: number): string {
	if (ns < 1_000) return "🟢";
	if (ns < 10_000) return "🟡";
	if (ns < 100_000) return "🟠";
	return "🔴";
}

function trendArrow(current: number, previous: number): string {
	const delta = ((current - previous) / previous) * 100;
	if (Math.abs(delta) < 1) return "➡️";
	return delta < 0 ? "⬆️" : "⬇️";
}

function _slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function prettifyFileName(name: string): string {
	return name
		.replace(/\.bench\.ts$/, "")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeStddev(samples: number[]): number {
	if (samples.length < 2) return 0;
	const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
	const variance =
		samples.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (samples.length - 1);
	return Math.sqrt(variance);
}

function distributionBar(
	min: number,
	p25: number,
	p50: number,
	p75: number,
	max: number,
	width = 30,
): string {
	if (max === min) return "█".repeat(width);

	const range = max - min;
	const p25Pos = Math.round(((p25 - min) / range) * width);
	const p50Pos = Math.round(((p50 - min) / range) * width);
	const p75Pos = Math.round(((p75 - min) / range) * width);

	const chars: string[] = [];
	for (let i = 0; i < width; i++) {
		if (i < p25Pos) chars.push("░");
		else if (i < p50Pos) chars.push("▒");
		else if (i === p50Pos) chars.push("█");
		else if (i < p75Pos) chars.push("▒");
		else chars.push("░");
	}
	return chars.join("");
}

function escapeMarkdown(text: string): string {
	return text.replace(/\|/g, "\\|").replace(/`/g, "\\`");
}

function formatTimestamp(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

function safeAt<T>(arr: T[], index: number): T | undefined {
	return arr[index];
}

function safeFirst<T>(arr: T[]): T | undefined {
	return arr[0];
}

function safeLast<T>(arr: T[]): T | undefined {
	return arr[arr.length - 1];
}

// ─── Data Extraction ─────────────────────────────────────────────────────────

function extractFileReport(fileResult: FileResult): FileReport {
	const groups: BenchmarkGroup[] = [];
	let totalBenchmarks = 0;
	let totalErrors = 0;
	let groupIndex = 0;

	for (const trial of fileResult.benchmarks) {
		const entries: BenchmarkEntry[] = [];

		for (const run of trial.runs) {
			if (run.error) {
				totalErrors++;
				continue;
			}
			if (!run.stats) continue;

			const { avg, min, max, p25, p50, p75, p99, p999, samples } = run.stats;
			const sd = computeStddev(samples);

			entries.push({
				name: run.name,
				avg,
				min,
				max,
				p25,
				p50,
				p75,
				p99,
				p999,
				samples: samples.length,
				opsPerSec: avg > 0 ? 1_000_000_000 / avg : 0,
				stddev: sd,
				jitter: avg > 0 ? (sd / avg) * 100 : 0,
			});
		}

		if (entries.length > 0) {
			groupIndex++;
			const label = trial.alias || `Group ${groupIndex}`;
			groups.push({ label, entries });
			totalBenchmarks += entries.length;
		}
	}

	return {
		name: fileResult.file,
		prettyName: prettifyFileName(fileResult.file),
		groups,
		totalBenchmarks,
		totalErrors,
	};
}

function buildReportData(results: readonly FileResult[]): ReportData {
	const firstCtx = safeFirst([...results])?.context;
	let totalBenchmarks = 0;
	let totalErrors = 0;

	const files = results.map((r) => {
		const report = extractFileReport(r);
		totalBenchmarks += report.totalBenchmarks;
		totalErrors += report.totalErrors;
		return report;
	});

	return {
		timestamp: new Date().toISOString(),
		runtime: firstCtx?.runtime ?? null,
		cpu: firstCtx?.cpu?.name ?? null,
		cpuFreqGHz: firstCtx?.cpu?.freq
			? Math.round(firstCtx.cpu.freq * 100) / 100
			: null,
		arch: firstCtx?.arch ?? null,
		files,
		totals: {
			files: files.length,
			benchmarks: totalBenchmarks,
			errors: totalErrors,
		},
	};
}

// ─── Previous Report Loading (for comparison) ────────────────────────────────

function loadPreviousEntries(
	reportsDir: string,
): Map<string, PreviousEntry> | null {
	const latestPath = join(reportsDir, "latest.md");
	if (!existsSync(latestPath)) return null;

	try {
		const content = readFileSync(latestPath, "utf-8");
		const map = new Map<string, PreviousEntry>();

		// Parse table rows from previous report
		// Format: | {badge} | `name` | avg | p50 | p99 | σ | ops/s | Distribution |
		// Badge and name are in separate cells
		const tableRowRegex =
			/^\|\s*(?:🟢|🟡|🟠|🔴)\s*\|\s*`([^`]+)`\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d.,]+[KM]?)\s*ops\/s\s*\|/gm;

		for (const match of content.matchAll(tableRowRegex)) {
			const name = match[1];
			const opsStr = match[2];

			if (!name || !opsStr) continue;

			let ops = 0;
			if (opsStr.endsWith("M")) {
				ops = Number.parseFloat(opsStr) * 1_000_000;
			} else if (opsStr.endsWith("K")) {
				ops = Number.parseFloat(opsStr) * 1_000;
			} else {
				ops = Number.parseFloat(opsStr.replace(/,/g, ""));
			}

			const avg = ops > 0 ? 1_000_000_000 / ops : 0;
			map.set(name, { name, avg, opsPerSec: ops });
		}

		return map.size > 0 ? map : null;
	} catch {
		return null;
	}
}

// ─── Collect all entries with file info ──────────────────────────────────────

function collectAllEntries(data: ReportData): EntryWithFile[] {
	return data.files.flatMap((f) =>
		f.groups.flatMap((g) =>
			g.entries.map((e) => ({ ...e, file: f.prettyName })),
		),
	);
}

// ─── Markdown Generation ─────────────────────────────────────────────────────

function generateMarkdown(
	data: ReportData,
	previousEntries: Map<string, PreviousEntry> | null,
): string {
	const L: string[] = [];
	const hasPrevious = previousEntries !== null && previousEntries.size > 0;

	// ── Header ──────────────────────────────────────────────────────────────

	L.push("# 📊 Benchmark Report");
	L.push("");
	L.push(`> Generated on **${formatTimestamp(data.timestamp)}**`);
	L.push("");

	// ── Environment ─────────────────────────────────────────────────────────

	L.push("## 🖥️ Environment");
	L.push("");
	L.push("| Property | Value |");
	L.push("|:---------|:------|");
	L.push(`| **Runtime** | ${data.runtime ?? "unknown"} |`);
	L.push(
		`| **CPU** | ${data.cpu ?? "unknown"}${data.cpuFreqGHz ? ` @ ${data.cpuFreqGHz} GHz` : ""} |`,
	);
	L.push(`| **Arch** | ${data.arch ?? "unknown"} |`);
	L.push(
		`| **Benchmarks** | ${data.totals.benchmarks} across ${data.totals.files} files |`,
	);
	if (data.totals.errors > 0) {
		L.push(`| **Errors** | ⚠️ ${data.totals.errors} |`);
	}
	L.push("");

	// ── Per-File Sections ───────────────────────────────────────────────────

	for (const file of data.files) {
		L.push(`## ${file.prettyName}`);
		L.push("");
		L.push(
			`> 📄 \`${file.name}\` — ${file.totalBenchmarks} benchmarks${file.totalErrors > 0 ? ` · ⚠️ ${file.totalErrors} errors` : ""}`,
		);
		L.push("");

		// Separate groups into "real" multi-entry groups and lone single-entry groups
		const multiGroups = file.groups.filter((g) => g.entries.length > 1);
		const singleGroups = file.groups.filter((g) => g.entries.length === 1);

		// Helper: render a table of benchmark entries
		const renderTable = (entries: BenchmarkEntry[]) => {
			const cols = [
				"",
				"Benchmark",
				"avg",
				"p50",
				"p99",
				"σ",
				"ops/s",
				"Distribution",
			];
			if (hasPrevious) cols.push("Δ");
			L.push(`| ${cols.join(" | ")} |`);
			L.push(
				`|:--:|:---|---:|---:|---:|---:|---:|:---|${hasPrevious ? ":--:|" : ""}`,
			);

			const sorted = [...entries].sort((a, b) => a.avg - b.avg);

			for (const entry of sorted) {
				const badge = perfBadge(entry.avg);
				const name = escapeMarkdown(entry.name);
				const avg = fmt(entry.avg);
				const p50 = fmt(entry.p50);
				const p99 = fmt(entry.p99);
				const jitter = `${entry.jitter.toFixed(1)}%`;
				const ops = `${fmtOps(entry.opsPerSec)} ops/s`;
				const dist = `\`${distributionBar(entry.min, entry.p25, entry.p50, entry.p75, entry.max, 20)}\``;

				const row = [badge, `\`${name}\``, avg, p50, p99, jitter, ops, dist];

				if (hasPrevious && previousEntries) {
					const prev = previousEntries.get(entry.name);
					if (prev) {
						const arrow = trendArrow(entry.avg, prev.avg);
						const delta = ((entry.avg - prev.avg) / prev.avg) * 100;
						row.push(`${arrow} ${fmtPercent(-delta)}`);
					} else {
						row.push("🆕");
					}
				}

				L.push(`| ${row.join(" | ")} |`);
			}

			L.push("");

			// Spread summary for multi-entry tables
			const fastest = safeFirst(sorted);
			const slowest = safeLast(sorted);
			if (sorted.length > 1 && fastest && slowest) {
				const ratio = slowest.avg / fastest.avg;
				L.push(
					`> **Spread:** fastest \`${escapeMarkdown(fastest.name)}\` is **${ratio.toFixed(1)}x** faster than slowest \`${escapeMarkdown(slowest.name)}\``,
				);
				L.push("");
			}
		};

		// Render multi-entry groups with their own section headers
		for (const group of multiGroups) {
			L.push(`### ${group.label}`);
			L.push("");
			renderTable(group.entries);
		}

		// Consolidate all single-entry groups into one table
		if (singleGroups.length > 0) {
			const consolidated = singleGroups.flatMap((g) => g.entries);

			if (multiGroups.length > 0) {
				// There were already sub-sections, give this one a heading too
				L.push("### Other");
				L.push("");
			}

			renderTable(consolidated);
		}

		L.push("---");
		L.push("");
	}

	// ── Performance Overview ────────────────────────────────────────────────

	const allEntries = collectAllEntries(data);

	L.push("## Performance Overview");
	L.push("");

	if (allEntries.length > 0) {
		// Distribution by performance tier
		const tiers = {
			excellent: allEntries.filter((e) => e.avg < 1_000),
			good: allEntries.filter((e) => e.avg >= 1_000 && e.avg < 10_000),
			moderate: allEntries.filter((e) => e.avg >= 10_000 && e.avg < 100_000),
			slow: allEntries.filter((e) => e.avg >= 100_000),
		};

		const total = allEntries.length;
		const pct = (n: number) => ((n / total) * 100).toFixed(0);

		L.push("### Performance Tiers");
		L.push("");
		L.push("| Tier | Count | % | Bar |");
		L.push("|:-----|------:|--:|:----|");

		const maxCount = Math.max(
			tiers.excellent.length,
			tiers.good.length,
			tiers.moderate.length,
			tiers.slow.length,
		);
		const barScale = maxCount > 0 ? 25 / maxCount : 0;

		L.push(
			`| 🟢 Excellent (< 1µs) | ${tiers.excellent.length} | ${pct(tiers.excellent.length)}% | ${"█".repeat(Math.round(tiers.excellent.length * barScale))} |`,
		);
		L.push(
			`| 🟡 Good (1µs – 10µs) | ${tiers.good.length} | ${pct(tiers.good.length)}% | ${"█".repeat(Math.round(tiers.good.length * barScale))} |`,
		);
		L.push(
			`| 🟠 Moderate (10µs – 100µs) | ${tiers.moderate.length} | ${pct(tiers.moderate.length)}% | ${"█".repeat(Math.round(tiers.moderate.length * barScale))} |`,
		);
		L.push(
			`| 🔴 Slow (> 100µs) | ${tiers.slow.length} | ${pct(tiers.slow.length)}% | ${"█".repeat(Math.round(tiers.slow.length * barScale))} |`,
		);
		L.push("");

		// Per-file summary
		L.push("### Per-File Summary");
		L.push("");
		L.push("| File | Benchmarks | Fastest | Slowest | Median |");
		L.push("|:-----|----------:|:--------|:--------|:-------|");

		for (const file of data.files) {
			const fileEntries = file.groups.flatMap((g) => g.entries);
			if (fileEntries.length === 0) continue;

			const sorted = [...fileEntries].sort((a, b) => a.avg - b.avg);
			const fastest = safeFirst(sorted);
			const slowest = safeLast(sorted);
			const medianIdx = Math.floor(sorted.length / 2);
			const median = safeAt(sorted, medianIdx);

			if (fastest && slowest && median) {
				L.push(
					`| ${file.prettyName} | ${fileEntries.length} | ${fmt(fastest.avg)} | ${fmt(slowest.avg)} | ${fmt(median.avg)} |`,
				);
			}
		}
		L.push("");
	}

	// ── Top Performers ──────────────────────────────────────────────────────

	L.push("## Top Performers");
	L.push("");

	if (allEntries.length > 0) {
		const sorted = [...allEntries].sort((a, b) => a.avg - b.avg);
		const topN = Math.min(10, sorted.length);

		L.push("### ⚡ Fastest");
		L.push("");
		L.push("| # | Benchmark | avg | ops/s | File |");
		L.push("|--:|:----------|----:|------:|:-----|");

		for (let i = 0; i < topN; i++) {
			const e = safeAt(sorted, i);
			if (!e) continue;
			const medal =
				i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
			L.push(
				`| ${medal} | \`${escapeMarkdown(e.name)}\` | ${fmt(e.avg)} | ${fmtOps(e.opsPerSec)} | ${e.file} |`,
			);
		}
		L.push("");

		L.push("### 🐢 Slowest");
		L.push("");
		L.push("| # | Benchmark | avg | ops/s | File |");
		L.push("|--:|:----------|----:|------:|:-----|");

		const slowest = sorted.slice(-topN).reverse();
		for (let i = 0; i < slowest.length; i++) {
			const e = safeAt(slowest, i);
			if (!e) continue;
			L.push(
				`| ${i + 1} | \`${escapeMarkdown(e.name)}\` | ${fmt(e.avg)} | ${fmtOps(e.opsPerSec)} | ${e.file} |`,
			);
		}
		L.push("");

		// Most stable (lowest jitter)
		const stableSorted = [...allEntries].sort((a, b) => a.jitter - b.jitter);
		const stableN = Math.min(5, stableSorted.length);

		L.push("### 🎯 Most Stable (lowest jitter)");
		L.push("");
		L.push("| # | Benchmark | avg | σ | File |");
		L.push("|--:|:----------|----:|--:|:-----|");

		for (let i = 0; i < stableN; i++) {
			const e = safeAt(stableSorted, i);
			if (!e) continue;
			L.push(
				`| ${i + 1} | \`${escapeMarkdown(e.name)}\` | ${fmt(e.avg)} | ${e.jitter.toFixed(1)}% | ${e.file} |`,
			);
		}
		L.push("");

		// Most unstable (highest jitter)
		const unstableSorted = [...allEntries].sort((a, b) => b.jitter - a.jitter);
		const unstableN = Math.min(5, unstableSorted.length);

		L.push("### 🎲 Most Volatile (highest jitter)");
		L.push("");
		L.push("| # | Benchmark | avg | σ | File |");
		L.push("|--:|:----------|----:|--:|:-----|");

		for (let i = 0; i < unstableN; i++) {
			const e = safeAt(unstableSorted, i);
			if (!e) continue;
			L.push(
				`| ${i + 1} | \`${escapeMarkdown(e.name)}\` | ${fmt(e.avg)} | ${e.jitter.toFixed(1)}% | ${e.file} |`,
			);
		}
		L.push("");
	}

	// ── Distribution Analysis ───────────────────────────────────────────────

	L.push("## Distribution Analysis");
	L.push("");

	if (allEntries.length > 0) {
		// Time-based histogram
		const buckets = [
			{ label: "< 100 ns", min: 0, max: 100 },
			{ label: "100 ns – 500 ns", min: 100, max: 500 },
			{ label: "500 ns – 1 µs", min: 500, max: 1_000 },
			{ label: "1 µs – 5 µs", min: 1_000, max: 5_000 },
			{ label: "5 µs – 10 µs", min: 5_000, max: 10_000 },
			{ label: "10 µs – 50 µs", min: 10_000, max: 50_000 },
			{ label: "50 µs – 100 µs", min: 50_000, max: 100_000 },
			{ label: "100 µs – 500 µs", min: 100_000, max: 500_000 },
			{ label: "500 µs – 1 ms", min: 500_000, max: 1_000_000 },
			{ label: "> 1 ms", min: 1_000_000, max: Number.POSITIVE_INFINITY },
		];

		const bucketCounts = buckets.map((b) => ({
			...b,
			count: allEntries.filter((e) => e.avg >= b.min && e.avg < b.max).length,
		}));

		const nonEmpty = bucketCounts.filter((b) => b.count > 0);
		const maxBucketCount = Math.max(...nonEmpty.map((b) => b.count));
		const histScale = maxBucketCount > 0 ? 30 / maxBucketCount : 0;

		L.push("### Latency Histogram");
		L.push("");
		L.push("```");

		for (const bucket of nonEmpty) {
			const bar = "█".repeat(Math.round(bucket.count * histScale));
			const paddedLabel = bucket.label.padEnd(16);
			const paddedCount = String(bucket.count).padStart(3);
			L.push(`  ${paddedLabel} │${bar} ${paddedCount}`);
		}

		L.push("```");
		L.push("");

		// Overall statistics
		const avgAll =
			allEntries.reduce((s, e) => s + e.avg, 0) / allEntries.length;
		const sortedAll = [...allEntries].sort((a, b) => a.avg - b.avg);
		const medianAll = safeAt(sortedAll, Math.floor(sortedAll.length / 2));
		const p90Idx = Math.floor(sortedAll.length * 0.9);
		const p90All = safeAt(sortedAll, p90Idx);
		const fastestAll = safeFirst(sortedAll);
		const slowestAll = safeLast(sortedAll);

		L.push("### Overall Statistics");
		L.push("");
		L.push("| Metric | Value |");
		L.push("|:-------|------:|");
		L.push(`| **Total benchmarks** | ${allEntries.length} |`);
		L.push(`| **Overall mean** | ${fmt(avgAll)} |`);
		if (medianAll) {
			L.push(`| **Overall median** | ${fmt(medianAll.avg)} |`);
		}
		if (p90All) {
			L.push(`| **Overall P90** | ${fmt(p90All.avg)} |`);
		}
		if (fastestAll) {
			L.push(
				`| **Fastest** | ${fmt(fastestAll.avg)} (\`${escapeMarkdown(fastestAll.name)}\`) |`,
			);
		}
		if (slowestAll) {
			L.push(
				`| **Slowest** | ${fmt(slowestAll.avg)} (\`${escapeMarkdown(slowestAll.name)}\`) |`,
			);
		}
		if (fastestAll && slowestAll && fastestAll.avg > 0) {
			L.push(
				`| **Spread** | ${(slowestAll.avg / fastestAll.avg).toFixed(0)}x |`,
			);
		}
		L.push(
			`| **Avg jitter** | ${(allEntries.reduce((s, e) => s + e.jitter, 0) / allEntries.length).toFixed(1)}% |`,
		);
		L.push("");
	}

	// ── Comparison with Previous ────────────────────────────────────────────

	if (hasPrevious && previousEntries) {
		const compared: {
			name: string;
			file: string;
			currentAvg: number;
			previousAvg: number;
			deltaPercent: number;
		}[] = [];

		for (const entry of allEntries) {
			const prev = previousEntries.get(entry.name);
			if (prev) {
				compared.push({
					name: entry.name,
					file: entry.file,
					currentAvg: entry.avg,
					previousAvg: prev.avg,
					deltaPercent: ((entry.avg - prev.avg) / prev.avg) * 100,
				});
			}
		}

		if (compared.length > 0) {
			L.push("## 📈 Comparison with Previous Run");
			L.push("");

			const improved = compared
				.filter((c) => c.deltaPercent < -1)
				.sort((a, b) => a.deltaPercent - b.deltaPercent);
			const regressed = compared
				.filter((c) => c.deltaPercent > 1)
				.sort((a, b) => b.deltaPercent - a.deltaPercent);
			const stable = compared.filter((c) => Math.abs(c.deltaPercent) <= 1);

			L.push(
				`> **${improved.length}** improved · **${regressed.length}** regressed · **${stable.length}** stable`,
			);
			L.push("");

			if (improved.length > 0) {
				L.push("### ⬆️ Improved");
				L.push("");
				L.push("| Benchmark | Before | After | Change | File |");
				L.push("|:----------|-------:|------:|-------:|:-----|");

				for (const c of improved.slice(0, 10)) {
					L.push(
						`| \`${escapeMarkdown(c.name)}\` | ${fmt(c.previousAvg)} | ${fmt(c.currentAvg)} | **${fmtPercent(-c.deltaPercent)}** | ${c.file} |`,
					);
				}
				L.push("");
			}

			if (regressed.length > 0) {
				L.push("### ⬇️ Regressed");
				L.push("");
				L.push("| Benchmark | Before | After | Change | File |");
				L.push("|:----------|-------:|------:|-------:|:-----|");

				for (const c of regressed.slice(0, 10)) {
					L.push(
						`| \`${escapeMarkdown(c.name)}\` | ${fmt(c.previousAvg)} | ${fmt(c.currentAvg)} | **${fmtPercent(-c.deltaPercent)}** | ${c.file} |`,
					);
				}
				L.push("");
			}
		}
	}

	// ── Footer ──────────────────────────────────────────────────────────────

	L.push("---");
	L.push("");
	L.push(
		`*Generated by benchmark runner · ${data.totals.benchmarks} benchmarks · ${formatTimestamp(data.timestamp)}*`,
	);
	L.push("");

	return L.join("\n");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a Markdown benchmark report from collected results.
 * Reports are saved to `benchmarks/reports/` directory.
 *
 * If a previous `latest.md` exists, includes a comparison section
 * showing regressions and improvements.
 *
 * Returns the path to the generated report directory.
 */
export function generateReport(results: readonly FileResult[]): string {
	if (results.length === 0) {
		console.log("\n⚠️  No benchmark results to report.\n");
		return "";
	}

	const data = buildReportData(results);
	const reportsDir = join(import.meta.dir, "reports");

	mkdirSync(reportsDir, { recursive: true });

	// Load previous report for comparison (before overwriting latest)
	const previousEntries = loadPreviousEntries(reportsDir);

	const dateSlug = data.timestamp
		.replace(/[:.]/g, "-")
		.replace("T", "_")
		.slice(0, 19);

	const mdPath = join(reportsDir, `${dateSlug}.md`);
	const latestMdPath = join(reportsDir, "latest.md");

	const markdown = generateMarkdown(data, previousEntries);

	writeFileSync(mdPath, markdown, "utf-8");
	writeFileSync(latestMdPath, markdown, "utf-8");

	console.log(`\n${"═".repeat(70)}`);
	console.log("📊 Benchmark Report Generated");
	console.log(`${"═".repeat(70)}`);
	console.log(`   📝 Report:  ${mdPath}`);
	console.log(`   🔗 Latest:  ${latestMdPath}`);
	console.log(
		`   📈 ${data.totals.benchmarks} benchmarks across ${data.totals.files} files${data.totals.errors > 0 ? ` (${data.totals.errors} errors)` : ""}`,
	);
	if (previousEntries) {
		console.log(
			`   🔄 Compared against previous run (${previousEntries.size} benchmarks)`,
		);
	}
	console.log("");

	return reportsDir;
}
