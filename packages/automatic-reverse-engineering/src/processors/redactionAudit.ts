import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { scanForSecrets } from "./redact.js";
import { isRecord } from "../util/json.js";

export interface RedactionAuditViolation {
    file: string;
    line?: number;
    violations: string[];
}

export interface RedactionAuditResult {
    ok: boolean;
    violations: RedactionAuditViolation[];
}

const scannedExtensions = new Set([".json", ".ndjson", ".md", ".txt", ".har", ".sql", ".map"]);

export async function auditRedactionPaths(paths: string[]): Promise<RedactionAuditResult> {
    const files = (await Promise.all(paths.map((entry) => artifactFiles(entry)))).flat();
    const violations: RedactionAuditViolation[] = [];
    for (const file of files) {
        violations.push(...(await auditFile(file)));
    }

    return {
        ok: violations.length === 0,
        violations,
    };
}

async function artifactFiles(entry: string): Promise<string[]> {
    const details = await stat(entry);
    if (details.isFile()) {
        return scannedExtensions.has(path.extname(entry)) ? [entry] : [];
    }

    if (!details.isDirectory()) {
        return [];
    }

    const output: string[] = [];
    for (const child of await readdir(entry)) {
        output.push(...(await artifactFiles(path.join(entry, child))));
    }

    return output;
}

async function auditFile(file: string): Promise<RedactionAuditViolation[]> {
    const text = await readFile(file, "utf8");
    if (file.endsWith(".ndjson")) {
        return auditNdjson(file, text);
    }
    if (file.endsWith(".har")) {
        return auditHar(file, text);
    }
    if (file.endsWith(".json")) {
        return auditJson(file, text);
    }

    const scan = scanForSecrets(text);
    return scan.ok ? [] : [{ file, violations: scan.violations }];
}

function auditJson(file: string, text: string): RedactionAuditViolation[] {
    const textScan = scanForSecrets(text);
    const violations = [...textScan.violations];
    try {
        violations.push(...auditStorageStateArtifacts(JSON.parse(text) as unknown, "$"));
    } catch {
        // Invalid JSON is handled by the generic secret scan above.
    }

    return violations.length > 0 ? [{ file, violations: unique(violations) }] : [];
}

function auditNdjson(file: string, text: string): RedactionAuditViolation[] {
    const violations: RedactionAuditViolation[] = [];
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index].trim();
        if (!line) {
            continue;
        }

        const scan = scanForSecrets(line);
        if (!scan.ok) {
            violations.push({
                file,
                line: index + 1,
                violations: scan.violations,
            });
        }
    }

    return violations;
}

function auditHar(file: string, text: string): RedactionAuditViolation[] {
    const textScan = scanForSecrets(text);
    const violations: string[] = [...textScan.violations];
    let har: unknown;
    try {
        har = JSON.parse(text) as unknown;
    } catch {
        violations.push("har:invalid_json");
        return [{ file, violations: unique(violations) }];
    }

    if (!isRecord(har) || !isRecord(har.log) || !Array.isArray(har.log.entries)) {
        violations.push("har:missing_log_entries");
        return [{ file, violations: unique(violations) }];
    }

    har.log.entries.forEach((entry, index) => {
        if (!isRecord(entry)) {
            violations.push(`entries[${index}]:invalid_entry`);
            return;
        }
        if (!isRecord(entry.request)) {
            violations.push(`entries[${index}].request:missing`);
        }
        if (!isRecord(entry.response)) {
            violations.push(`entries[${index}].response:missing`);
        }

        violations.push(...auditHarEndpoint(`entries[${index}].request`, entry.request));
        violations.push(...auditHarEndpoint(`entries[${index}].response`, entry.response));
    });

    return violations.length > 0 ? [{ file, violations: unique(violations) }] : [];
}

function auditHarEndpoint(prefix: string, endpoint: unknown): string[] {
    if (!isRecord(endpoint)) {
        return [];
    }

    const violations: string[] = [];
    violations.push(...auditHarHeaders(`${prefix}.headers`, endpoint.headers));
    violations.push(...auditHarCookies(`${prefix}.cookies`, endpoint.cookies));
    violations.push(...auditHarNameValues(`${prefix}.queryString`, endpoint.queryString));

    if (isRecord(endpoint.postData)) {
        violations.push(...auditHarNameValues(`${prefix}.postData.params`, endpoint.postData.params));
        if (typeof endpoint.postData.text === "string" && endpoint.postData.text !== "{redacted_body}") {
            violations.push(`${prefix}.postData.text`);
        }
    }

    if (isRecord(endpoint.content) && typeof endpoint.content.text === "string" && endpoint.content.text !== "{redacted_body}") {
        violations.push(`${prefix}.content.text`);
    }

    return violations;
}

function auditStorageStateArtifacts(value: unknown, prefix: string): string[] {
    if (Array.isArray(value)) {
        return value.flatMap((entry, index) => auditStorageStateArtifacts(entry, `${prefix}[${index}]`));
    }

    if (!isRecord(value)) {
        return [];
    }

    const violations: string[] = [];
    if (isPlaywrightStorageState(value)) {
        violations.push(`${prefix}:playwright_storage_state_artifact`);
    }

    for (const [key, child] of Object.entries(value)) {
        violations.push(...auditStorageStateArtifacts(child, `${prefix}.${key}`));
    }
    return violations;
}

function isPlaywrightStorageState(value: Record<string, unknown>): boolean {
    if (!Array.isArray(value.cookies) || !Array.isArray(value.origins)) {
        return false;
    }

    return value.cookies.some(isPlaywrightStorageCookie) || value.origins.some(isPlaywrightStorageOrigin);
}

function isPlaywrightStorageCookie(value: unknown): boolean {
    return isRecord(value) && typeof value.name === "string" && typeof value.value === "string" && typeof value.domain === "string";
}

function isPlaywrightStorageOrigin(value: unknown): boolean {
    return (
        isRecord(value) &&
        typeof value.origin === "string" &&
        Array.isArray(value.localStorage) &&
        value.localStorage.some((entry) => isRecord(entry) && typeof entry.name === "string" && typeof entry.value === "string")
    );
}

function auditHarHeaders(prefix: string, headers: unknown): string[] {
    if (!Array.isArray(headers)) {
        return [];
    }

    const violations: string[] = [];
    headers.forEach((header, index) => {
        if (!isRecord(header) || typeof header.name !== "string") {
            return;
        }

        if (isSensitiveHarName(header.name) && !isRedactedValue(header.value)) {
            violations.push(`${prefix}[${index}].${header.name}`);
        }
    });

    return violations;
}

function auditHarCookies(prefix: string, cookies: unknown): string[] {
    if (!Array.isArray(cookies)) {
        return [];
    }

    const violations: string[] = [];
    cookies.forEach((cookie, index) => {
        if (isRecord(cookie) && !isRedactedValue(cookie.value)) {
            violations.push(`${prefix}[${index}]`);
        }
    });

    return violations;
}

function auditHarNameValues(prefix: string, values: unknown): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    const violations: string[] = [];
    values.forEach((entry, index) => {
        if (isRecord(entry) && typeof entry.value !== "undefined" && !isRedactedValue(entry.value)) {
            violations.push(`${prefix}[${index}]`);
        }
    });

    return violations;
}

function isSensitiveHarName(name: string): boolean {
    return /(authorization|cookie|set-cookie|token|secret|fingerprint|super|session|x-|referer|referrer)/i.test(name);
}

function isRedactedValue(value: unknown): boolean {
    return typeof value === "string" && /^\{[^}]+\}$/.test(value);
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values)).sort();
}
