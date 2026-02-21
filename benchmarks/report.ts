import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FileResult } from "./collect";

interface BenchmarkEntry {
  name: string;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p75: number;
  p99: number;
  p999: number;
  samples: number;
  unit: string;
}

interface ReportData {
  timestamp: string;
  runtime: string | null;
  cpu: string | null;
  cpuFreqGHz: number | null;
  arch: string | null;
  files: {
    name: string;
    benchmarks: BenchmarkEntry[];
  }[];
  totals: {
    files: number;
    benchmarks: number;
    errors: number;
  };
}

function formatDuration(ns: number): { value: number; unit: string } {
  if (ns < 1_000) return { value: ns, unit: "ns" };
  if (ns < 1_000_000) return { value: ns / 1_000, unit: "µs" };
  if (ns < 1_000_000_000) return { value: ns / 1_000_000, unit: "ms" };
  return { value: ns / 1_000_000_000, unit: "s" };
}

function formatValue(ns: number): string {
  const { value, unit } = formatDuration(ns);
  return `${value.toFixed(2)} ${unit}`;
}

function extractBenchmarks(fileResult: FileResult): BenchmarkEntry[] {
  const entries: BenchmarkEntry[] = [];

  for (const trial of fileResult.benchmarks) {
    for (const run of trial.runs) {
      if (run.error || !run.stats) continue;

      const { avg, min, max, p50, p75, p99, p999, samples } = run.stats;
      const { unit } = formatDuration(avg);

      entries.push({
        name: run.name,
        avg,
        min,
        max,
        p50,
        p75,
        p99,
        p999,
        samples: samples.length,
        unit,
      });
    }
  }

  return entries;
}

function buildReportData(results: readonly FileResult[]): ReportData {
  const firstCtx = results[0]?.context;
  let totalBenchmarks = 0;
  let totalErrors = 0;

  const files = results.map((r) => {
    const benchmarks = extractBenchmarks(r);
    totalBenchmarks += benchmarks.length;

    for (const trial of r.benchmarks) {
      for (const run of trial.runs) {
        if (run.error) totalErrors++;
      }
    }

    return {
      name: r.file,
      benchmarks,
    };
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

function generateMarkdown(data: ReportData): string {
  const lines: string[] = [];

  lines.push("# Benchmark Report");
  lines.push("");
  lines.push(`**Date:** ${data.timestamp}`);
  lines.push(`**Runtime:** ${data.runtime ?? "unknown"}`);
  lines.push(`**CPU:** ${data.cpu ?? "unknown"}${data.cpuFreqGHz ? ` (~${data.cpuFreqGHz} GHz)` : ""}`);
  lines.push(`**Arch:** ${data.arch ?? "unknown"}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`> **${data.totals.benchmarks}** benchmarks across **${data.totals.files}** files${data.totals.errors > 0 ? ` · **${data.totals.errors}** errors` : ""}`);
  lines.push("");

  for (const file of data.files) {
    lines.push(`## ${file.name}`);
    lines.push("");

    if (file.benchmarks.length === 0) {
      lines.push("_No benchmark results._");
      lines.push("");
      continue;
    }

    lines.push("| Benchmark | avg | min | max | p75 | p99 |");
    lines.push("|:----------|----:|----:|----:|----:|----:|");

    for (const b of file.benchmarks) {
      const name = b.name.replace(/\|/g, "\\|");
      lines.push(
        `| ${name} | ${formatValue(b.avg)} | ${formatValue(b.min)} | ${formatValue(b.max)} | ${formatValue(b.p75)} | ${formatValue(b.p99)} |`,
      );
    }

    lines.push("");
  }

  // Summary: top 5 slowest and top 5 fastest
  const allBenchmarks = data.files.flatMap((f) =>
    f.benchmarks.map((b) => ({ ...b, file: f.name })),
  );

  if (allBenchmarks.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Summary");
    lines.push("");

    const sorted = [...allBenchmarks].sort((a, b) => a.avg - b.avg);

    lines.push("### ⚡ Top 5 Fastest");
    lines.push("");
    lines.push("| # | Benchmark | avg | File |");
    lines.push("|--:|:----------|----:|:-----|");
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      const b = sorted[i]!;
      lines.push(
        `| ${i + 1} | ${b.name.replace(/\|/g, "\\|")} | ${formatValue(b.avg)} | ${b.file} |`,
      );
    }
    lines.push("");

    lines.push("### 🐢 Top 5 Slowest");
    lines.push("");
    lines.push("| # | Benchmark | avg | File |");
    lines.push("|--:|:----------|----:|:-----|");
    const slowest = sorted.slice(-Math.min(5, sorted.length)).reverse();
    for (let i = 0; i < slowest.length; i++) {
      const b = slowest[i]!;
      lines.push(
        `| ${i + 1} | ${b.name.replace(/\|/g, "\\|")} | ${formatValue(b.avg)} | ${b.file} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateJSON(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Generate benchmark reports (Markdown + JSON) from collected results.
 * Reports are saved to `benchmarks/reports/` directory.
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

  const dateSlug = data.timestamp
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  const mdPath = join(reportsDir, `${dateSlug}.md`);
  const jsonPath = join(reportsDir, `${dateSlug}.json`);
  const latestMdPath = join(reportsDir, "latest.md");
  const latestJsonPath = join(reportsDir, "latest.json");

  const markdown = generateMarkdown(data);
  const json = generateJSON(data);

  writeFileSync(mdPath, markdown, "utf-8");
  writeFileSync(jsonPath, json, "utf-8");
  writeFileSync(latestMdPath, markdown, "utf-8");
  writeFileSync(latestJsonPath, json, "utf-8");

  console.log(`\n${"═".repeat(70)}`);
  console.log("📊 Benchmark Report Generated");
  console.log(`${"═".repeat(70)}`);
  console.log(`   📝 Markdown: ${mdPath}`);
  console.log(`   📦 JSON:     ${jsonPath}`);
  console.log(`   🔗 Latest:   ${latestMdPath}`);
  console.log(
    `   📈 ${data.totals.benchmarks} benchmarks across ${data.totals.files} files${data.totals.errors > 0 ? ` (${data.totals.errors} errors)` : ""}`,
  );
  console.log("");

  return reportsDir;
}
