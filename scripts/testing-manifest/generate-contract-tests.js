#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_MANIFEST_PATH } = require("./lib");

const DEFAULT_CONTRACT_MATRIX_PATH = path.join("test", "generated", "http-contracts.json");
const DEFAULT_CONTRACT_TEST_PATH = path.join("test", "generated", "http-contracts.test.js");
const DEFAULT_RUNTIME_CONTRACT_TEST_PATH = path.join("test", "generated", "http-auth-runtime-contracts.test.ts");
const IGNORED_RUNTIME_REQUEST_BODY_VALIDATION_SCHEMAS = new Set(["SettingsProtoUpdateJsonSchema"]);
const AUTHENTICATED_RESPONSE_SCHEMA_MANIFEST_IDS = new Set([
    "api:http:GET:/auth/sessions/",
    "api:http:GET:/auth/whoami/",
    "api:http:GET:/users/:user_id/",
    "api:http:GET:/users/:user_id/profile/",
    "api:http:GET:/users/:user_id/relationships/",
    "api:http:GET:/users/@me/",
    "api:http:GET:/users/@me/billing/location-info/",
    "api:http:GET:/users/@me/billing/payment-sources/",
    "api:http:GET:/users/@me/billing/payment-sources/:payment_source_id",
    "api:http:GET:/users/@me/channels/",
    "api:http:GET:/users/@me/collectibles-marketing/",
    "api:http:GET:/users/@me/guilds/",
    "api:http:GET:/users/@me/relationships/",
    "api:http:GET:/users/@me/settings/",
    "api:http:GET:/users/@me/settings-proto/1/",
    "api:http:GET:/users/@me/settings-proto/1/json",
    "api:http:GET:/users/@me/settings-proto/2/",
    "api:http:GET:/users/@me/settings-proto/2/json",
]);

function optionValue(args, name, fallback) {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sampleValueForParam(name) {
    if (name.includes("guild")) return "100000000000000001";
    if (name.includes("channel")) return "100000000000000002";
    if (name.includes("message")) return "100000000000000003";
    if (name.includes("user") || name.includes("member")) return "100000000000000004";
    if (name.includes("role")) return "100000000000000005";
    if (name.includes("webhook")) return "100000000000000006";
    if (name.includes("application")) return "100000000000000007";
    if (name.includes("command")) return "100000000000000008";
    if (name.includes("emoji")) return "100000000000000009";
    if (name.includes("sticker")) return "100000000000000010";
    if (name.includes("token")) return "test_token";
    if (name.includes("interaction")) return "100000000000000011";
    if (name.includes("filename")) return "file.png";
    if (name.includes("url")) return "https%3A%2F%2Fexample.invalid%2Ffile.png";
    if (name.includes("hash")) return "abcdef";
    if (name.includes("connection_name")) return "github";
    return "value";
}

function samplePath(pathValue) {
    return pathValue.replace(/:([A-Za-z_][\w]*)/g, (_match, name) => sampleValueForParam(name));
}

function hasRouteMetadata(entry, field) {
    return entry.routeMetadata && entry.routeMetadata[field] !== undefined;
}

function contractCases(entry) {
    const checks = new Set(entry.coverage?.contractChecks || []);
    const cases = [
        {
            id: "auth-boundary",
            checks:
                entry.authMode?.startsWith("public") || entry.authMode === "public-cacheable"
                    ? ["public-auth-boundary", "status"]
                    : ["authenticated", "unauthenticated-rejection", "status"],
        },
        {
            id: "status-and-error-shape",
            checks: ["status", "error-shape"],
        },
        {
            id: "response-shape",
            checks: ["response-shape"],
        },
    ];

    if (entry.service === "api" && entry.authMode === "bearer" && entry.method !== "OPTIONS") {
        cases.push({
            id: "malformed-auth",
            checks: ["invalid-auth", "error-shape"],
        });
    }

    if (hasRouteMetadata(entry, "requestBody")) {
        cases.push({
            id: "invalid-request-body",
            checks: ["schema-validation", "error-shape"],
            requestBody: entry.routeMetadata.requestBody,
        });
    }

    if (hasRouteMetadata(entry, "permission") || hasRouteMetadata(entry, "right")) {
        cases.push({
            id: "authorization-denied",
            checks: ["permission-denied", "error-shape"],
            permission: entry.routeMetadata.permission,
            right: entry.routeMetadata.right,
        });
    }

    if (entry.routeMetadata?.event) {
        cases.push({
            id: "event-emission",
            checks: ["events"],
            event: entry.routeMetadata.event,
        });
    }

    if (entry.service === "cdn") {
        cases.push({
            id: "cdn-object-contract",
            checks: ["missing-file", "mime", "cache-headers"],
        });

        if (["POST", "PUT", "DELETE"].includes(entry.method)) {
            cases.push({
                id: "cdn-mutation-auth",
                checks: ["request-signature", "status"],
            });
        }
    }

    for (const check of checks) {
        if (!cases.some((testCase) => testCase.checks.includes(check))) {
            cases.push({
                id: `policy-${check}`,
                checks: [check],
            });
        }
    }

    return cases;
}

function contractForEntry(entry) {
    return {
        manifestId: entry.id,
        service: entry.service,
        method: entry.method,
        path: entry.path,
        samplePath: samplePath(entry.path),
        sourceFile: entry.sourceFile,
        line: entry.line,
        authMode: entry.authMode,
        testTier: entry.coverage.testTier,
        benchmarkClass: entry.coverage.benchmarkClass,
        fixtureRequirements: entry.coverage.fixtureRequirements || [],
        contractChecks: entry.coverage.contractChecks || [],
        routeMetadata: {
            requestBody: entry.routeMetadata?.requestBody,
            responses: entry.routeMetadata?.responseBodies || [],
            responseStatuses: entry.routeMetadata?.responseStatuses || [],
            permission: entry.routeMetadata?.permission,
            right: entry.routeMetadata?.right,
            event: entry.routeMetadata?.event,
        },
        cases: contractCases(entry),
    };
}

function buildContractMatrix(manifest) {
    const contracts = manifest.entries.filter((entry) => entry.type === "http-route").map(contractForEntry);
    const runtimeAuthBoundaryContracts = contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS").length;
    const runtimeMalformedAuthContracts = contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS").length;
    const runtimeRevokedSessionAuthContracts = contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS").length;
    const runtimeStaleTokenAuthContracts = contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS").length;
    const runtimePublicAuthBoundaryContracts = contracts.filter((contract) => contract.service === "api" && contract.authMode === "public" && contract.method !== "OPTIONS").length;
    const runtimePublicInvalidBodyContracts = contracts.filter(supportsRuntimePublicInvalidBodyContract).length;
    const runtimeProtectedInvalidBodyContracts = contracts.filter(supportsRuntimeProtectedInvalidBodyContract).length;
    const runtimePublicResponseSchemaContracts = contracts.filter(supportsRuntimePublicResponseSchemaContract).length;
    const runtimeAuthenticatedResponseSchemaContracts = contracts.filter(supportsRuntimeAuthenticatedResponseSchemaContract).length;
    const runtimeRightOnlyDenialContracts = contracts.filter(supportsRuntimeRightOnlyDenialContract).length;
    const runtimePermissionOnlyDenialContracts = contracts.filter(supportsRuntimePermissionOnlyDenialContract).length;
    const runtimePermissionAndRightPermissionDenialContracts = contracts.filter(supportsRuntimePermissionAndRightDenialContract).length;
    const runtimePermissionAndRightRightDenialContracts = contracts.filter(supportsRuntimePermissionAndRightDenialContract).length;

    return {
        schemaVersion: 1,
        generatedBy: "scripts/testing-manifest/generate-contract-tests.js",
        manifestSource: DEFAULT_MANIFEST_PATH,
        summary: {
            totalContracts: contracts.length,
            byService: contracts.reduce((acc, contract) => {
                acc[contract.service] = (acc[contract.service] || 0) + 1;
                return acc;
            }, {}),
            runtimeAuthBoundaryContracts,
            runtimeMalformedAuthContracts,
            runtimeRevokedSessionAuthContracts,
            runtimeStaleTokenAuthContracts,
            runtimePublicAuthBoundaryContracts,
            runtimePublicInvalidBodyContracts,
            runtimeProtectedInvalidBodyContracts,
            runtimePublicResponseSchemaContracts,
            runtimeAuthenticatedResponseSchemaContracts,
            runtimeRightOnlyDenialContracts,
            runtimePermissionOnlyDenialContracts,
            runtimePermissionAndRightPermissionDenialContracts,
            runtimePermissionAndRightRightDenialContracts,
        },
        contracts,
    };
}

function routeMetadataValues(value) {
    if (Array.isArray(value)) return value.map(String);
    if (value === undefined || value === null) return [];
    return [String(value)];
}

function hasExpandedRouteMetadataValue(value) {
    return routeMetadataValues(value).some((entry) => entry.startsWith("..."));
}

function supportsRuntimeRightOnlyDenialContract(contract) {
    return contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS" && contract.routeMetadata.right && !contract.routeMetadata.permission;
}

function supportsRuntimePermissionOnlyDenialContract(contract) {
    return (
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.permission &&
        !contract.routeMetadata.right &&
        !hasExpandedRouteMetadataValue(contract.routeMetadata.permission)
    );
}

function supportsRuntimePermissionAndRightDenialContract(contract) {
    return (
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.permission &&
        contract.routeMetadata.right &&
        !hasExpandedRouteMetadataValue(contract.routeMetadata.permission) &&
        !hasExpandedRouteMetadataValue(contract.routeMetadata.right)
    );
}

function supportsRuntimePublicInvalidBodyContract(contract) {
    return (
        contract.service === "api" &&
        contract.authMode === "public" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.requestBody &&
        contract.manifestId !== "api:http:POST:/webhooks/:webhook_id/:token/github/"
    );
}

function supportsRuntimeProtectedInvalidBodyContract(contract) {
    return (
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.requestBody &&
        !contract.routeMetadata.permission &&
        !contract.routeMetadata.right &&
        !IGNORED_RUNTIME_REQUEST_BODY_VALIDATION_SCHEMAS.has(contract.routeMetadata.requestBody)
    );
}

function supportsRuntimePublicResponseSchemaContract(contract) {
    return (
        contract.service === "api" &&
        contract.authMode === "public" &&
        contract.method === "GET" &&
        !contract.path.includes(":") &&
        JSON.stringify(contract.fixtureRequirements) === JSON.stringify(["config"]) &&
        contract.routeMetadata.responseStatuses.includes(200) &&
        contract.routeMetadata.responses.some((schema) => !["APIErrorResponse", "Object"].includes(schema)) &&
        !["api:http:GET:/download/", "api:http:GET:/policies/stats/", "api:http:GET:/updates/"].includes(contract.manifestId)
    );
}

function supportsRuntimeAuthenticatedResponseSchemaContract(contract) {
    return (
        AUTHENTICATED_RESPONSE_SCHEMA_MANIFEST_IDS.has(contract.manifestId) &&
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method === "GET" &&
        contract.routeMetadata.responseStatuses.includes(200) &&
        contract.routeMetadata.responses.some((schema) => !["APIErrorResponse", "Object"].includes(schema))
    );
}

function serialize(value) {
    return `${JSON.stringify(value, null, 4)}\n`;
}

function generatedTestSource() {
    return `"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../../assets/testing-manifest.json");
const matrix = require("./http-contracts.json");

const httpRouteIds = new Set(manifest.entries.filter((entry) => entry.type === "http-route").map((entry) => entry.id));
const contractIds = new Set(matrix.contracts.map((contract) => contract.manifestId));

describe("generated HTTP contract matrix", () => {
    test("has one generated contract for every manifest HTTP route", () => {
        assert.equal(matrix.summary.totalContracts, httpRouteIds.size);
        assert.equal(contractIds.size, httpRouteIds.size);

        for (const id of httpRouteIds) {
            assert.ok(contractIds.has(id), \`missing generated HTTP contract for \${id}\`);
        }
    });

    test("each contract maps to a manifest id and executable contract checks", () => {
        for (const contract of matrix.contracts) {
            assert.ok(httpRouteIds.has(contract.manifestId), \`unknown manifest id \${contract.manifestId}\`);
            assert.ok(contract.method, \`\${contract.manifestId} is missing method\`);
            assert.ok(contract.path, \`\${contract.manifestId} is missing path\`);
            assert.ok(contract.samplePath && !contract.samplePath.includes(":"), \`\${contract.manifestId} has unresolved path params\`);
            assert.ok(contract.authMode, \`\${contract.manifestId} is missing auth mode\`);
            assert.ok(contract.testTier, \`\${contract.manifestId} is missing test tier\`);
            assert.ok(contract.benchmarkClass, \`\${contract.manifestId} is missing benchmark class\`);
            assert.ok(Array.isArray(contract.fixtureRequirements), \`\${contract.manifestId} is missing fixture requirements\`);
            assert.ok(Array.isArray(contract.contractChecks), \`\${contract.manifestId} is missing contract checks\`);
            assert.ok(Array.isArray(contract.cases) && contract.cases.length > 0, \`\${contract.manifestId} has no contract cases\`);

            const caseChecks = new Set(contract.cases.flatMap((contractCase) => contractCase.checks));
            for (const requiredCheck of contract.contractChecks) {
                assert.ok(caseChecks.has(requiredCheck), \`\${contract.manifestId} does not exercise policy check \${requiredCheck}\`);
            }
        }
    });

    test("API request-body routes get schema-validation cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.service === "api" && entry.routeMetadata.requestBody)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "invalid-request-body" && contractCase.checks.includes("schema-validation")),
                \`\${contract.manifestId} is missing invalid body schema-validation case\`,
            );
        }
    });

    test("permissioned routes get authorization-denied cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.routeMetadata.permission || entry.routeMetadata.right)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "authorization-denied"),
                \`\${contract.manifestId} is missing authorization-denied case\`,
            );
        }
    });
});
`;
}

function generatedRuntimeTestSource() {
    return `import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import { Channel, closeDatabase, Config, generateToken, Guild, initDatabase, Member, Message, Permissions, Role, Session, User } from "@spacebar/util";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { startApi } from "../server/startApi";

type GeneratedHttpContract = {
    manifestId: string;
    service: string;
    method: string;
    path: string;
    samplePath: string;
    authMode: string;
    fixtureRequirements: string[];
    routeMetadata: {
        requestBody?: string;
        responses: string[];
        responseStatuses: number[];
        permission?: unknown;
        right?: unknown;
    };
};

type GeneratedHttpContractMatrix = {
    summary: {
        runtimeAuthBoundaryContracts: number;
        runtimeMalformedAuthContracts: number;
        runtimeRevokedSessionAuthContracts: number;
        runtimeStaleTokenAuthContracts: number;
        runtimePublicAuthBoundaryContracts: number;
        runtimePublicInvalidBodyContracts: number;
        runtimeProtectedInvalidBodyContracts: number;
        runtimePublicResponseSchemaContracts: number;
        runtimeAuthenticatedResponseSchemaContracts: number;
        runtimeRightOnlyDenialContracts: number;
        runtimePermissionOnlyDenialContracts: number;
        runtimePermissionAndRightPermissionDenialContracts: number;
        runtimePermissionAndRightRightDenialContracts: number;
    };
    contracts: GeneratedHttpContract[];
};

// This path is resolved from the compiled dist-test/test/generated directory.
const matrix = require("../../../test/generated/http-contracts.json") as GeneratedHttpContractMatrix;

const protectedApiContracts = matrix.contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS");
const publicApiContracts = matrix.contracts.filter((contract) => contract.service === "api" && contract.authMode === "public" && contract.method !== "OPTIONS");
const publicRequestBodyValidationExclusions = new Set(["api:http:POST:/webhooks/:webhook_id/:token/github/"]);
const publicResponseSchemaExclusions = new Set(["api:http:GET:/download/", "api:http:GET:/policies/stats/", "api:http:GET:/updates/"]);
const ignoredRuntimeRequestBodyValidationSchemas = new Set(["SettingsProtoUpdateJsonSchema"]);
const authenticatedResponseSchemaManifestIds = new Set([
    "api:http:GET:/auth/sessions/",
    "api:http:GET:/auth/whoami/",
    "api:http:GET:/users/:user_id/",
    "api:http:GET:/users/:user_id/profile/",
    "api:http:GET:/users/:user_id/relationships/",
    "api:http:GET:/users/@me/",
    "api:http:GET:/users/@me/billing/location-info/",
    "api:http:GET:/users/@me/billing/payment-sources/",
    "api:http:GET:/users/@me/billing/payment-sources/:payment_source_id",
    "api:http:GET:/users/@me/channels/",
    "api:http:GET:/users/@me/collectibles-marketing/",
    "api:http:GET:/users/@me/guilds/",
    "api:http:GET:/users/@me/relationships/",
    "api:http:GET:/users/@me/settings/",
    "api:http:GET:/users/@me/settings-proto/1/",
    "api:http:GET:/users/@me/settings-proto/1/json",
    "api:http:GET:/users/@me/settings-proto/2/",
    "api:http:GET:/users/@me/settings-proto/2/json",
]);
const publicInvalidBodyContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "public" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.requestBody &&
        !publicRequestBodyValidationExclusions.has(contract.manifestId),
);
const protectedInvalidBodyContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.requestBody &&
        !contract.routeMetadata.permission &&
        !contract.routeMetadata.right &&
        !ignoredRuntimeRequestBodyValidationSchemas.has(contract.routeMetadata.requestBody),
);
const schemas = JSON.parse(JSON.stringify(require("../../../assets/schemas.json")).replaceAll("#/definitions/", "")) as Record<string, AnySchema>;
const ajv = new Ajv({
    allErrors: true,
    parseDate: true,
    allowDate: true,
    schemas,
    coerceTypes: true,
    messages: true,
    strict: true,
    strictRequired: true,
    allowUnionTypes: true,
});
addFormats(ajv);
const publicResponseSchemaContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "public" &&
        contract.method === "GET" &&
        !contract.path.includes(":") &&
        JSON.stringify(contract.fixtureRequirements) === JSON.stringify(["config"]) &&
        contract.routeMetadata.responseStatuses.includes(200) &&
        contract.routeMetadata.responses.some((schema) => !["APIErrorResponse", "Object"].includes(schema) && schemas[schema]) &&
        !publicResponseSchemaExclusions.has(contract.manifestId),
);
const authenticatedResponseSchemaContracts = matrix.contracts.filter(
    (contract) =>
        authenticatedResponseSchemaManifestIds.has(contract.manifestId) &&
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method === "GET" &&
        contract.routeMetadata.responseStatuses.includes(200) &&
        contract.routeMetadata.responses.some((schema) => !["APIErrorResponse", "Object"].includes(schema) && schemas[schema]),
);
const rightOnlyDenialContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.right &&
        !contract.routeMetadata.permission,
);
const permissionOnlyDenialContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.permission &&
        !contract.routeMetadata.right &&
        !metadataValues(contract.routeMetadata.permission).some((value) => value.startsWith("...")),
);
const permissionAndRightDenialContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "bearer" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.permission &&
        contract.routeMetadata.right &&
        !metadataValues(contract.routeMetadata.permission).some((value) => value.startsWith("...")) &&
        !metadataValues(contract.routeMetadata.right).some((value) => value.startsWith("...")),
);

function silenceConsole() {
    const previous = {
        error: console.error,
        log: console.log,
    };
    console.error = () => undefined;
    console.log = () => undefined;

    return () => {
        console.error = previous.error;
        console.log = previous.log;
    };
}

function configurePublicResponseSchemaRuntime() {
    const config = Config.get();
    const previous = {
        apiEndpointPublic: config.api.endpointPublic,
        cdnEndpointPublic: config.cdn.endpointPublic,
        gatewayEndpointPublic: config.gateway.endpointPublic,
    };

    config.api.endpointPublic = "https://api.example/api/v9";
    config.cdn.endpointPublic = "https://cdn.example";
    config.gateway.endpointPublic = "wss://gateway.example";

    return () => {
        config.api.endpointPublic = previous.apiEndpointPublic;
        config.cdn.endpointPublic = previous.cdnEndpointPublic;
        config.gateway.endpointPublic = previous.gatewayEndpointPublic;
    };
}

function responseSchemaForContract(contract: GeneratedHttpContract) {
    return contract.routeMetadata.responses.find((schema) => !["APIErrorResponse", "Object"].includes(schema) && schemas[schema]);
}

function metadataValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (value === undefined || value === null) return [];
    return [String(value)];
}

function requiredRightForContract(contract: GeneratedHttpContract) {
    const [right] = metadataValues(contract.routeMetadata.right);
    assert.ok(right, \`\${contract.manifestId} should declare a required right\`);
    return right;
}

function requiredPermissionForContract(contract: GeneratedHttpContract) {
    const [permission] = metadataValues(contract.routeMetadata.permission);
    assert.ok(permission, \`\${contract.manifestId} should declare a required permission\`);
    return permission;
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DB_SYNC: process.env.DB_SYNC,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

async function withAuthenticatedApi<T>(
    prefix: string,
    fn: (context: { api: Awaited<ReturnType<typeof startApi>>; token: string; user: User; session: Session }) => Promise<T>,
): Promise<T> {
    const previous = snapshotProcessState();
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    let database: Awaited<ReturnType<typeof createDisposablePostgresDatabase>> | undefined;
    let databaseInitialized = false;
    let tempCwd: string | undefined;

    try {
        database = await createDisposablePostgresDatabase({ prefix });
        tempCwd = await mkdtemp(path.join(tmpdir(), \`\${prefix.replaceAll("_", "-")}-\`));
        process.chdir(tempCwd);
        process.env.DATABASE = database.url;
        process.env.APPLY_DB_MIGRATIONS = "true";
        process.env.LOG_ROUTES = "false";
        delete process.env.CONFIG_PATH;
        delete process.env.DB_SYNC;

        await initDatabase();
        databaseInitialized = true;
        api = await startApi();

        const suffix = \`\${process.pid}\${Date.now()}\`;
        const user = await User.register({
            username: \`contract\${suffix.slice(-8)}\`,
            email: \`contract-\${suffix}@example.com\`,
            password: "contract-password",
        });
        user.premium_since = new Date();
        user.theme_colors = [0, 0];
        user.badge_ids = [];
        user.avatar_decoration_data = {
            asset: "fixture-avatar-decoration",
            sku_id: "100000000000000001",
            expires_at: null,
        };
        user.display_name_styles = {
            font_id: 0,
            effect_id: 0,
            colors: [],
        };
        user.collectibles = { nameplate: null };
        user.primary_guild = {
            identity_enabled: null,
            identity_guild_id: null,
            tag: null,
            badge: null,
        };
        await user.save();

        const token = await generateToken(user.id);
        assert.ok(token, "token generation should return a bearer token");
        const session = await Session.findOneByOrFail({ user_id: user.id });
        session.client_info = {
            platform: "generated-contract",
            os: "test",
            version: 1,
        };
        session.last_seen = new Date();
        session.last_seen_location = "test";
        await session.save();

        return await fn({ api, token, user, session });
    } finally {
        if (api) await api.stop();
        if (databaseInitialized) await closeDatabase();
        if (database) await database.close();
        restoreProcessState(previous);
        if (tempCwd) await rm(tempCwd, { recursive: true, force: true });
    }
}

async function createPermissionDeniedFixture(user: User, options: { grantAllPermissions?: boolean } = {}) {
    const suffix = \`\${process.pid}\${Date.now()}\`;
    const owner = await User.register({
        username: \`owner\${suffix.slice(-8)}\`,
        email: \`owner-\${suffix}@example.com\`,
        password: "contract-password",
    });

    const guild = Guild.create({
        name: "Contract Permission Guild",
        owner,
        owner_id: owner.id,
        features: [],
        large: false,
        members: [],
        roles: [],
        channels: [],
        emojis: [],
        stickers: [],
        invites: [],
        voice_states: [],
        webhooks: [],
        premium_tier: 0,
        public_updates_channel_id: null,
        unavailable: false,
        welcome_screen: { enabled: false, description: "", welcome_channels: [] },
        widget_enabled: true,
        nsfw: false,
        premium_progress_bar_enabled: false,
        channel_ordering: [],
        discovery_weight: 0,
        discovery_excluded: false,
    });
    await guild.save();

    const role = Role.create({
        guild,
        guild_id: guild.id,
        color: 0,
        hoist: false,
        managed: false,
        mentionable: false,
        name: "contract-role",
        permissions: options.grantAllPermissions ? Permissions.ALL.valueOf().toString() : "0",
        position: 0,
        flags: 0,
        colors: { primary_color: 0, secondary_color: undefined, tertiary_color: undefined },
    });
    await role.save();

    const member = Member.create({
        id: user.id,
        user,
        guild,
        guild_id: guild.id,
        roles: options.grantAllPermissions ? [role] : [],
        joined_at: new Date(),
        deaf: false,
        mute: false,
        pending: false,
        settings: {},
        bio: "",
        communication_disabled_until: null,
        flags: 0,
    });
    await member.save();

    const channel = Channel.create({
        created_at: new Date(),
        name: "contract-permission-channel",
        type: 0,
        guild,
        guild_id: guild.id,
        parent_id: null,
        nsfw: false,
        flags: 0,
        permission_overwrites: [],
        messages: [],
        webhooks: [],
        recipients: [],
        thread_members: [],
    });
    await channel.save();

    const message = Message.create({
        channel,
        channel_id: channel.id,
        guild,
        guild_id: guild.id,
        author: owner,
        author_id: owner.id,
        content: "contract permission fixture",
        timestamp: new Date(),
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        reactions: [],
        type: 0,
        flags: 0,
        components: [],
        message_snapshots: [],
    });
    await message.save();

    return { guild, channel, message, role, member, targetUser: user };
}

function samplePathForPermissionDenialContract(contract: GeneratedHttpContract, fixture: Awaited<ReturnType<typeof createPermissionDeniedFixture>>) {
    const samplePath = contract.path
        .replace(/:guild_id/g, fixture.guild.id)
        .replace(/:channel_id/g, fixture.channel.id)
        .replace(/:message_id/g, fixture.message.id)
        .replace(/:role_id/g, fixture.role.id)
        .replace(/:member_id/g, fixture.member.id)
        .replace(/:user_id/g, fixture.targetUser.id)
        .replace(/:overwrite_id/g, fixture.role.id)
        .replace(/:tag_id/g, "contract-tag")
        .replace(/:emoji_id/g, "contract-emoji")
        .replace(/:sticker_id/g, "contract-sticker")
        .replace(/:rule_id/g, "contract-rule")
        .replace(/:code/g, "contract-code")
        .replace(/:burst/g, "false")
        .replace(/:emoji/g, "contract-emoji");

    assert.equal(samplePath.includes(":"), false, \`\${contract.manifestId} should have a fully substituted permission fixture path\`);
    return samplePath;
}

function samplePathForAuthenticatedResponseContract(contract: GeneratedHttpContract, userId: string) {
    return contract.path.replace(/:user_id/g, userId).replace(/:payment_source_id/g, "fixture-payment-source");
}

test("generated HTTP auth contracts reject missing bearer tokens through the real API stack", { timeout: 120_000 }, async () => {
    assert.equal(protectedApiContracts.length, matrix.summary.runtimeAuthBoundaryContracts);
    assert.ok(protectedApiContracts.length > 0, "expected protected API routes to be covered");

    const api = await startApi();
    try {
        for (const contract of protectedApiContracts) {
            const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                method: contract.method,
                headers: { accept: "application/json" },
            });

            assert.equal(response.status, 401, \`\${contract.manifestId} should reject missing Authorization\`);
            assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON error\`);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, 401, \`\${contract.manifestId} should return the auth error code\`);
            assert.equal(body.message, "Error: Missing Authorization Header", \`\${contract.manifestId} should return the auth error message\`);
            assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
        }
    } finally {
        await api.stop();
    }
});

test("generated HTTP auth contracts reject malformed bearer tokens through the real API stack", { timeout: 120_000 }, async () => {
    assert.equal(protectedApiContracts.length, matrix.summary.runtimeMalformedAuthContracts);
    assert.ok(protectedApiContracts.length > 0, "expected protected API routes to be covered");

    const restoreConsole = silenceConsole();
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    try {
        api = await startApi();
        for (const contract of protectedApiContracts) {
            const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                method: contract.method,
                headers: {
                    accept: "application/json",
                    authorization: "Bearer not-a-token",
                },
            });

            assert.equal(response.status, 401, \`\${contract.manifestId} should reject malformed bearer tokens\`);
            assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON auth error\`);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, 401, \`\${contract.manifestId} should return the invalid token error code\`);
            assert.equal(body.message, "Error: Invalid Token", \`\${contract.manifestId} should return the invalid token error message\`);
            assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
        }
    } finally {
        restoreConsole();
        if (api) await api.stop();
    }
});

test(
    "generated HTTP auth contracts reject revoked bearer sessions through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(protectedApiContracts.length, matrix.summary.runtimeRevokedSessionAuthContracts);
        assert.ok(protectedApiContracts.length > 0, "expected protected API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_revoked_session", async ({ api, token, session }) => {
                await Session.delete({ session_id: session.session_id });

                for (const contract of protectedApiContracts) {
                    const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 401, \`\${contract.manifestId} should reject bearer tokens for deleted sessions\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON auth error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 401, \`\${contract.manifestId} should return the invalid session error code\`);
                    assert.equal(body.message, "Error: Invalid Session", \`\${contract.manifestId} should return the invalid session error message\`);
                    assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP auth contracts reject bearer tokens issued before valid_tokens_since through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(protectedApiContracts.length, matrix.summary.runtimeStaleTokenAuthContracts);
        assert.ok(protectedApiContracts.length > 0, "expected protected API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_stale_token", async ({ api, token, user }) => {
                user.data = {
                    ...user.data,
                    valid_tokens_since: new Date(Date.now() + 120_000),
                };
                await user.save();

                for (const contract of protectedApiContracts) {
                    const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 401, \`\${contract.manifestId} should reject bearer tokens issued before valid_tokens_since\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON auth error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 401, \`\${contract.manifestId} should return the stale token error code\`);
                    assert.equal(body.message, "Error: Invalid Token", \`\${contract.manifestId} should return the stale token error message\`);
                    assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP right-only authorization contracts reject users without declared rights through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(rightOnlyDenialContracts.length, matrix.summary.runtimeRightOnlyDenialContracts);
        assert.ok(rightOnlyDenialContracts.length > 0, "expected right-only API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_right_denial", async ({ api, token, user }) => {
                user.rights = "0";
                await user.save();

                for (const contract of rightOnlyDenialContracts) {
                    const requiredRight = requiredRightForContract(contract);
                    const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 403, \`\${contract.manifestId} should reject users missing \${requiredRight}\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON authorization error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 50013, \`\${contract.manifestId} should return the missing-rights error code\`);
                    assert.equal(body.message, \`You lack rights to perform that action (\${requiredRight})\`, \`\${contract.manifestId} should return the missing-rights message\`);
                    assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP permission-only authorization contracts reject members without declared permissions through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(permissionOnlyDenialContracts.length, matrix.summary.runtimePermissionOnlyDenialContracts);
        assert.ok(permissionOnlyDenialContracts.length > 0, "expected permission-only API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_permission_denial", async ({ api, token, user }) => {
                const fixture = await createPermissionDeniedFixture(user);

                for (const contract of permissionOnlyDenialContracts) {
                    const requiredPermission = requiredPermissionForContract(contract);
                    const samplePath = samplePathForPermissionDenialContract(contract, fixture);
                    const response = await fetch(\`\${api.apiBaseUrl}\${samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 403, \`\${contract.manifestId} should reject members missing \${requiredPermission}\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON authorization error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 50013, \`\${contract.manifestId} should return the missing-permissions error code\`);
                    assert.equal(
                        body.message,
                        \`You lack permissions to perform that action (\${requiredPermission})\`,
                        \`\${contract.manifestId} should return the missing-permissions message\`,
                    );
                    assert.equal(body.request, \`\${contract.method} /api/v9\${samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP permission-and-right contracts reject members without declared permissions before right checks",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(permissionAndRightDenialContracts.length, matrix.summary.runtimePermissionAndRightPermissionDenialContracts);
        assert.ok(permissionAndRightDenialContracts.length > 0, "expected permission-and-right API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_permission_right_permission", async ({ api, token, user }) => {
                const fixture = await createPermissionDeniedFixture(user);

                for (const contract of permissionAndRightDenialContracts) {
                    const requiredPermission = requiredPermissionForContract(contract);
                    const samplePath = samplePathForPermissionDenialContract(contract, fixture);
                    const response = await fetch(\`\${api.apiBaseUrl}\${samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 403, \`\${contract.manifestId} should reject members missing \${requiredPermission} before checking rights\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON authorization error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 50013, \`\${contract.manifestId} should return the missing-permissions error code\`);
                    assert.equal(
                        body.message,
                        \`You lack permissions to perform that action (\${requiredPermission})\`,
                        \`\${contract.manifestId} should return the missing-permissions message\`,
                    );
                    assert.equal(body.request, \`\${contract.method} /api/v9\${samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP permission-and-right contracts reject permitted members without declared rights through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(permissionAndRightDenialContracts.length, matrix.summary.runtimePermissionAndRightRightDenialContracts);
        assert.ok(permissionAndRightDenialContracts.length > 0, "expected permission-and-right API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_permission_right_right", async ({ api, token, user }) => {
                user.rights = "0";
                await user.save();
                const fixture = await createPermissionDeniedFixture(user, { grantAllPermissions: true });

                for (const contract of permissionAndRightDenialContracts) {
                    const requiredRight = requiredRightForContract(contract);
                    const samplePath = samplePathForPermissionDenialContract(contract, fixture);
                    const response = await fetch(\`\${api.apiBaseUrl}\${samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 403, \`\${contract.manifestId} should reject permitted members missing \${requiredRight}\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON authorization error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 50013, \`\${contract.manifestId} should return the missing-rights error code\`);
                    assert.equal(body.message, \`You lack rights to perform that action (\${requiredRight})\`, \`\${contract.manifestId} should return the missing-rights message\`);
                    assert.equal(body.request, \`\${contract.method} /api/v9\${samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test("generated HTTP auth contracts keep public API routes out of bearer middleware", { timeout: 60_000 }, async () => {
    assert.equal(publicApiContracts.length, matrix.summary.runtimePublicAuthBoundaryContracts);
    assert.ok(publicApiContracts.length > 0, "expected public API routes to be covered");

    const restoreConsole = silenceConsole();
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    try {
        api = await startApi();
        for (const contract of publicApiContracts) {
            const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                method: contract.method,
                headers: { accept: "application/json" },
            });
            const body = await response.text();
            const failedInBearerMiddleware = response.status === 401 && body.includes("Missing Authorization Header");

            assert.equal(failedInBearerMiddleware, false, \`\${contract.manifestId} should not require bearer Authorization\`);
        }
    } finally {
        restoreConsole();
        if (api) await api.stop();
    }
});

test("generated HTTP public response-schema contracts match real API responses", { timeout: 60_000 }, async () => {
    assert.equal(publicResponseSchemaContracts.length, matrix.summary.runtimePublicResponseSchemaContracts);
    assert.ok(publicResponseSchemaContracts.length > 0, "expected public response-schema API routes to be covered");

    const restoreConsole = silenceConsole();
    const restoreConfig = configurePublicResponseSchemaRuntime();
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    try {
        api = await startApi();
        for (const contract of publicResponseSchemaContracts) {
            const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                method: contract.method,
                headers: { accept: "application/json" },
            });

            assert.equal(response.status, 200, \`\${contract.manifestId} should return a successful response for schema validation\`);
            assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON response\`);

            const schema = responseSchemaForContract(contract);
            assert.ok(schema, \`\${contract.manifestId} should declare a known response schema\`);
            const validate = ajv.getSchema(schema);
            assert.ok(validate, \`\${contract.manifestId} should resolve response schema \${schema}\`);
            const body = (await response.json()) as unknown;

            assert.equal(validate(body), true, \`\${contract.manifestId} response should match \${schema}: \${JSON.stringify(validate.errors)}\`);
        }
    } finally {
        restoreConfig();
        restoreConsole();
        if (api) await api.stop();
    }
});

test(
    "generated HTTP protected request-body contracts reject schema-invalid bodies after auth",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(protectedInvalidBodyContracts.length, matrix.summary.runtimeProtectedInvalidBodyContracts);
        assert.ok(protectedInvalidBodyContracts.length > 0, "expected protected request-body API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_protected_body", async ({ api, token }) => {
                for (const contract of protectedInvalidBodyContracts) {
                    const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                            "content-type": "application/json",
                        },
                        body: JSON.stringify({ __generated_contract_invalid_body__: true }),
                    });

                    assert.equal(response.status, 400, \`\${contract.manifestId} should reject a schema-invalid request body after auth\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON validation error\`);

                    const body = (await response.json()) as Record<string, unknown>;
                    assert.equal(body.code, 50035, \`\${contract.manifestId} should return the invalid form body code\`);
                    assert.equal(body.message, "Invalid Form Body", \`\${contract.manifestId} should return the invalid form body message\`);
                    assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
                    assert.equal(typeof body.errors, "object", \`\${contract.manifestId} should include validation errors\`);
                    assert.notEqual(body.errors, null, \`\${contract.manifestId} should include validation errors\`);
                    assert.ok(Array.isArray(body._ajvErrors), \`\${contract.manifestId} should include raw AJV errors\`);
                    assert.ok(body._ajvErrors.length > 0, \`\${contract.manifestId} should include at least one raw AJV error\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP authenticated response-schema contracts match real API responses",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(authenticatedResponseSchemaContracts.length, matrix.summary.runtimeAuthenticatedResponseSchemaContracts);
        assert.ok(authenticatedResponseSchemaContracts.length > 0, "expected authenticated response-schema API routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withAuthenticatedApi("spacebar_contracts_authenticated_response", async ({ api, token, user }) => {
                for (const contract of authenticatedResponseSchemaContracts) {
                    const samplePath = samplePathForAuthenticatedResponseContract(contract, user.id);
                    const response = await fetch(\`\${api.apiBaseUrl}\${samplePath}\`, {
                        method: contract.method,
                        headers: {
                            accept: "application/json",
                            authorization: \`Bearer \${token}\`,
                        },
                    });

                    assert.equal(response.status, 200, \`\${contract.manifestId} should return a successful response for schema validation\`);
                    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON response\`);

                    const schema = responseSchemaForContract(contract);
                    assert.ok(schema, \`\${contract.manifestId} should declare a known response schema\`);
                    const validate = ajv.getSchema(schema);
                    assert.ok(validate, \`\${contract.manifestId} should resolve response schema \${schema}\`);
                    const body = (await response.json()) as unknown;

                    assert.equal(validate(body), true, \`\${contract.manifestId} response should match \${schema}: \${JSON.stringify(validate.errors)}\`);
                }
            });
        } finally {
            restoreConsole();
        }
    },
);

test("generated HTTP public request-body contracts reject schema-invalid bodies through the real API stack", { timeout: 60_000 }, async () => {
    assert.equal(publicInvalidBodyContracts.length, matrix.summary.runtimePublicInvalidBodyContracts);
    assert.ok(publicInvalidBodyContracts.length > 0, "expected public request-body API routes to be covered");

    const restoreConsole = silenceConsole();
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    try {
        api = await startApi();
        for (const contract of publicInvalidBodyContracts) {
            const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, {
                method: contract.method,
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ __generated_contract_invalid_body__: true }),
            });

            assert.equal(response.status, 400, \`\${contract.manifestId} should reject a schema-invalid request body\`);
            assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON validation error\`);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, 50035, \`\${contract.manifestId} should return the invalid form body code\`);
            assert.equal(body.message, "Invalid Form Body", \`\${contract.manifestId} should return the invalid form body message\`);
            assert.equal(body.request, \`\${contract.method} /api/v9\${contract.samplePath}\`, \`\${contract.manifestId} should include the request route\`);
            assert.equal(typeof body.errors, "object", \`\${contract.manifestId} should include validation errors\`);
            assert.notEqual(body.errors, null, \`\${contract.manifestId} should include validation errors\`);
            assert.ok(Array.isArray(body._ajvErrors), \`\${contract.manifestId} should include raw AJV errors\`);
            assert.ok(body._ajvErrors.length > 0, \`\${contract.manifestId} should include at least one raw AJV error\`);
        }
    } finally {
        restoreConsole();
        if (api) await api.stop();
    }
});
`;
}

function main() {
    const args = process.argv.slice(2);
    const repoRoot = path.resolve(optionValue(args, "--repo-root", path.join(__dirname, "..", "..")));
    const manifestPath = path.resolve(repoRoot, optionValue(args, "--manifest", DEFAULT_MANIFEST_PATH));
    const matrixPath = path.resolve(repoRoot, optionValue(args, "--output", DEFAULT_CONTRACT_MATRIX_PATH));
    const testPath = path.resolve(repoRoot, optionValue(args, "--test-output", DEFAULT_CONTRACT_TEST_PATH));
    const runtimeTestPath = path.resolve(repoRoot, optionValue(args, "--runtime-test-output", DEFAULT_RUNTIME_CONTRACT_TEST_PATH));
    const check = args.includes("--check");
    const matrix = buildContractMatrix(readJson(manifestPath));
    const expectedMatrix = serialize(matrix);
    const expectedTest = generatedTestSource();
    const expectedRuntimeTest = generatedRuntimeTestSource();

    if (check) {
        const errors = [];
        if (!fs.existsSync(matrixPath) || fs.readFileSync(matrixPath, "utf8") !== expectedMatrix)
            errors.push(`${path.relative(repoRoot, matrixPath)} is stale. Run npm run generate:contract-tests.`);
        if (!fs.existsSync(testPath) || fs.readFileSync(testPath, "utf8") !== expectedTest)
            errors.push(`${path.relative(repoRoot, testPath)} is stale. Run npm run generate:contract-tests.`);
        if (!fs.existsSync(runtimeTestPath) || fs.readFileSync(runtimeTestPath, "utf8") !== expectedRuntimeTest)
            errors.push(`${path.relative(repoRoot, runtimeTestPath)} is stale. Run npm run generate:contract-tests.`);

        if (errors.length) {
            console.error(errors.map((error) => `- ${error}`).join("\n"));
            process.exitCode = 1;
            return;
        }

        process.stdout.write(`Generated HTTP contract tests verified (${matrix.summary.totalContracts} contracts)\n`);
        return;
    }

    fs.mkdirSync(path.dirname(matrixPath), { recursive: true });
    fs.writeFileSync(matrixPath, expectedMatrix);
    fs.writeFileSync(testPath, expectedTest);
    fs.writeFileSync(runtimeTestPath, expectedRuntimeTest);
    process.stdout.write(
        `Wrote generated HTTP contract tests to ${path.relative(repoRoot, matrixPath)}, ${path.relative(repoRoot, testPath)}, and ${path.relative(repoRoot, runtimeTestPath)} (${matrix.summary.totalContracts} contracts)\n`,
    );
}

main();
