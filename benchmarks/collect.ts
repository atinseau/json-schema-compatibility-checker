import { run as mitataRun } from "mitata";

// Re-export everything from mitata so bench files only need to change the import path
export { bench, boxplot, do_not_optimize, summary } from "mitata";

interface Stats {
	debug: string;
	ticks: number;
	samples: number[];
	kind: "fn" | "iter" | "yield";
	min: number;
	max: number;
	avg: number;
	p25: number;
	p50: number;
	p75: number;
	p99: number;
	p999: number;
	gc?: { avg: number; min: number; max: number; total: number };
	heap?: { avg: number; min: number; max: number; total: number };
}

interface Run {
	name: string;
	args: Record<string, unknown>;
	stats?: Stats;
	error?: unknown;
}

interface Trial {
	runs: Run[];
	alias: string;
	baseline: boolean;
	args: Record<string, unknown[]>;
	kind: "args" | "static" | "multi-args";
	style: {
		compact: boolean;
		highlight: false | string;
	};
}

interface Context {
	now: number;
	arch: string | null;
	runtime: string | null;
	cpu: { freq: number; name: string | null };
	noop: { fn: Stats; iter: Stats };
}

interface RunResult {
	context: Context;
	benchmarks: Trial[];
}

export interface FileResult {
	file: string;
	context: Context;
	benchmarks: Trial[];
}

const collectedResults: FileResult[] = [];
let currentFile = "";

/**
 * Set the current benchmark file name.
 * Must be called before importing each `.bench.ts` file.
 */
export function setCurrentFile(file: string): void {
	currentFile = file;
}

/**
 * Wrapped version of mitata's `run()`.
 * Behaves identically but also stores the results for report generation.
 */
export async function run(
	opts?: Parameters<typeof mitataRun>[0],
): Promise<RunResult> {
	const result = await mitataRun(opts);

	collectedResults.push({
		file: currentFile,
		context: result.context,
		benchmarks: result.benchmarks,
	});

	return result;
}

/**
 * Returns all collected benchmark results so far.
 */
export function getResults(): readonly FileResult[] {
	return collectedResults;
}

/**
 * Clears all collected results.
 */
export function clearResults(): void {
	collectedResults.length = 0;
}
