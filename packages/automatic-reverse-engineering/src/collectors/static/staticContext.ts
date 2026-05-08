import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";

import { BuildSnapshot, SourceRefs } from "../../types.js";
import { ensureDir, readJsonFile, writeJsonFile } from "../../util/fs.js";
import { sha256 } from "../../util/hash.js";

export type StaticContextCatalogKind =
    | "routes"
    | "source_routes"
    | "gateway"
    | "experiments"
    | "docs_index"
    | "xhyrom_routes"
    | "xhyrom_experiments"
    | "userdoccers_routes"
    | "userdoccers_gateway";

export interface StaticContextFileEntry {
    kind: StaticContextCatalogKind;
    path: string;
    source_path: string;
    hash: string;
    bytes: number;
}

export interface StaticContextManifest {
    static_dir: string;
    generated_at: string;
    source_refs: SourceRefs;
    files: StaticContextFileEntry[];
}

export interface StaticContextBundleOptions {
    staticDir: string;
    catalogs?: Partial<Record<StaticContextCatalogKind, string>>;
    sourceRefs?: SourceRefs;
    manifestPath?: string;
    updateBuild?: boolean;
}

const outputNames: Record<StaticContextCatalogKind, string> = {
    routes: "routes.catalog.json",
    source_routes: "routes.source.catalog.json",
    gateway: "gateway.catalog.json",
    experiments: "experiments.catalog.json",
    docs_index: "docs.index.json",
    xhyrom_routes: "routes.xhyrom.catalog.json",
    xhyrom_experiments: "experiments.xhyrom.catalog.json",
    userdoccers_routes: "routes.userdoccers.catalog.json",
    userdoccers_gateway: "gateway.userdoccers.catalog.json",
};

export async function bundleStaticContext(options: StaticContextBundleOptions): Promise<StaticContextManifest> {
    await ensureDir(options.staticDir);
    const sourceRefs = options.sourceRefs ?? {};
    const buildPath = path.join(options.staticDir, "build.json");
    const build = Object.keys(sourceRefs).length > 0 && options.updateBuild !== false ? await readRequiredBuildSnapshot(buildPath) : undefined;
    const files: StaticContextFileEntry[] = [];

    for (const kind of Object.keys(outputNames) as StaticContextCatalogKind[]) {
        const sourcePath = options.catalogs?.[kind];
        if (!sourcePath) {
            continue;
        }

        files.push(await copyCatalog(kind, sourcePath, path.join(options.staticDir, outputNames[kind]), options.staticDir));
    }

    if (Object.keys(sourceRefs).length > 0) {
        await writeJsonFile(path.join(options.staticDir, "source_refs.json"), sourceRefs);
        if (build) {
            await writeJsonFile(buildPath, {
                ...build,
                source_refs: {
                    ...(build.source_refs ?? {}),
                    ...sourceRefs,
                },
            });
        }
    }

    const manifest: StaticContextManifest = {
        static_dir: portablePath(options.staticDir),
        generated_at: new Date().toISOString(),
        source_refs: sourceRefs,
        files,
    };
    await writeJsonFile(options.manifestPath ?? path.join(options.staticDir, "context.manifest.json"), manifest);
    return manifest;
}

async function copyCatalog(kind: StaticContextCatalogKind, sourcePath: string, outputPath: string, staticDir: string): Promise<StaticContextFileEntry> {
    const bytes = await readFile(sourcePath);
    if (path.resolve(sourcePath) !== path.resolve(outputPath)) {
        await ensureDir(path.dirname(outputPath));
        await copyFile(sourcePath, outputPath);
    }

    return {
        kind,
        path: relativePath(staticDir, outputPath),
        source_path: portableSourcePath(staticDir, sourcePath),
        hash: sha256(bytes),
        bytes: bytes.byteLength,
    };
}

async function readRequiredBuildSnapshot(buildPath: string): Promise<BuildSnapshot> {
    try {
        return await readJsonFile<BuildSnapshot>(buildPath);
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
            throw new Error(`Cannot merge source refs because static build snapshot is missing: ${buildPath}`);
        }
        throw error;
    }
}

function relativePath(root: string, filePath: string): string {
    return path.relative(root, filePath).split(path.sep).join(path.posix.sep);
}

function portableSourcePath(staticDir: string, sourcePath: string): string {
    const relativeToStaticDir = relativePath(staticDir, sourcePath);
    if (!relativeToStaticDir.startsWith("../")) {
        return relativeToStaticDir;
    }
    return portablePath(sourcePath);
}

function portablePath(filePath: string): string {
    if (!path.isAbsolute(filePath)) {
        return normalizePath(filePath);
    }

    const relativeToCwd = path.relative(process.cwd(), filePath);
    if (relativeToCwd && !relativeToCwd.startsWith("..") && !path.isAbsolute(relativeToCwd)) {
        return normalizePath(relativeToCwd);
    }

    return path.basename(filePath);
}

function normalizePath(filePath: string): string {
    return filePath.split(path.sep).join(path.posix.sep);
}
