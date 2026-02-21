import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { clearResults, getResults, setCurrentFile } from "./collect";
import { generateReport } from "./report";

const benchDir = import.meta.dir;
const args = process.argv.slice(2);

async function main() {
	let files: string[];

	if (args.length > 0) {
		const target = args[0] as string;
		const normalized = target.endsWith(".bench.ts")
			? target
			: `${target}.bench.ts`;

		const fullPath = resolve(benchDir, normalized);
		files = [fullPath];

		console.log(`\n🏃 Running single benchmark: ${basename(fullPath)}\n`);
	} else {
		files = readdirSync(benchDir)
			.filter((f) => f.endsWith(".bench.ts"))
			.sort()
			.map((f) => resolve(benchDir, f));

		console.log(`\n🏃 Running all benchmarks (${files.length} files)\n`);
	}

	clearResults();

	for (const file of files) {
		console.log(`\n${"═".repeat(70)}`);
		console.log(`📄 ${basename(file)}`);
		console.log(`${"═".repeat(70)}\n`);

		setCurrentFile(basename(file));
		await import(file);
	}

	generateReport(getResults());
}

main().catch((err) => {
	console.error("Benchmark runner failed:", err);
	process.exit(1);
});
