#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildMissingRouteReport, RouteCatalogEntry, RouteCatalogSource } from "./index.js";

const defaultImplementedCatalog = "packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json";
const defaultTargetCatalogs = [
    "packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json",
    "packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json",
];
const defaultOutput = "packages/missing-routes/missing.json";
const defaultIgnoredMethods = ["HEAD", "OPTIONS"];

interface CliOptions {
    implemented?: string;
    targets: string[];
    out?: string;
    includeHeadOptions: boolean;
    help: boolean;
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    const repoRoot = await findRepoRoot();
    const implementedPath = await resolvePath(options.implemented ?? defaultImplementedCatalog, repoRoot);
    const targetPaths = await Promise.all((options.targets.length > 0 ? options.targets : defaultTargetCatalogs).map((target) => resolvePath(target, repoRoot)));
    const outputPath = path.resolve(repoRoot, options.out ?? defaultOutput);
    const report = buildMissingRouteReport(await readRouteCatalog(implementedPath, repoRoot), await Promise.all(targetPaths.map((target) => readRouteCatalog(target, repoRoot))), {
        ignoredMethods: options.includeHeadOptions ? [] : defaultIgnoredMethods,
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(`Spacebar is missing ${report.missing}`);
    console.log(`Spacebar implements ${report.spacebar}`);
    console.log(`Discord implements ${report.discord}`);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

function parseArgs(args: string[]): CliOptions {
    const options: CliOptions = {
        targets: [],
        includeHeadOptions: false,
        help: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        switch (arg) {
            case "--implemented":
                options.implemented = requiredValue(args, ++index, arg);
                break;
            case "--target":
                options.targets.push(requiredValue(args, ++index, arg));
                break;
            case "--targets":
                options.targets.push(...requiredValue(args, ++index, arg).split(",").filter(Boolean));
                break;
            case "--out":
                options.out = requiredValue(args, ++index, arg);
                break;
            case "--include-head-options":
                options.includeHeadOptions = parseBoolean(requiredValue(args, ++index, arg), arg);
                break;
            case "--help":
            case "-h":
                options.help = true;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

async function readRouteCatalog(filePath: string, repoRoot: string): Promise<RouteCatalogSource> {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!Array.isArray(parsed)) {
        throw new Error(`Route catalog must be a JSON array: ${filePath}`);
    }

    return {
        path: path.relative(repoRoot, filePath).split(path.sep).join(path.posix.sep),
        entries: parsed.filter(isRouteCatalogEntry),
    };
}

function isRouteCatalogEntry(value: unknown): value is RouteCatalogEntry {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const entry = value as Partial<RouteCatalogEntry>;
    return typeof entry.method === "string" && typeof entry.route === "string" && typeof entry.route_name === "string" && typeof entry.source === "string";
}

async function resolvePath(input: string, repoRoot: string): Promise<string> {
    if (path.isAbsolute(input)) {
        return input;
    }

    const cwdPath = path.resolve(process.cwd(), input);
    if (await exists(cwdPath)) {
        return cwdPath;
    }

    return path.resolve(repoRoot, input);
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function findRepoRoot(): Promise<string> {
    let current = path.dirname(fileURLToPath(import.meta.url));
    while (current !== path.dirname(current)) {
        if (await exists(path.join(current, "package.json")) && await exists(path.join(current, "packages", "automatic-reverse-engineering"))) {
            return current;
        }
        current = path.dirname(current);
    }

    return process.cwd();
}

function requiredValue(args: string[], index: number, flag: string): string {
    const value = args[index];
    if (!value || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
    }
    return value;
}

function parseBoolean(value: string, flag: string): boolean {
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    throw new Error(`${flag} must be true or false`);
}

function printUsage(): void {
    console.log(`Usage: spacebar-missing-routes [options]

Compares Spacebar's implemented route catalog against Discord route catalogs generated by packages/automatic-reverse-engineering.

Options:
  --implemented <path>             Implemented Spacebar catalog. Defaults to ${defaultImplementedCatalog}
  --target <path>                  Target Discord catalog. Repeatable.
  --targets <a,b>                  Comma-separated target catalog paths.
  --out <path>                     Output JSON path. Defaults to ${defaultOutput}
  --include-head-options <bool>    Include HEAD and OPTIONS target entries. Defaults to false.
  --help                           Show this help.
`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
