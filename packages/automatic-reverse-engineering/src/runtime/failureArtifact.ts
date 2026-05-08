import path from "node:path";

import { FixtureManifest } from "../fixtures/manifest.js";
import { redactText, scanForSecrets } from "../processors/redact.js";
import { FeatureDefinition, RuntimeArtifactPaths, RuntimeFailureArtifact, RuntimeFailureStage, RuntimeRunArtifactManifest } from "../types.js";
import { writeJsonFile } from "../util/fs.js";
import { CaptureAbortError } from "./cdpNetworkRecorder.js";

export interface RuntimeFailureArtifactOptions {
    runId: string;
    feature: FeatureDefinition;
    stage: RuntimeFailureStage;
    error: unknown;
    fixtures?: FixtureManifest;
    artifacts?: RuntimeArtifactPaths;
}

export function buildRuntimeFailureArtifact(options: RuntimeFailureArtifactOptions): RuntimeFailureArtifact {
    const error = runtimeErrorDetails(options.error, options.fixtures);
    const artifact: RuntimeFailureArtifact = {
        run_id: options.runId,
        feature_id: options.feature.id,
        title: options.feature.title,
        stage: options.stage,
        failed_at: new Date().toISOString(),
        quarantine: true,
        redacted: true,
        error,
        artifacts: options.artifacts ?? {},
    };

    return artifact;
}

export async function writeRuntimeFailureArtifact(filePath: string, options: RuntimeFailureArtifactOptions): Promise<RuntimeFailureArtifact> {
    const featureDir = path.dirname(filePath);
    const artifact = buildRuntimeFailureArtifact({
        ...options,
        artifacts: {
            ...options.artifacts,
            failure_path: filePath,
        },
    });
    artifact.artifacts = normalizeRuntimeArtifactPaths(artifact.artifacts, featureDir);
    redactFailureMessageIfNeeded(artifact);
    await writeJsonFile(filePath, artifact);
    return artifact;
}

export async function writeRuntimeRunArtifacts(filePath: string, manifest: RuntimeRunArtifactManifest): Promise<void> {
    await writeJsonFile(filePath, normalizeRuntimeRunArtifactManifest(manifest, path.dirname(filePath)));
}

export function runtimeArtifactStatusForError(error: unknown): RuntimeRunArtifactManifest["status"] {
    return error instanceof CaptureAbortError ? "quarantined" : "failed";
}

function runtimeErrorDetails(error: unknown, fixtures: FixtureManifest | undefined): RuntimeFailureArtifact["error"] {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    const output: RuntimeFailureArtifact["error"] = {
        name: redactText(name, { fixtures }),
        message: redactText(message, { fixtures }),
    };

    if (error instanceof CaptureAbortError) {
        output.abort_reason = error.reason;
    }

    return output;
}

function redactFailureMessageIfNeeded(artifact: RuntimeFailureArtifact): void {
    if (!scanForSecrets(artifact).ok) {
        artifact.error.message = "Runtime failure message redacted because it matched secret patterns.";
        artifact.error.message_redacted = true;
    }
}

const runtimeArtifactPathKeys = [
    "preflight_path",
    "events_path",
    "playwright_events_path",
    "summary_path",
    "markdown_path",
    "trace_path",
    "screenshots_dir",
    "video_path",
    "redacted_har_path",
    "failure_path",
] as const;

function normalizeRuntimeRunArtifactManifest(manifest: RuntimeRunArtifactManifest, featureDir: string): RuntimeRunArtifactManifest {
    return {
        status: manifest.status,
        ...normalizeRuntimeArtifactPaths(manifest, featureDir),
    };
}

function normalizeRuntimeArtifactPaths(artifacts: RuntimeArtifactPaths, featureDir: string): RuntimeArtifactPaths {
    const output: RuntimeArtifactPaths = {};
    for (const key of runtimeArtifactPathKeys) {
        const value = artifacts[key];
        if (typeof value === "string") {
            output[key] = portableRuntimeArtifactPath(value, featureDir);
        }
    }
    return output;
}

function portableRuntimeArtifactPath(value: string, featureDir: string): string {
    if (path.win32.isAbsolute(value)) {
        return safeRelativePath(path.win32.basename(value));
    }
    const relativeToFeatureDir = path.relative(path.resolve(featureDir), path.resolve(value));
    if (relativeToFeatureDir && !relativeToFeatureDir.startsWith("..") && !path.isAbsolute(relativeToFeatureDir)) {
        return safeRelativePath(relativeToFeatureDir);
    }
    if (!path.isAbsolute(value)) {
        return safeRelativePath(value);
    }

    const relative = path.relative(featureDir, value);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
        return safeRelativePath(relative);
    }
    return path.basename(value);
}

function safeRelativePath(value: string): string {
    const portable = value.replace(/\\/g, path.posix.sep).split(path.sep).join(path.posix.sep);
    const normalized = path.posix.normalize(portable);
    if (!isSafeRuntimeRelativePath(portable) || normalized !== portable) {
        return safeRuntimeArtifactBasename(normalized);
    }
    return portable;
}

function safeRuntimeArtifactBasename(value: string): string {
    const basename = path.posix.basename(value);
    return isSafeRuntimeRelativePath(basename) ? basename : "artifact";
}

function isSafeRuntimeRelativePath(value: string): boolean {
    if (!value || value.includes("\0") || value.includes("\\")) {
        return false;
    }
    if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/u.test(value)) {
        return false;
    }
    const normalized = path.posix.normalize(value);
    return normalized === value && normalized !== "." && normalized !== ".." && !normalized.startsWith("../");
}
