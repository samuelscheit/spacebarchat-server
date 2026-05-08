import { readFile } from "node:fs/promises";
import path from "node:path";

import { AssetSnapshot } from "../../types.js";
import { sha256 } from "../../util/hash.js";

export interface ExperimentCatalogEntry {
    key: string;
    value: string;
    source: string;
    context_hash: string;
    source_offset: number;
    module_id?: string;
}

const experimentPattern = /\b(experiment(?:Id|Name|Key)?|rollout(?:Id|Hash)?|treatment(?:Id|Name)?|holdout(?:Id|Name)?|bucket(?:Id|Name)?)["']?\s*[:=]\s*["']([^"'`]{2,160})["']/gi;

export async function extractExperimentCatalogFromAssets(staticDir: string, assets: AssetSnapshot[]): Promise<ExperimentCatalogEntry[]> {
    const entries: ExperimentCatalogEntry[] = [];
    for (const asset of assets) {
        if (asset.kind !== "script" || !asset.local_path) {
            continue;
        }

        const sourceText = await readAsset(staticDir, asset);
        if (!sourceText) {
            continue;
        }

        for (const match of sourceText.matchAll(experimentPattern)) {
            const sourceOffset = match.index ?? 0;
            entries.push({
                key: match[1],
                value: match[2],
                source: asset.file_name,
                context_hash: sha256(contextWindow(sourceText, sourceOffset)),
                source_offset: sourceOffset,
                module_id: moduleIdForOffset(sourceText, sourceOffset),
            });
        }
    }

    return dedupe(entries).sort((a, b) => `${a.key}:${a.value}:${a.source}`.localeCompare(`${b.key}:${b.value}:${b.source}`));
}

async function readAsset(staticDir: string, asset: AssetSnapshot): Promise<string | undefined> {
    try {
        return await readFile(path.join(staticDir, asset.local_path ?? ""), "utf8");
    } catch {
        return undefined;
    }
}

function contextWindow(sourceText: string, index: number): string {
    return sourceText.slice(Math.max(0, index - 120), Math.min(sourceText.length, index + 240));
}

function dedupe(entries: ExperimentCatalogEntry[]): ExperimentCatalogEntry[] {
    const seen = new Set<string>();
    const output: ExperimentCatalogEntry[] = [];
    for (const entry of entries) {
        const key = `${entry.key}:${entry.value}:${entry.source}:${entry.context_hash}`;
        if (!seen.has(key)) {
            seen.add(key);
            output.push(entry);
        }
    }

    return output;
}

function moduleIdForOffset(text: string, offset: number): string | undefined {
    const modulePattern = /(?:^|[,{]\s*|\/\*\*\*\/\s*)["']?([A-Za-z0-9_$.-]{1,100})["']?\s*:\s*(?:function\s*\(|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g;
    let match: RegExpExecArray | null;
    let moduleId: string | undefined;
    while ((match = modulePattern.exec(text)) !== null) {
        if (match.index > offset) {
            break;
        }

        moduleId = match[1];
    }

    return moduleId;
}
