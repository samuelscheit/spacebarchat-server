import { writeFile } from "node:fs/promises";
import path from "node:path";

import { ensureDir, writeJsonFile } from "../../util/fs.js";
import { sha256 } from "../../util/hash.js";
import { sortForStableJson, tryParseJson } from "../../util/json.js";
import { AssetSnapshot, BuildSnapshot, DiscordClientChannel, StaticSnapshot } from "../../types.js";
import { redactText } from "../../processors/redact.js";

type FetchLike = typeof fetch;

export interface DiscordStaticSnapshotOptions {
    runId: string;
    channel: DiscordClientChannel;
    outputDir?: string;
    baseUrl?: string;
    apiBaseUrl?: string;
    downloadAssets?: boolean;
    discoverChunks?: boolean;
    maxAssets?: number;
    sourceRefs?: BuildSnapshot["source_refs"];
    fetchImpl?: FetchLike;
}

const channelBaseUrls: Record<DiscordClientChannel, string> = {
    stable: "https://discord.com",
    ptb: "https://ptb.discord.com",
    canary: "https://canary.discord.com",
};

export async function collectDiscordStaticSnapshot(options: DiscordStaticSnapshotOptions): Promise<StaticSnapshot> {
    const baseUrl = options.baseUrl ?? channelBaseUrls[options.channel];
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`${baseUrl}/login`);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${baseUrl}/login: ${response.status} ${response.statusText}`);
    }

    const loginHtml = await response.text();
    const assets = assetSnapshotsFromLoginHtml(loginHtml, baseUrl);
    const staticDir = options.outputDir ? path.join(options.outputDir, "static") : undefined;
    const downloadedAssets = options.downloadAssets
        ? await downloadAssetArtifacts(assets, {
              staticDir,
              fetchImpl,
              discoverChunks: options.discoverChunks ?? true,
              maxAssets: normalizeMaxAssets(options.maxAssets ?? 500),
          })
        : assets;

    const build = buildSnapshotFromHtml({
        runId: options.runId,
        channel: options.channel,
        baseUrl,
        apiBaseUrl: options.apiBaseUrl ?? "https://discord.com/api",
        xBuildId: response.headers.get("x-build-id") ?? undefined,
        loginHtml,
        assets: downloadedAssets,
        sourceRefs: options.sourceRefs ?? {},
    });

    if (options.outputDir) {
        const outputStaticDir = path.join(options.outputDir, "static");
        await ensureDir(outputStaticDir);
        await writeFile(path.join(outputStaticDir, "login.html"), loginHtml, "utf8");
        await writeJsonFile(path.join(outputStaticDir, "build.json"), build);
        await writeJsonFile(path.join(outputStaticDir, "assets.json"), downloadedAssets);
    }

    return {
        build,
        assets: downloadedAssets,
        login_html: loginHtml,
    };
}

export function assetSnapshotsFromLoginHtml(loginHtml: string, baseUrl: string): AssetSnapshot[] {
    const assets: AssetSnapshot[] = [];
    for (const match of loginHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
        const url = absolutize(match[1], baseUrl);
        assets.push({
            url,
            kind: "script",
            file_name: fileNameFromUrl(url),
            is_entrypoint: /(?:^|\/)web\.[^/]+\.js(?:$|\?)/.test(url),
        });
    }

    for (const match of loginHtml.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
        const tag = match[0];
        if (!/\brel=["']stylesheet["']/i.test(tag)) {
            continue;
        }

        const url = absolutize(match[1], baseUrl);
        assets.push({
            url,
            kind: "stylesheet",
            file_name: fileNameFromUrl(url),
        });
    }

    return dedupeAssets(assets);
}

export function buildSnapshotFromHtml(input: {
    runId: string;
    channel: DiscordClientChannel;
    baseUrl: string;
    apiBaseUrl: string;
    xBuildId?: string;
    loginHtml: string;
    assets: AssetSnapshot[];
    sourceRefs: BuildSnapshot["source_refs"];
}): BuildSnapshot {
    return {
        run_id: input.runId,
        channel: input.channel,
        base_url: input.baseUrl,
        api_base_url: input.apiBaseUrl,
        x_build_id: input.xBuildId ?? extractString(input.loginHtml, /"buildId"\s*:\s*"([^"]+)"/),
        build_number: extractString(input.loginHtml, /"buildNumber"\s*:\s*"?(\d+)"?/) ?? extractString(input.loginHtml, /\bbuild_number["']?\s*[:=]\s*["']?(\d+)/i),
        version_hash: extractString(input.loginHtml, /"versionHash"\s*:\s*"([^"]+)"/) ?? extractString(input.loginHtml, /\bversion_hash["']?\s*[:=]\s*["']([^"']+)/i),
        built_at: extractString(input.loginHtml, /"builtAt"\s*:\s*"([^"]+)"/),
        asset_hashes: input.assets.map((asset) => asset.hash ?? asset.file_name),
        source_refs: input.sourceRefs,
        collected_at: new Date().toISOString(),
    };
}

interface DownloadAssetArtifactsOptions {
    staticDir?: string;
    fetchImpl: FetchLike;
    discoverChunks: boolean;
    maxAssets: number;
}

export async function downloadAssetArtifacts(assets: AssetSnapshot[], options: DownloadAssetArtifactsOptions): Promise<AssetSnapshot[]> {
    const output: AssetSnapshot[] = [];
    const queued = [...assets];
    const seen = new Set(assets.map((asset) => asset.url));

    for (let index = 0; index < queued.length && output.length < options.maxAssets; index += 1) {
        const asset = queued[index];
        try {
            const response = await options.fetchImpl(asset.url);
            if (!response.ok) {
                output.push(asset);
                continue;
            }

            const bytes = new Uint8Array(await response.arrayBuffer());
            const hash = sha256(bytes);
            const localArtifact = options.staticDir ? await writeAssetFile(options.staticDir, asset, hash, bytes) : undefined;
            const downloadedAsset: AssetSnapshot = {
                ...asset,
                hash,
                bytes: bytes.byteLength,
                content_type: response.headers.get("content-type") ?? undefined,
                local_path: localArtifact?.local_path,
                local_hash: localArtifact?.local_hash,
                local_bytes: localArtifact?.local_bytes,
                local_redacted: localArtifact?.local_redacted,
            };
            output.push(downloadedAsset);

            if (options.discoverChunks && asset.kind === "script") {
                const text = new TextDecoder().decode(bytes);
                for (const discovered of discoverAssetReferences(text, asset.url)) {
                    if (!seen.has(discovered.url)) {
                        seen.add(discovered.url);
                        queued.push({
                            ...discovered,
                            discovered_from: asset.url,
                        });
                    }
                }
            }
        } catch {
            output.push(asset);
        }
    }

    return output;
}

export function discoverAssetReferences(sourceText: string, assetUrl: string): AssetSnapshot[] {
    const references: AssetSnapshot[] = [];
    for (const match of sourceText.matchAll(/["'`]([^"'`]+?\.(?:js|css))(?:\?[^"'`]*)?["'`]/gi)) {
        const raw = match[1];
        if (/^(?:data:|blob:|javascript:)/i.test(raw)) {
            continue;
        }

        try {
            const url = new URL(raw, assetUrl).toString();
            const kind = /\.css(?:$|\?)/i.test(url) ? "stylesheet" : "script";
            references.push({
                url,
                kind,
                file_name: fileNameFromUrl(url),
            });
        } catch {
            continue;
        }
    }
    for (const match of sourceText.matchAll(/sourceMappingURL\s*=\s*([^\s"'`]+)/gi)) {
        const raw = match[1];
        if (/^(?:data:|blob:|javascript:)/i.test(raw)) {
            continue;
        }

        try {
            const url = new URL(raw, assetUrl).toString();
            if (!new URL(url).pathname.endsWith(".map")) {
                continue;
            }
            references.push({
                url,
                kind: "other",
                file_name: fileNameFromUrl(url),
            });
        } catch {
            continue;
        }
    }

    return dedupeAssets(references);
}

async function writeAssetFile(
    staticDir: string,
    asset: AssetSnapshot,
    hash: string,
    bytes: Uint8Array,
): Promise<Pick<AssetSnapshot, "local_path" | "local_hash" | "local_bytes" | "local_redacted">> {
    const assetsDir = path.join(staticDir, "assets");
    await ensureDir(assetsDir);
    const fileName = assetFileName(asset, hash);
    const localPath = path.posix.join("assets", fileName);
    const durableBytes = durableAssetBytes(asset, bytes);
    const localHash = sha256(durableBytes);
    await writeFile(path.join(assetsDir, fileName), durableBytes);
    return {
        local_path: localPath,
        local_hash: localHash,
        local_bytes: durableBytes.byteLength,
        local_redacted: durableBytes.byteLength !== bytes.byteLength || localHash !== hash,
    };
}

function durableAssetBytes(asset: AssetSnapshot, bytes: Uint8Array): Uint8Array {
    if (!isSourceMapAsset(asset)) {
        return bytes;
    }

    const text = new TextDecoder().decode(bytes);
    const parsed = tryParseJson(text);
    const redacted = typeof parsed === "undefined" ? redactText(text) : `${JSON.stringify(sortForStableJson(redactSourceMapStrings(parsed)), null, "\t")}\n`;
    return new TextEncoder().encode(redacted);
}

function redactSourceMapStrings(value: unknown): unknown {
    if (typeof value === "string") {
        return redactText(value);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => redactSourceMapStrings(entry));
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        output[key] = redactSourceMapStrings(child);
    }
    return output;
}

function isSourceMapAsset(asset: AssetSnapshot): boolean {
    return /\.map(?:$|\?)/i.test(asset.url) || /\.map$/i.test(asset.file_name);
}

function assetFileName(asset: AssetSnapshot, hash: string): string {
    const hashPart = hash.replace(/^sha256:/, "").slice(0, 16);
    const fileName = asset.file_name || "asset";
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    return `${hashPart}-${safeName}`;
}

function absolutize(input: string, baseUrl: string): string {
    return new URL(input, baseUrl).toString();
}

function fileNameFromUrl(input: string): string {
    const url = new URL(input);
    return path.basename(url.pathname);
}

function dedupeAssets(assets: AssetSnapshot[]): AssetSnapshot[] {
    const seen = new Set<string>();
    const output: AssetSnapshot[] = [];
    for (const asset of assets) {
        if (seen.has(asset.url)) {
            continue;
        }

        seen.add(asset.url);
        output.push(asset);
    }

    return output;
}

function normalizeMaxAssets(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`maxAssets must be a positive integer, got ${value}`);
    }

    return value;
}

function extractString(text: string, pattern: RegExp): string | undefined {
    return pattern.exec(text)?.[1];
}
