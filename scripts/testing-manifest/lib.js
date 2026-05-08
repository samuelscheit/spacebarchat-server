"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options", "all"]);
const DEFAULT_MANIFEST_PATH = path.join("assets", "testing-manifest.json");
const DEFAULT_POLICY_PATH = path.join("testing", "coverage-policy.json");

function toPosix(value) {
    return value.split(path.sep).join(path.posix.sep);
}

function readText(file) {
    return fs.readFileSync(file, "utf8");
}

function readJson(file) {
    return JSON.parse(readText(file));
}

function walkFiles(dir, predicate, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(file, predicate, files);
        } else if (!predicate || predicate(file)) {
            files.push(file);
        }
    }
    return files;
}

function lineOf(source, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (source.charCodeAt(i) === 10) line += 1;
    }
    return line;
}

function routePathFromFile(root, file) {
    let relative = toPosix(path.relative(root, file));
    relative = relative.replace(/\.(ts|js)$/, "");
    relative = relative.replaceAll("#", ":").replaceAll("!", "?");
    if (relative.endsWith("/index")) relative = relative.slice(0, -"/index".length);
    if (!relative) return "/";
    return `/${relative}`;
}

function combineRoutePaths(prefix, localPath) {
    const local = localPath || "/";
    if (prefix === "/" && local === "/") return "/";
    if (local === "/") return prefix.endsWith("/") ? prefix : `${prefix}/`;
    if (prefix === "/") return local.startsWith("/") ? local : `/${local}`;
    return `${prefix.replace(/\/+$/, "")}/${local.replace(/^\/+/, "")}`;
}

function stateAfterChar(source, index, state) {
    const char = source[index];
    const next = source[index + 1];

    if (state.mode === "line-comment") {
        if (char === "\n") state.mode = "code";
        return state;
    }

    if (state.mode === "block-comment") {
        if (char === "*" && next === "/") {
            state.mode = "code";
            state.skip = true;
        }
        return state;
    }

    if (state.mode === "string") {
        if (state.escape) {
            state.escape = false;
        } else if (char === "\\") {
            state.escape = true;
        } else if (char === state.quote) {
            state.mode = "code";
            state.quote = "";
        }
        return state;
    }

    if (char === "/" && next === "/") {
        state.mode = "line-comment";
        state.skip = true;
    } else if (char === "/" && next === "*") {
        state.mode = "block-comment";
        state.skip = true;
    } else if (char === '"' || char === "'" || char === "`") {
        state.mode = "string";
        state.quote = char;
        state.escape = false;
    }

    return state;
}

function findMatching(source, openIndex, openChar = "(", closeChar = ")") {
    let depth = 0;
    const state = { mode: "code", quote: "", escape: false, skip: false };

    for (let i = openIndex; i < source.length; i += 1) {
        state.skip = false;
        stateAfterChar(source, i, state);
        if (state.skip) {
            i += 1;
            continue;
        }
        if (state.mode !== "code") continue;

        const char = source[i];
        if (char === openChar) depth += 1;
        else if (char === closeChar) {
            depth -= 1;
            if (depth === 0) return i;
        }
    }

    return -1;
}

function splitTopLevelArguments(source) {
    const args = [];
    let start = 0;
    const depth = { "(": 0, "{": 0, "[": 0 };
    const state = { mode: "code", quote: "", escape: false, skip: false };

    for (let i = 0; i < source.length; i += 1) {
        state.skip = false;
        stateAfterChar(source, i, state);
        if (state.skip) {
            i += 1;
            continue;
        }
        if (state.mode !== "code") continue;

        const char = source[i];
        if (char === "(") depth["("] += 1;
        else if (char === ")") depth["("] -= 1;
        else if (char === "{") depth["{"] += 1;
        else if (char === "}") depth["{"] -= 1;
        else if (char === "[") depth["["] += 1;
        else if (char === "]") depth["["] -= 1;
        else if (char === "," && depth["("] === 0 && depth["{"] === 0 && depth["["] === 0) {
            args.push(source.slice(start, i).trim());
            start = i + 1;
        }
    }

    const tail = source.slice(start).trim();
    if (tail) args.push(tail);
    return args;
}

function parseStringLiteral(raw) {
    const value = raw.trim();
    const quote = value[0];
    if (!['"', "'", "`"].includes(quote) || value[value.length - 1] !== quote) return undefined;
    if (quote === "`" && value.includes("${")) return undefined;
    return value
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\(["'`\\])/g, "$1");
}

const KNOWN_ROUTE_METADATA_ARRAYS = Object.freeze({
    JOINED_PRIVATE_ARCHIVED_THREAD_PERMISSIONS: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
    PRIVATE_ARCHIVED_THREAD_PERMISSIONS: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "MANAGE_THREADS"],
    PUBLIC_ARCHIVED_THREAD_PERMISSIONS: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
});

function extractPropertyValue(objectText, propertyName) {
    const source = objectText.trim().replace(/^\{/, "").replace(/\}$/, "");
    const state = { mode: "code", quote: "", escape: false, skip: false };
    const propertyPattern = new RegExp(`\\b${propertyName}\\s*:`, "y");

    for (let i = 0; i < source.length; i += 1) {
        state.skip = false;
        stateAfterChar(source, i, state);
        if (state.skip) {
            i += 1;
            continue;
        }
        if (state.mode !== "code") continue;

        propertyPattern.lastIndex = i;
        const match = propertyPattern.exec(source);
        if (!match) continue;

        const before = source[i - 1];
        if (before && /[\w$]/.test(before)) continue;

        let start = propertyPattern.lastIndex;
        while (/\s/.test(source[start])) start += 1;

        const depth = { "(": 0, "{": 0, "[": 0 };
        const valueState = { mode: "code", quote: "", escape: false, skip: false };
        for (let j = start; j < source.length; j += 1) {
            valueState.skip = false;
            stateAfterChar(source, j, valueState);
            if (valueState.skip) {
                j += 1;
                continue;
            }
            if (valueState.mode !== "code") continue;

            const char = source[j];
            if (char === "(") depth["("] += 1;
            else if (char === ")") depth["("] -= 1;
            else if (char === "{") depth["{"] += 1;
            else if (char === "}") {
                if (depth["{"] === 0) return source.slice(start, j).trim();
                depth["{"] -= 1;
            } else if (char === "[") depth["["] += 1;
            else if (char === "]") depth["["] -= 1;
            else if (char === "," && depth["("] === 0 && depth["{"] === 0 && depth["["] === 0) {
                return source.slice(start, j).trim();
            }
        }

        return source.slice(start).trim();
    }

    return undefined;
}

function parseLiteralList(raw) {
    if (!raw) return undefined;
    const text = raw.trim();
    const stringValue = parseStringLiteral(text);
    if (stringValue !== undefined) return stringValue;
    if (!text.startsWith("[")) return text;
    return splitTopLevelArguments(text.slice(1, -1))
        .flatMap((item) => {
            const trimmed = item.trim();
            if (trimmed.startsWith("...")) return KNOWN_ROUTE_METADATA_ARRAYS[trimmed.slice(3)] || [trimmed];
            return [parseStringLiteral(item) ?? trimmed];
        })
        .filter(Boolean);
}

function normalizeEventValue(value) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    const stringValue = parseStringLiteral(trimmed);
    if (stringValue !== undefined) return stringValue;
    const memberMatch = /^(?:EVENT|WSEvents)\.([A-Z0-9_]+)$/.exec(trimmed);
    if (memberMatch) return memberMatch[1];
    if (/^[A-Z][A-Z0-9_]*$/.test(trimmed)) return trimmed;
    return undefined;
}

function extractEmittedEvents(source) {
    const events = [];

    for (const match of source.matchAll(/\bemitEvent\s*\(/g)) {
        const open = source.indexOf("(", match.index);
        const close = findMatching(source, open);
        if (open === -1 || close === -1) continue;

        const [payload] = splitTopLevelArguments(source.slice(open + 1, close));
        if (!payload || !payload.trim().startsWith("{")) continue;

        const parsed = parseLiteralList(extractPropertyValue(payload, "event"));
        const values = Array.isArray(parsed) ? parsed : [parsed];
        for (const value of values) {
            const event = normalizeEventValue(value);
            if (event) events.push(event);
        }
    }

    return [...new Set(events)].sort();
}

function parseRouteOptions(routeCallText) {
    const call = routeCallText.trim();
    const open = call.indexOf("(");
    if (open === -1) return undefined;
    const close = findMatching(call, open);
    if (close === -1) return undefined;

    const [optionsText] = splitTopLevelArguments(call.slice(open + 1, close));
    if (!optionsText || !optionsText.trim().startsWith("{")) return { present: true };

    const responseBodies = [];
    for (const match of optionsText.matchAll(/\bbody\s*:\s*(["'`][^"'`]+["'`])/g)) {
        const body = parseStringLiteral(match[1]);
        if (body) responseBodies.push(body);
    }

    const responseStatuses = [];
    for (const match of optionsText.matchAll(/(?:^|[,{]\s*)(\d{3})\s*:/g)) {
        responseStatuses.push(Number(match[1]));
    }

    return {
        present: true,
        permission: parseLiteralList(extractPropertyValue(optionsText, "permission")),
        right: parseLiteralList(extractPropertyValue(optionsText, "right")),
        requestBody: parseLiteralList(extractPropertyValue(optionsText, "requestBody")),
        event: parseLiteralList(extractPropertyValue(optionsText, "event")),
        responseBodies: [...new Set(responseBodies)].sort(),
        responseStatuses: [...new Set(responseStatuses)].sort((a, b) => a - b),
        hasQuery: extractPropertyValue(optionsText, "query") !== undefined,
    };
}

function extractRouteVariableMap(source) {
    const vars = new Map();
    const regex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*route\s*\(/g;
    for (const match of source.matchAll(regex)) {
        const open = source.indexOf("(", match.index);
        const close = findMatching(source, open);
        if (close !== -1) vars.set(match[1], source.slice(match.index + match[0].indexOf("route"), close + 1));
    }
    return vars;
}

function routeMetadataFromArguments(args, routeVariables) {
    let routeMetadata = { present: false };

    for (const arg of args.slice(1)) {
        const trimmed = arg.trim();
        if (trimmed.startsWith("route")) {
            routeMetadata = parseRouteOptions(trimmed) || { present: false };
            break;
        }
        if (routeVariables.has(trimmed)) {
            routeMetadata = parseRouteOptions(routeVariables.get(trimmed)) || { present: false };
            break;
        }
    }

    const emittedEvents = extractEmittedEvents(args.slice(1).join(","));
    if (emittedEvents.length) routeMetadata.emittedEvents = emittedEvents;

    return routeMetadata;
}

function scanRouterCalls(source) {
    const calls = [];
    const routeVariables = extractRouteVariableMap(source);
    const regex = /\brouter\.(get|post|put|delete|patch|head|options|all)\s*\(/g;

    for (const match of source.matchAll(regex)) {
        const method = match[1];
        const open = source.indexOf("(", match.index);
        const close = findMatching(source, open);
        if (close === -1) continue;

        const args = splitTopLevelArguments(source.slice(open + 1, close));
        const localPath = parseStringLiteral(args[0] || "");
        if (!localPath) continue;

        calls.push({
            method: method.toUpperCase(),
            localPath,
            line: lineOf(source, match.index),
            routeMetadata: routeMetadataFromArguments(args, routeVariables),
        });
    }

    return calls;
}

function scanAppCalls(source, appVariable = "app") {
    const calls = [];
    const routeVariables = extractRouteVariableMap(source);
    const regex = new RegExp(`\\b${appVariable}\\.(get|post|put|delete|patch|use)\\s*\\(`, "g");

    for (const match of source.matchAll(regex)) {
        const method = match[1];
        const open = source.indexOf("(", match.index);
        const close = findMatching(source, open);
        if (close === -1) continue;

        const args = splitTopLevelArguments(source.slice(open + 1, close));
        const routePath = parseStringLiteral(args[0] || "");
        if (!routePath) continue;
        if (method === "use" && !routePath.startsWith("/imageproxy")) continue;
        if (routePath.startsWith("/api")) continue;

        calls.push({
            method: method.toUpperCase(),
            path: routePath,
            line: lineOf(source, match.index),
            routeMetadata: routeMetadataFromArguments(args, routeVariables),
        });
    }

    return calls;
}

function parseRegexLiteral(raw) {
    const text = raw.trim();
    if (!text.startsWith("/")) return undefined;

    let escaped = false;
    let inCharacterClass = false;
    for (let i = 1; i < text.length; i += 1) {
        const char = text[i];
        if (escaped) {
            escaped = false;
        } else if (char === "\\") {
            escaped = true;
        } else if (char === "[") {
            inCharacterClass = true;
        } else if (char === "]") {
            inCharacterClass = false;
        } else if (char === "/" && !inCharacterClass) {
            return new RegExp(text.slice(1, i), text.slice(i + 1).replace(/[,\s].*$/, ""));
        }
    }

    return undefined;
}

function stripComments(source) {
    let result = "";
    const state = { mode: "code", quote: "", escape: false, skip: false };

    for (let i = 0; i < source.length; i += 1) {
        const previousMode = state.mode;
        state.skip = false;
        stateAfterChar(source, i, state);

        if (state.skip) {
            if (source[i] === "/" && source[i + 1] === "/") {
                result += "  ";
                i += 2;
                while (i < source.length && source[i] !== "\n") {
                    result += " ";
                    i += 1;
                }
                if (i < source.length) result += "\n";
                state.mode = "code";
                continue;
            }

            if (source[i] === "/" && source[i + 1] === "*") {
                result += "  ";
                i += 2;
                while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
                    result += source[i] === "\n" ? "\n" : " ";
                    i += 1;
                }
                if (i < source.length) result += "  ";
                i += 1;
                state.mode = "code";
                continue;
            }
        }

        if (previousMode === "line-comment" || previousMode === "block-comment") {
            result += source[i] === "\n" ? "\n" : " ";
        } else {
            result += source[i];
        }
    }

    return result;
}

function extractNoAuthorizationRules(repoRoot) {
    const file = path.join(repoRoot, "src", "api", "middlewares", "Authentication.ts");
    const source = readText(file);
    const start = source.indexOf("NO_AUTHORIZATION_ROUTES");
    const open = source.indexOf("[", start);
    const close = findMatching(source, open, "[", "]");
    if (open === -1 || close === -1) return [];

    return splitTopLevelArguments(stripComments(source.slice(open + 1, close)))
        .map((item) => {
            const stringValue = parseStringLiteral(item);
            if (stringValue !== undefined) return { type: "string", value: stringValue };
            const regex = parseRegexLiteral(item);
            if (regex) return { type: "regex", value: regex };
            return undefined;
        })
        .filter(Boolean);
}

function samplePathForAuth(pathValue) {
    return pathValue.replace(/:([A-Za-z_][\w]*)/g, (_match, name) => {
        if (name.includes("id")) return "123456789012345678";
        if (name.includes("token")) return "tokenvalue123";
        if (name.includes("connection_name")) return "github";
        if (name.includes("filename")) return "file.png";
        if (name.includes("url")) return "https://example.invalid/image.png";
        return "value";
    });
}

function stripOptionalTrailingSlash(value) {
    return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}

function isPublicApiRoute(entry, noAuthRules) {
    const sampledPath = samplePathForAuth(entry.path);
    const exactPath = stripOptionalTrailingSlash(sampledPath);
    const method = entry.method;

    return noAuthRules.some((rule) => {
        if (rule.type === "regex") return rule.value.test(`${method} ${sampledPath}`);
        const value = rule.value;
        if (!value.includes(" ")) return exactPath === value || sampledPath.startsWith(value);

        const routeMethod = value.split(" ")[0];
        const routePath = value.slice(routeMethod.length + 1);
        if (routeMethod !== method && !(method === "HEAD" && routeMethod === "GET")) return false;
        if (routePath.endsWith("/")) return sampledPath.startsWith(routePath);
        return exactPath === routePath;
    });
}

function authModeForHttpRoute(entry, noAuthRules) {
    if (entry.service === "api") {
        if (entry.mountedVia === "api-app") return "public-app-route";
        return isPublicApiRoute(entry, noAuthRules) ? "public" : "bearer";
    }

    if (entry.service === "cdn") {
        if (["POST", "PUT", "DELETE"].includes(entry.method)) return "request-signature";
        if (entry.path.includes("/attachments/")) return "signed-url-or-request-signature";
        return "public-cacheable";
    }

    return "unknown";
}

function rateLimitConfigRef(callArg) {
    const direct = /^routes\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/.exec(callArg.trim());
    const spread = /\.\.\.\s*routes\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/.exec(callArg);
    const match = direct || spread;
    if (!match) return undefined;

    const name = match[1];
    return {
        group: name,
        configPath: `limits.rate.routes.${name}`,
    };
}

function extractApiRateLimitRulesFromSource(source) {
    const rules = [];
    const regex = /\bapp\.use\s*\(\s*(["'`][^"'`]+["'`])\s*,\s*rateLimit\s*\(/g;

    for (const match of source.matchAll(regex)) {
        const pathPrefix = parseStringLiteral(match[1]);
        const rateLimitOpen = source.indexOf("(", match.index + match[0].lastIndexOf("rateLimit"));
        const rateLimitClose = findMatching(source, rateLimitOpen);
        if (!pathPrefix || rateLimitOpen === -1 || rateLimitClose === -1) continue;

        const [callArg] = splitTopLevelArguments(source.slice(rateLimitOpen + 1, rateLimitClose));
        const ref = rateLimitConfigRef(callArg || "");
        if (!ref) continue;

        rules.push({
            ...ref,
            pathPrefix,
            sourceFile: "src/api/middlewares/RateLimit.ts",
            line: lineOf(source, match.index),
        });
    }

    return rules;
}

function collectApiRateLimitRules(repoRoot) {
    return extractApiRateLimitRulesFromSource(readText(path.join(repoRoot, "src", "api", "middlewares", "RateLimit.ts")));
}

function pathMatchesPrefix(pathValue, pathPrefix) {
    return pathValue === pathPrefix || pathValue.startsWith(pathPrefix.endsWith("/") ? pathPrefix : `${pathPrefix}/`);
}

function applyRateLimitMetadata(entries, rules) {
    return entries.map((entry) => {
        if (entry.service !== "api" || entry.type !== "http-route" || entry.method === "OPTIONS") return entry;
        const rule = rules.find((candidate) => pathMatchesPrefix(entry.path, candidate.pathPrefix));
        if (!rule) return entry;

        return {
            ...entry,
            rateLimit: rule,
        };
    });
}

function makeHttpEntry({ service, method, routePath, sourceFile, line, routeMetadata, noAuthRules, mountedVia }) {
    return {
        id: `${service}:http:${method}:${routePath}`,
        type: "http-route",
        service,
        method,
        path: routePath,
        sourceFile,
        line,
        mountedVia,
        authMode: authModeForHttpRoute({ service, method, path: routePath, mountedVia }, noAuthRules),
        routeMetadata,
    };
}

function collectFilesystemHttpRoutes(repoRoot, service, noAuthRules) {
    const routeRoot = path.join(repoRoot, "src", service, "routes");
    const entries = [];

    for (const file of walkFiles(routeRoot, (value) => value.endsWith(".ts") && !value.endsWith(".test.ts")).sort()) {
        const source = readText(file);
        const routePrefix = routePathFromFile(routeRoot, file);
        const sourceFile = toPosix(path.relative(repoRoot, file));

        for (const call of scanRouterCalls(source)) {
            entries.push(
                makeHttpEntry({
                    service,
                    method: call.method,
                    routePath: combineRoutePaths(routePrefix, call.localPath),
                    sourceFile,
                    line: call.line,
                    routeMetadata: call.routeMetadata,
                    noAuthRules,
                }),
            );
        }
    }

    return entries;
}

function collectApiAppRoutes(repoRoot, noAuthRules) {
    const file = path.join(repoRoot, "src", "api", "Server.ts");
    const source = readText(file);
    return scanAppCalls(source, "app").map((call) =>
        makeHttpEntry({
            service: "api",
            method: call.method,
            routePath: call.path,
            sourceFile: toPosix(path.relative(repoRoot, file)),
            line: call.line,
            routeMetadata: call.routeMetadata,
            noAuthRules,
            mountedVia: "api-app",
        }),
    );
}

function collectCdnManualMounts(repoRoot, cdnEntries, noAuthRules) {
    const mountPrefixes = ["/guilds/:guild_id/users/:user_id/avatars", "/guilds/:guild_id/users/:user_id/banners"];
    const guildProfileEntries = cdnEntries.filter((entry) => entry.sourceFile === "src/cdn/routes/guild-profiles.ts");
    const entries = [];

    for (const mountPrefix of mountPrefixes) {
        for (const entry of guildProfileEntries) {
            const pathWithoutRoutePrefix = entry.path.replace(/^\/guild-profiles/, "") || "/";
            entries.push(
                makeHttpEntry({
                    service: "cdn",
                    method: entry.method,
                    routePath: combineRoutePaths(mountPrefix, pathWithoutRoutePrefix),
                    sourceFile: entry.sourceFile,
                    line: entry.line,
                    routeMetadata: entry.routeMetadata,
                    noAuthRules,
                    mountedVia: "src/cdn/Server.ts",
                }),
            );
        }
    }

    return entries;
}

function parseImports(source) {
    const imports = new Map();
    for (const match of source.matchAll(/import\s+\{\s*([^}]+)\s*\}\s+from\s+["'](.+)["']/g)) {
        for (const name of match[1]
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)) {
            imports.set(name, match[2]);
        }
    }
    return imports;
}

function parseEnumValues(source, enumName) {
    const enumIndex = source.indexOf(`enum ${enumName}`);
    if (enumIndex === -1) return new Map();
    const open = source.indexOf("{", enumIndex);
    const close = findMatching(source, open, "{", "}");
    const values = new Map();
    if (open === -1 || close === -1) return values;

    for (const match of source.slice(open + 1, close).matchAll(/\b([A-Z_]+)\s*=\s*(\d+)/g)) {
        values.set(match[1], Number(match[2]));
    }
    return values;
}

function handlerSourceFile(repoRoot, indexFile, importMap, handler) {
    const imported = importMap.get(handler);
    if (!imported || !imported.startsWith(".")) return toPosix(path.relative(repoRoot, indexFile));
    return toPosix(path.relative(repoRoot, path.resolve(path.dirname(indexFile), `${imported}.ts`)));
}

function collectGatewayOpcodes(repoRoot) {
    const file = path.join(repoRoot, "src", "gateway", "opcodes", "index.ts");
    const source = readText(file);
    const imports = parseImports(source);
    const entries = [];

    for (const match of source.matchAll(/^\s*(\d+)\s*:\s*([A-Za-z_$][\w$]*)/gm)) {
        const opcode = Number(match[1]);
        const handler = match[2];
        entries.push({
            id: `gateway:opcode:${opcode}`,
            type: "opcode",
            service: "gateway",
            opcode,
            name: handler.replace(/^on/, ""),
            handler,
            sourceFile: handler === "onHeartbeat" && opcode === 40 ? "src/gateway/opcodes/Heartbeat.ts" : handlerSourceFile(repoRoot, file, imports, handler),
            line: lineOf(source, match.index),
            authMode: opcode === 2 ? "token-identify" : "identified-session",
        });
    }

    return entries;
}

function collectWebRtcOpcodes(repoRoot) {
    const file = path.join(repoRoot, "src", "webrtc", "opcodes", "index.ts");
    const constantsFile = path.join(repoRoot, "src", "webrtc", "util", "Constants.ts");
    const source = readText(file);
    const enumValues = parseEnumValues(readText(constantsFile), "VoiceOPCodes");
    const imports = parseImports(source);
    const entries = [];

    for (const match of source.matchAll(/^\s*\[\s*VoiceOPCodes\.([A-Z_]+)\s*\]\s*:\s*([A-Za-z_$][\w$]*)/gm)) {
        const opcodeName = match[1];
        const handler = match[2];
        entries.push({
            id: `webrtc:opcode:${opcodeName}`,
            type: "opcode",
            service: "webrtc",
            opcode: enumValues.get(opcodeName),
            opcodeName,
            name: handler.replace(/^on/, ""),
            handler,
            sourceFile: handlerSourceFile(repoRoot, file, imports, handler),
            line: lineOf(source, match.index),
            authMode: opcodeName === "IDENTIFY" ? "voice-token-identify" : "identified-voice-session",
        });
    }

    return entries;
}

function routeMatchesRule(entry, rule) {
    if (rule.service && rule.service !== entry.service) return false;
    if (rule.type && rule.type !== entry.type) return false;
    if (rule.method && rule.method !== entry.method) return false;
    if (rule.path && rule.path !== entry.path) return false;
    if (rule.pathPrefix && !(entry.path === rule.pathPrefix || entry.path.startsWith(`${rule.pathPrefix}/`) || entry.path.startsWith(rule.pathPrefix))) return false;
    if (rule.sourceFile && rule.sourceFile !== entry.sourceFile) return false;
    return true;
}

function featureMatchesRule(entry, rule) {
    if (rule.service && rule.service !== entry.service) return false;
    if (rule.type && rule.type !== entry.type) return false;
    if (rule.matchId && rule.matchId !== entry.id) return false;
    if (rule.opcode !== undefined && String(rule.opcode) !== String(entry.opcode)) return false;
    if (rule.opcodeName && rule.opcodeName !== entry.opcodeName) return false;
    return true;
}

function coverageFromRule(rule) {
    return {
        policyId: rule.id,
        testTier: rule.testTier,
        benchmarkClass: rule.benchmarkClass,
        fixtureRequirements: rule.fixtureRequirements || [],
        contractChecks: rule.contractChecks || [],
        allowMissingRouteMetadata: Boolean(rule.allowMissingRouteMetadata),
        notes: rule.notes,
    };
}

function applyPolicy(entries, policy) {
    return entries.map((entry) => {
        const rules = entry.type === "http-route" ? policy.routeRules || [] : policy.featureRules || [];
        const rule = rules.find((candidate) => (entry.type === "http-route" ? routeMatchesRule(entry, candidate) : featureMatchesRule(entry, candidate)));
        return {
            ...entry,
            coverage: rule ? coverageFromRule(rule) : undefined,
        };
    });
}

function manualFeatureEntries(policy) {
    return (policy.manualFeatures || []).map((feature) => ({
        id: feature.id,
        type: "feature",
        service: feature.service,
        name: feature.name,
        sourceFile: feature.sourceFile,
        authMode: feature.authMode || "n/a",
        coverage: coverageFromRule(feature),
    }));
}

function summarize(entries) {
    const summary = {
        totalEntries: entries.length,
        byService: {},
        byType: {},
        byTestTier: {},
        byBenchmarkClass: {},
    };

    for (const entry of entries) {
        summary.byService[entry.service] = (summary.byService[entry.service] || 0) + 1;
        summary.byType[entry.type] = (summary.byType[entry.type] || 0) + 1;
        const testTier = entry.coverage?.testTier || "unclassified";
        const benchmarkClass = entry.coverage?.benchmarkClass || "unclassified";
        summary.byTestTier[testTier] = (summary.byTestTier[testTier] || 0) + 1;
        summary.byBenchmarkClass[benchmarkClass] = (summary.byBenchmarkClass[benchmarkClass] || 0) + 1;
    }

    return summary;
}

function sortEntries(entries) {
    return entries.sort((a, b) => {
        const left = [a.service, a.type, a.path || "", String(a.opcode ?? a.opcodeName ?? ""), a.method || "", a.id].join("|");
        const right = [b.service, b.type, b.path || "", String(b.opcode ?? b.opcodeName ?? ""), b.method || "", b.id].join("|");
        return left.localeCompare(right);
    });
}

function generateManifest(repoRoot, policyPath = path.join(repoRoot, DEFAULT_POLICY_PATH)) {
    const policy = readJson(policyPath);
    const noAuthRules = extractNoAuthorizationRules(repoRoot);
    const rateLimitRules = collectApiRateLimitRules(repoRoot);
    const apiRoutes = collectFilesystemHttpRoutes(repoRoot, "api", noAuthRules);
    const cdnRoutes = collectFilesystemHttpRoutes(repoRoot, "cdn", noAuthRules);
    const entries = sortEntries(
        applyPolicy(
            applyRateLimitMetadata(
                [
                    ...apiRoutes,
                    ...collectApiAppRoutes(repoRoot, noAuthRules),
                    ...cdnRoutes,
                    ...collectCdnManualMounts(repoRoot, cdnRoutes, noAuthRules),
                    ...collectGatewayOpcodes(repoRoot),
                    ...collectWebRtcOpcodes(repoRoot),
                ],
                rateLimitRules,
            ),
            policy,
        ).concat(manualFeatureEntries(policy)),
    );

    return {
        schemaVersion: 1,
        generatedBy: "scripts/testing-manifest/generate.js",
        policyFile: toPosix(path.relative(repoRoot, policyPath)),
        sources: [
            "src/api/routes",
            "src/api/Server.ts",
            "src/api/middlewares/RateLimit.ts",
            "src/cdn/routes",
            "src/cdn/Server.ts",
            "src/gateway/opcodes/index.ts",
            "src/webrtc/opcodes/index.ts",
            "testing/coverage-policy.json",
        ],
        summary: summarize(entries),
        entries,
    };
}

function validateManifest(manifest, repoRoot) {
    const errors = [];
    const ids = new Set();

    for (const entry of manifest.entries || []) {
        if (ids.has(entry.id)) errors.push(`Duplicate manifest id: ${entry.id}`);
        ids.add(entry.id);

        if (!entry.coverage?.policyId) errors.push(`${entry.id} has no coverage policy`);
        if (!entry.coverage?.testTier) errors.push(`${entry.id} has no test tier`);
        if (!entry.coverage?.benchmarkClass) errors.push(`${entry.id} has no benchmark class`);
        if (entry.sourceFile && !fs.existsSync(path.join(repoRoot, entry.sourceFile))) errors.push(`${entry.id} references missing source file ${entry.sourceFile}`);

        const isApiSourceRoute = entry.type === "http-route" && entry.service === "api" && entry.sourceFile?.startsWith("src/api/routes/");
        if (isApiSourceRoute && !entry.routeMetadata?.present && !entry.coverage?.allowMissingRouteMetadata) {
            errors.push(`${entry.id} is missing route({ ... }) metadata or an explicit policy waiver`);
        }
    }

    return errors;
}

function serializeManifest(manifest) {
    return `${JSON.stringify(manifest, null, 4)}\n`;
}

module.exports = {
    DEFAULT_MANIFEST_PATH,
    DEFAULT_POLICY_PATH,
    applyPolicy,
    combineRoutePaths,
    extractApiRateLimitRulesFromSource,
    generateManifest,
    parseRouteOptions,
    routePathFromFile,
    scanAppCalls,
    scanRouterCalls,
    serializeManifest,
    parseRegexLiteral,
    stripComments,
    splitTopLevelArguments,
    validateManifest,
};
