import { FixtureManifest } from "../fixtures/manifest.js";
import { isRecord } from "../util/json.js";
import { normalizeUrl } from "./normalize.js";
import { redactHeaders, redactJsonValue, redactText } from "./redact.js";

export interface HarSanitizeOptions {
    fixtures?: FixtureManifest;
    stripBodies?: boolean;
}

type HeaderLike = { name?: unknown; value?: unknown; [key: string]: unknown };

export function sanitizeHar(har: unknown, options: HarSanitizeOptions = {}): unknown {
    const stripBodies = options.stripBodies ?? true;
    if (!isRecord(har)) {
        throw new Error("HAR must be a JSON object");
    }

    const sanitized = cloneRecord(har);
    const log = isRecord(sanitized.log) ? sanitized.log : undefined;
    const entries = Array.isArray(log?.entries) ? log.entries : [];
    for (const entry of entries) {
        if (!isRecord(entry)) {
            continue;
        }

        sanitizeRequest(entry.request, options, stripBodies);
        sanitizeResponse(entry.response, options, stripBodies);
    }

    return sanitized;
}

function sanitizeRequest(request: unknown, options: HarSanitizeOptions, stripBodies: boolean): void {
    if (!isRecord(request)) {
        return;
    }

    if (typeof request.url === "string") {
        request.url = sanitizeUrl(request.url, options);
    }

    request.headers = sanitizeHeaderArray(request.headers, options);
    request.cookies = sanitizeCookieArray(request.cookies);
    request.queryString = sanitizeNameValueArray(request.queryString, "{redacted_query}");

    if (isRecord(request.postData)) {
        request.postData = sanitizePostData(request.postData, options, stripBodies);
    }
}

function sanitizeResponse(response: unknown, options: HarSanitizeOptions, stripBodies: boolean): void {
    if (!isRecord(response)) {
        return;
    }

    response.headers = sanitizeHeaderArray(response.headers, options);
    response.cookies = sanitizeCookieArray(response.cookies);

    if (isRecord(response.content)) {
        if ((stripBodies && typeof response.content.text !== "undefined") || response.content.encoding === "base64") {
            response.content.text = "{redacted_body}";
            response.content.encoding = undefined;
        } else if (typeof response.content.text === "string") {
            response.content.text = redactText(response.content.text, { fixtures: options.fixtures });
        }
    }
}

function sanitizePostData(postData: Record<string, unknown>, options: HarSanitizeOptions, stripBodies: boolean): Record<string, unknown> {
    const sanitized = cloneRecord(postData);
    if (Array.isArray(sanitized.params)) {
        sanitized.params = sanitizeNameValueArray(sanitized.params, "{redacted_body}");
    }

    if ((stripBodies && typeof sanitized.text !== "undefined") || sanitized.encoding === "base64") {
        sanitized.text = "{redacted_body}";
        sanitized.encoding = undefined;
    } else if (typeof sanitized.text === "string") {
        sanitized.text = sanitizeBodyText(sanitized.text, options);
    }

    return sanitized;
}

function sanitizeHeaderArray(headers: unknown, options: HarSanitizeOptions): HeaderLike[] {
    if (!Array.isArray(headers)) {
        return [];
    }

    const asRecord: Record<string, string | undefined> = {};
    for (const header of headers) {
        if (isRecord(header) && typeof header.name === "string" && typeof header.value === "string") {
            asRecord[header.name] = header.value;
        }
    }

    const redacted = redactHeaders(asRecord, { fixtures: options.fixtures });
    return headers.flatMap((header) => {
        if (!isRecord(header) || typeof header.name !== "string") {
            return [];
        }

        return [
            {
                ...header,
                value: redacted[header.name] ?? "{redacted-header}",
            },
        ];
    });
}

function sanitizeCookieArray(cookies: unknown): HeaderLike[] {
    if (!Array.isArray(cookies)) {
        return [];
    }

    return cookies.flatMap((cookie) => {
        if (!isRecord(cookie)) {
            return [];
        }

        return [
            {
                ...cookie,
                value: "{redacted}",
            },
        ];
    });
}

function sanitizeNameValueArray(values: unknown, redactedValue: string): HeaderLike[] {
    if (!Array.isArray(values)) {
        return [];
    }

    return values.flatMap((entry) => {
        if (!isRecord(entry)) {
            return [];
        }

        return [
            {
                ...entry,
                value: typeof entry.value === "undefined" ? entry.value : redactedValue,
            },
        ];
    });
}

function sanitizeUrl(input: string, options: HarSanitizeOptions): string {
    try {
        return redactText(normalizeUrl(input, { fixtures: options.fixtures }).normalized_url, { fixtures: options.fixtures });
    } catch {
        return redactText(input, { fixtures: options.fixtures });
    }
}

function sanitizeBodyText(text: string, options: HarSanitizeOptions): unknown {
    try {
        return redactJsonValue(JSON.parse(text) as unknown, { fixtures: options.fixtures });
    } catch {
        return redactText(text, { fixtures: options.fixtures });
    }
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
