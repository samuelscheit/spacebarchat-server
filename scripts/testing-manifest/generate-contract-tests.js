#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const prettier = require("prettier");
const { DEFAULT_MANIFEST_PATH } = require("./lib");

const DEFAULT_CONTRACT_MATRIX_PATH = path.join("test", "generated", "http-contracts.json");
const DEFAULT_CONTRACT_TEST_PATH = path.join("test", "generated", "http-contracts.test.js");
const DEFAULT_RUNTIME_CONTRACT_TEST_PATH = path.join("test", "generated", "http-auth-runtime-contracts.test.ts");
const IGNORED_RUNTIME_REQUEST_BODY_VALIDATION_SCHEMAS = new Set(["SettingsProtoUpdateJsonSchema"]);
const CDN_SIGNED_URL_MANIFEST_ID = "cdn:http:GET:/attachments/:channel_id/:message_id/:filename";
const CDN_FILENAME_SANITIZATION_MANIFEST_ID = "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:message_id";
const RUNTIME_EVENT_EMISSION_MANIFEST_IDS = [
    "api:http:POST:/auth/logout/",
    "api:http:POST:/auth/sessions/logout",
    "api:http:PATCH:/users/@me/",
    "api:http:PUT:/users/@me/notes/:user_id",
    "api:http:PUT:/users/@me/relationships/:user_id",
    "api:http:PATCH:/users/@me/settings/",
];
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

function routeMetadataValues(value) {
    if (Array.isArray(value)) return value.map(String);
    if (value === undefined || value === null) return [];
    return [String(value)];
}

function eventValues(entry) {
    return [...new Set([...routeMetadataValues(entry.routeMetadata?.event), ...routeMetadataValues(entry.routeMetadata?.emittedEvents)])].sort();
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

    const events = eventValues(entry);
    if (events.length) {
        cases.push({
            id: "event-emission",
            checks: ["events"],
            events,
        });
    }

    if (entry.rateLimit) {
        cases.push({
            id: "rate-limit-headers",
            checks: ["rate-limit-headers"],
            rateLimit: entry.rateLimit,
        });
    }

    if (entry.service === "cdn") {
        cases.push({
            id: "cdn-object-contract",
            checks: ["missing-file", "mime", "cache-headers"],
        });

        if (entry.id === CDN_SIGNED_URL_MANIFEST_ID) {
            cases.push({
                id: "cdn-signed-url",
                checks: ["signed-url", "status", "mime", "cache-headers"],
            });
        }

        if (entry.id === CDN_FILENAME_SANITIZATION_MANIFEST_ID) {
            cases.push({
                id: "cdn-filename-sanitization",
                checks: ["filename-sanitization", "upload-download-delete"],
            });
        }

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
        rateLimit: entry.rateLimit,
        routeMetadata: {
            requestBody: entry.routeMetadata?.requestBody,
            responses: entry.routeMetadata?.responseBodies || [],
            responseStatuses: entry.routeMetadata?.responseStatuses || [],
            permission: entry.routeMetadata?.permission,
            right: entry.routeMetadata?.right,
            event: entry.routeMetadata?.event,
            emittedEvents: entry.routeMetadata?.emittedEvents,
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
    const runtimeEventEmissionContracts = contracts.filter(supportsRuntimeEventEmissionContract).length;
    const runtimeRateLimitHeaderContracts = contracts.filter(supportsRuntimeRateLimitHeaderContract).length;
    const runtimeCdnMissingObjectContracts = contracts.filter(supportsRuntimeCdnMissingObjectContract).length;
    const runtimeCdnHeadMissingObjectContracts = contracts.filter(supportsRuntimeCdnMissingObjectContract).length;
    const runtimeCdnValidObjectContracts = contracts.filter(supportsRuntimeCdnValidObjectContract).length;
    const runtimeCdnSignatureRequiredContracts = contracts.filter(supportsRuntimeCdnSignatureRequiredContract).length;
    const runtimeCdnDeleteContracts = contracts.filter(supportsRuntimeCdnDeleteContract).length;
    const runtimeCdnUploadContracts = contracts.filter(supportsRuntimeCdnUploadContract).length;
    const runtimeCdnInvalidUploadContracts = contracts.filter(supportsRuntimeCdnInvalidUploadContract).length;
    const runtimeCdnInternalAttachmentContracts = contracts.filter(supportsRuntimeCdnInternalAttachmentContract).length;
    const runtimeCdnSignedUrlContracts = contracts.filter(supportsRuntimeCdnSignedUrlContract).length;
    const runtimeCdnFilenameSanitizationContracts = contracts.filter(supportsRuntimeCdnFilenameSanitizationContract).length;

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
            runtimeEventEmissionContracts,
            runtimeRateLimitHeaderContracts,
            runtimeCdnMissingObjectContracts,
            runtimeCdnHeadMissingObjectContracts,
            runtimeCdnValidObjectContracts,
            runtimeCdnSignatureRequiredContracts,
            runtimeCdnDeleteContracts,
            runtimeCdnUploadContracts,
            runtimeCdnInvalidUploadContracts,
            runtimeCdnInternalAttachmentContracts,
            runtimeCdnSignedUrlContracts,
            runtimeCdnFilenameSanitizationContracts,
        },
        contracts,
    };
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

function supportsRuntimeRateLimitHeaderContract(contract) {
    return contract.service === "api" && contract.method !== "OPTIONS" && Boolean(contract.rateLimit);
}

function supportsRuntimeEventEmissionContract(contract) {
    return RUNTIME_EVENT_EMISSION_MANIFEST_IDS.includes(contract.manifestId);
}

function supportsRuntimeCdnMissingObjectContract(contract) {
    return contract.service === "cdn" && contract.method === "GET" && contract.path !== "/ping/";
}

function supportsRuntimeCdnValidObjectContract(contract) {
    return supportsRuntimeCdnMissingObjectContract(contract);
}

function supportsRuntimeCdnSignatureRequiredContract(contract) {
    return contract.service === "cdn" && ["POST", "DELETE"].includes(contract.method);
}

function supportsRuntimeCdnDeleteContract(contract) {
    return (
        contract.service === "cdn" &&
        contract.method === "DELETE" &&
        contract.manifestId !== "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename"
    );
}

function supportsRuntimeCdnUploadContract(contract) {
    return (
        contract.service === "cdn" &&
        contract.method === "POST" &&
        contract.manifestId !== "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id"
    );
}

function supportsRuntimeCdnInvalidUploadContract(contract) {
    return supportsRuntimeCdnUploadContract(contract) && contract.manifestId !== CDN_FILENAME_SANITIZATION_MANIFEST_ID;
}

function supportsRuntimeCdnInternalAttachmentContract(contract) {
    return (
        contract.service === "cdn" &&
        [
            "cdn:http:PUT:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
            "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id",
            "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
        ].includes(contract.manifestId)
    );
}

function supportsRuntimeCdnSignedUrlContract(contract) {
    return contract.manifestId === CDN_SIGNED_URL_MANIFEST_ID;
}

function supportsRuntimeCdnFilenameSanitizationContract(contract) {
    return contract.manifestId === CDN_FILENAME_SANITIZATION_MANIFEST_ID;
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

async function serialize(value, filePath) {
    const options = (await prettier.resolveConfig(filePath)) || {};
    return prettier.format(JSON.stringify(value, null, 4), { ...options, filepath: filePath, parser: "json" });
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

    test("routes with declared or emitted events get event-emission cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.routeMetadata.event || entry.routeMetadata.emittedEvents?.length)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "event-emission" && contractCase.checks.includes("events")),
                \`\${contract.manifestId} is missing event-emission case\`,
            );
        }
    });

    test("rate-limited route groups get rate-limit header cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.rateLimit)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "rate-limit-headers" && contractCase.checks.includes("rate-limit-headers")),
                \`\${contract.manifestId} is missing rate-limit header case\`,
            );
        }
    });

    test("supported CDN attachment routes get signed-url and filename cases", () => {
        const signedUrlContract = matrix.contracts.find((entry) => entry.manifestId === "cdn:http:GET:/attachments/:channel_id/:message_id/:filename");
        assert.ok(signedUrlContract?.cases.some((contractCase) => contractCase.id === "cdn-signed-url" && contractCase.checks.includes("signed-url")));

        const filenameContract = matrix.contracts.find((entry) => entry.manifestId === "${CDN_FILENAME_SANITIZATION_MANIFEST_ID}");
        assert.ok(filenameContract?.cases.some((contractCase) => contractCase.id === "cdn-filename-sanitization" && contractCase.checks.includes("filename-sanitization")));
    });
});
`;
}

function generatedRuntimeTestSource() {
    return `import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import {
    Channel,
    closeDatabase,
    CloudAttachment,
    Config,
    generateToken,
    getUrlSignature,
    Guild,
    initDatabase,
    Member,
    Message,
    NewUrlSignatureData,
    Permissions,
    Role,
    Session,
    User,
} from "@spacebar/util";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { makeChannel, makeGuild, makeUser } from "../fixtures/entities";
import { captureEvents } from "../fixtures/events";
import { withFileStorage } from "../fixtures/files";
import { startApi } from "../server/startApi";
import { startCdn } from "../server/startCdn";

type GeneratedCdnStorage = Parameters<Parameters<typeof withFileStorage>[0]>[0]["storage"];

type GeneratedHttpContract = {
    manifestId: string;
    service: string;
    method: string;
    path: string;
    samplePath: string;
    authMode: string;
    fixtureRequirements: string[];
    rateLimit?: {
        group: string;
        configPath: string;
        pathPrefix: string;
    };
    routeMetadata: {
        requestBody?: string;
        responses: string[];
        responseStatuses: number[];
        permission?: unknown;
        right?: unknown;
        event?: unknown;
        emittedEvents?: string[];
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
        runtimeEventEmissionContracts: number;
        runtimeRateLimitHeaderContracts: number;
        runtimeCdnMissingObjectContracts: number;
        runtimeCdnHeadMissingObjectContracts: number;
        runtimeCdnValidObjectContracts: number;
        runtimeCdnSignatureRequiredContracts: number;
        runtimeCdnDeleteContracts: number;
        runtimeCdnUploadContracts: number;
        runtimeCdnInvalidUploadContracts: number;
        runtimeCdnInternalAttachmentContracts: number;
        runtimeCdnSignedUrlContracts: number;
        runtimeCdnFilenameSanitizationContracts: number;
    };
    contracts: GeneratedHttpContract[];
};

type AuthenticatedApiContext = {
    api: Awaited<ReturnType<typeof startApi>>;
    token: string;
    user: User;
    session: Session;
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
        contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS" && contract.routeMetadata.right && !contract.routeMetadata.permission,
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
const eventEmissionManifestIds = new Set([
${RUNTIME_EVENT_EMISSION_MANIFEST_IDS.map((id) => `    ${JSON.stringify(id)},`).join("\n")}
]);
const eventEmissionContracts = matrix.contracts.filter((contract) => eventEmissionManifestIds.has(contract.manifestId));
const rateLimitHeaderContracts = matrix.contracts.filter((contract) => contract.service === "api" && contract.method !== "OPTIONS" && contract.rateLimit);
const cdnMissingObjectContracts = matrix.contracts.filter((contract) => contract.service === "cdn" && contract.method === "GET" && contract.path !== "/ping/");
const cdnValidObjectContracts = cdnMissingObjectContracts;
const cdnSignatureRequiredContracts = matrix.contracts.filter((contract) => contract.service === "cdn" && ["POST", "DELETE"].includes(contract.method));
const cdnDeleteContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "cdn" &&
        contract.method === "DELETE" &&
        contract.manifestId !== "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
);
const cdnUploadContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "cdn" &&
        contract.method === "POST" &&
        contract.manifestId !== "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id",
);
const cdnInvalidUploadContracts = cdnUploadContracts.filter((contract) => contract.manifestId !== "${CDN_FILENAME_SANITIZATION_MANIFEST_ID}");
const cdnInternalAttachmentManifestIds = [
    "cdn:http:PUT:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
    "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id",
    "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
];
const cdnInternalAttachmentContracts = matrix.contracts.filter((contract) => cdnInternalAttachmentManifestIds.includes(contract.manifestId));
const cdnSignedUrlContracts = matrix.contracts.filter((contract) => contract.manifestId === "${CDN_SIGNED_URL_MANIFEST_ID}");
const cdnFilenameSanitizationContracts = matrix.contracts.filter((contract) => contract.manifestId === "${CDN_FILENAME_SANITIZATION_MANIFEST_ID}");
const cdnRuntimeRequestSignature = "generated-cdn-contract-signature";
const cdnRuntimeSignatureKey = "generated-cdn-url-signature-key";
const cdnRuntimePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const generatedRateLimitCounts: Record<string, number> = {
    "auth.login": 404,
    "auth.register": 405,
    attachmentRefresh: 406,
    channel: 403,
    guild: 401,
    webhook: 402,
};

function silenceConsole() {
    const previous = {
        error: console.error,
        log: console.log,
        warn: console.warn,
    };
    console.error = () => undefined;
    console.log = () => undefined;
    console.warn = () => undefined;

    return () => {
        console.error = previous.error;
        console.log = previous.log;
        console.warn = previous.warn;
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

function configureGeneratedRateLimits() {
    const config = Config.get();
    const previous = JSON.parse(JSON.stringify(config.limits.rate));

    config.limits.rate.enabled = true;
    config.limits.rate.ip = { count: 997, window: 60 };
    config.limits.rate.global = { count: 999, window: 60 };
    config.limits.rate.error = { count: 998, window: 60 };
    config.limits.rate.routes.guild = { count: generatedRateLimitCounts.guild, window: 60 };
    config.limits.rate.routes.webhook = { count: generatedRateLimitCounts.webhook, window: 60 };
    config.limits.rate.routes.channel = { count: generatedRateLimitCounts.channel, window: 60 };
    config.limits.rate.routes.attachmentRefresh = { count: generatedRateLimitCounts.attachmentRefresh, window: 60 };
    config.limits.rate.routes.auth.login = { count: generatedRateLimitCounts["auth.login"], window: 60 };
    config.limits.rate.routes.auth.register = { count: generatedRateLimitCounts["auth.register"], window: 60 };

    return () => {
        config.limits.rate = previous;
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
        CONFIG_READONLY: process.env.CONFIG_READONLY,
        DB_SYNC: process.env.DB_SYNC,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("CONFIG_READONLY", state.CONFIG_READONLY);
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
    options: { beforeStart?: () => Promise<void> | void; afterStop?: () => Promise<void> | void } = {},
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
        await options.beforeStart?.();
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
        await options.afterStop?.();
        if (databaseInitialized) await closeDatabase();
        if (database) await database.close();
        restoreProcessState(previous);
        if (tempCwd) await rm(tempCwd, { recursive: true, force: true });
    }
}

async function assertGeneratedEventEmissionContract(contract: GeneratedHttpContract, context: AuthenticatedApiContext) {
    switch (contract.manifestId) {
        case "api:http:POST:/auth/logout/":
            return await assertSessionRemoveEvent(contract, context, {}, "Self logout");
        case "api:http:POST:/auth/sessions/logout":
            return await assertSessionRemoveEvent(contract, context, { session_ids: [context.session.session_id] }, "Sessions logout");
        case "api:http:PATCH:/users/@me/":
            return await assertUserUpdateEvent(contract, context);
        case "api:http:PUT:/users/@me/notes/:user_id":
            return await assertUserNoteUpdateEvent(contract, context);
        case "api:http:PUT:/users/@me/relationships/:user_id":
            return await assertRelationshipAddEvent(contract, context);
        case "api:http:PATCH:/users/@me/settings/":
            return await assertPresenceUpdateEvent(contract, context);
        default:
            assert.fail(\`No runtime event-emission assertion configured for \${contract.manifestId}\`);
    }
}

async function assertSessionRemoveEvent(contract: GeneratedHttpContract, { api, token, session }: AuthenticatedApiContext, body: unknown, origin: string) {
    const capture = await captureEvents(session.session_id);
    try {
        const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, jsonRequest(contract.method, token, body));

        assert.equal(response.status, 204, \`\${contract.manifestId} should complete the session removal request\`);
        const event = await capture.waitFor("SB_SESSION_REMOVE", 1000);
        assert.equal(event.session_id, session.session_id, \`\${contract.manifestId} should emit to the removed session id\`);
        assert.equal(event.origin, origin, \`\${contract.manifestId} should include the session removal origin\`);
    } finally {
        await capture.stop();
    }
}

async function assertUserUpdateEvent(contract: GeneratedHttpContract, { api, token, user }: AuthenticatedApiContext) {
    const bio = "generated event contract";
    const capture = await captureEvents(user.id);
    try {
        const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, jsonRequest(contract.method, token, { bio }));

        assert.equal(response.status, 200, \`\${contract.manifestId} should update the authenticated user\`);
        const event = await capture.waitFor("USER_UPDATE", 1000);
        const update = event as { user_id?: unknown; data?: { id?: unknown; bio?: unknown } };
        assert.equal(update.user_id, user.id, \`\${contract.manifestId} should emit on the authenticated user id\`);
        assert.equal(update.data?.id, user.id, \`\${contract.manifestId} should include the updated user id\`);
        assert.equal(update.data?.bio, bio, \`\${contract.manifestId} should include the updated bio\`);
    } finally {
        await capture.stop();
    }
}

async function assertUserNoteUpdateEvent(contract: GeneratedHttpContract, { api, token, user }: AuthenticatedApiContext) {
    const target = await createGeneratedEventTargetUser("note");
    const note = "generated note event contract";
    const capture = await captureEvents(user.id);
    try {
        const response = await fetch(\`\${api.apiBaseUrl}\${contract.path.replace(":user_id", target.id)}\`, jsonRequest(contract.method, token, { note }));

        assert.equal(response.status, 204, \`\${contract.manifestId} should upsert a note for the target user\`);
        const event = await capture.waitFor("USER_NOTE_UPDATE", 1000);
        const noteUpdate = event as { user_id?: unknown; data?: { id?: unknown; note?: unknown } };
        assert.equal(noteUpdate.user_id, user.id, \`\${contract.manifestId} should emit on the note owner id\`);
        assert.equal(noteUpdate.data?.id, target.id, \`\${contract.manifestId} should include the target user id\`);
        assert.equal(noteUpdate.data?.note, note, \`\${contract.manifestId} should include the note content\`);
    } finally {
        await capture.stop();
    }
}

async function assertRelationshipAddEvent(contract: GeneratedHttpContract, { api, token, user }: AuthenticatedApiContext) {
    const target = await createGeneratedEventTargetUser("friend");
    const capture = await captureEvents([user.id, target.id]);
    try {
        const response = await fetch(\`\${api.apiBaseUrl}\${contract.path.replace(":user_id", target.id)}\`, jsonRequest(contract.method, token, {}));

        assert.equal(response.status, 204, \`\${contract.manifestId} should create a relationship request\`);
        const requesterEvent = await capture.waitFor(
            (event) => event.event === "RELATIONSHIP_ADD" && event.user_id === user.id && (event as { data?: { id?: unknown } }).data?.id === target.id,
            1000,
        );
        const targetEvent = await capture.waitFor(
            (event) => event.event === "RELATIONSHIP_ADD" && event.user_id === target.id && (event as { data?: { id?: unknown } }).data?.id === user.id,
            1000,
        );
        const requesterAdd = requesterEvent as { data?: { user?: { id?: unknown } } };
        const targetAdd = targetEvent as { data?: { should_notify?: unknown; user?: { id?: unknown } } };
        assert.equal(requesterAdd.data?.user?.id, target.id, \`\${contract.manifestId} should include the target public user\`);
        assert.equal(targetAdd.data?.user?.id, user.id, \`\${contract.manifestId} should include the requester public user\`);
        assert.equal(targetAdd.data?.should_notify, true, \`\${contract.manifestId} should notify the relationship target\`);
    } finally {
        await capture.stop();
    }
}

async function assertPresenceUpdateEvent(contract: GeneratedHttpContract, { api, token, user }: AuthenticatedApiContext) {
    const status = "idle";
    const capture = await captureEvents(user.id);
    try {
        const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, jsonRequest(contract.method, token, { status }));

        assert.equal(response.status, 200, \`\${contract.manifestId} should update the authenticated user's presence setting\`);
        const event = await capture.waitFor("PRESENCE_UPDATE", 1000);
        const presence = event as { user_id?: unknown; data?: { status?: unknown; user?: { id?: unknown } } };
        assert.equal(presence.user_id, user.id, \`\${contract.manifestId} should emit on the authenticated user id\`);
        assert.equal(presence.data?.user?.id, user.id, \`\${contract.manifestId} should include the public user id\`);
        assert.equal(presence.data?.status, status, \`\${contract.manifestId} should include the updated public status\`);
    } finally {
        await capture.stop();
    }
}

async function createGeneratedEventTargetUser(prefix: string) {
    const suffix = \`\${process.pid}\${Date.now()}\${Math.random().toString(36).slice(2, 8)}\`;
    return await User.register({
        username: \`\${prefix}\${suffix.slice(-8)}\`,
        email: \`\${prefix}-\${suffix}@example.com\`,
        password: "contract-password",
    });
}

function jsonRequest(method: string, token: string, body: unknown): RequestInit {
    return {
        method,
        headers: {
            accept: "application/json",
            authorization: \`Bearer \${token}\`,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    };
}

async function withGeneratedCdn<T>(fn: (context: { cdn: Awaited<ReturnType<typeof startCdn>>; storage: GeneratedCdnStorage }) => Promise<T>): Promise<T> {
    const previous = snapshotProcessState();
    const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-contract-cdn-"));
    const configPath = path.join(tempCwd, "config.json");

    try {
        process.env.CONFIG_PATH = configPath;
        process.env.CONFIG_READONLY = "true";
        process.env.LOG_ROUTES = "false";
        await writeFile(
            configPath,
            JSON.stringify({
                general: { serverName: "localhost" },
                api: { endpointPublic: "http://localhost:3001/api/v9" },
                cdn: { endpointPublic: "https://cdn.example", endpointPrivate: "http://127.0.0.1:3003" },
                gateway: { endpointPublic: "ws://localhost:3002" },
                security: {
                    requestSignature: cdnRuntimeRequestSignature,
                    cdnSignUrls: true,
                    cdnSignatureKey: cdnRuntimeSignatureKey,
                    cdnSignatureIncludeIp: false,
                    cdnSignatureIncludeUserAgent: false,
                },
            }),
        );
        await Config.init(true);

        return await withFileStorage(async ({ storage }) => {
            const cdn = await startCdn();
            try {
                return await fn({ cdn, storage });
            } finally {
                await cdn.stop();
            }
        });
    } finally {
        restoreProcessState(previous);
        await rm(tempCwd, { recursive: true, force: true });
    }
}

async function withGeneratedCdnDatabase<T>(prefix: string, fn: (context: { cdn: Awaited<ReturnType<typeof startCdn>>; storage: GeneratedCdnStorage }) => Promise<T>): Promise<T> {
    const previous = snapshotProcessState();
    const database = await createDisposablePostgresDatabase({ prefix });
    let databaseInitialized = false;

    try {
        process.env.DATABASE = database.url;
        process.env.APPLY_DB_MIGRATIONS = "true";
        delete process.env.DB_SYNC;
        await initDatabase();
        databaseInitialized = true;

        return await withGeneratedCdn(fn);
    } finally {
        if (databaseInitialized) await closeDatabase();
        await database.close();
        restoreProcessState(previous);
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
        .replace(/:type/g, "0")
        .replace(/:emoji/g, "contract-emoji");

    assert.equal(samplePath.includes(":"), false, \`\${contract.manifestId} should have a fully substituted permission fixture path\`);
    return samplePath;
}

function samplePathForAuthenticatedResponseContract(contract: GeneratedHttpContract, userId: string) {
    return contract.path.replace(/:user_id/g, userId).replace(/:payment_source_id/g, "fixture-payment-source");
}

function rateLimitRequestInit(contract: GeneratedHttpContract, token: string): RequestInit {
    const headers: Record<string, string> = {
        accept: "application/json",
        authorization: \`Bearer \${token}\`,
    };
    const init: RequestInit = {
        method: contract.method,
        headers,
    };

    if (["POST", "PUT", "PATCH"].includes(contract.method)) {
        headers["content-type"] = "application/json";
        init.body = "{}";
    }

    return init;
}

function assertRateLimitHeaders(contract: GeneratedHttpContract, response: Response) {
    assert.ok(contract.rateLimit, \`\${contract.manifestId} should declare rate-limit metadata\`);
    assert.equal(
        response.headers.get("x-ratelimit-limit"),
        String(generatedRateLimitCounts[contract.rateLimit.group]),
        \`\${contract.manifestId} should expose its route-group rate limit\`,
    );
    assert.equal(
        response.headers.get("x-ratelimit-bucket"),
        contract.samplePath.replace(/^\\//, ""),
        \`\${contract.manifestId} should use the request path as route-specific rate-limit bucket\`,
    );
    assert.match(response.headers.get("x-ratelimit-remaining") ?? "", /^\\d+$/, \`\${contract.manifestId} should expose remaining rate-limit capacity\`);
    assert.match(response.headers.get("x-ratelimit-reset") ?? "", /^\\d+$/, \`\${contract.manifestId} should expose rate-limit reset timestamp\`);
    assert.match(response.headers.get("x-ratelimit-reset-after") ?? "", /^\\d+$/, \`\${contract.manifestId} should expose rate-limit reset window\`);
}

function cdnHeadersForContract(contract: GeneratedHttpContract) {
    if (contract.manifestId === "cdn:http:GET:/attachments/:channel_id/:message_id/:filename") {
        return { accept: "application/json", signature: cdnRuntimeRequestSignature };
    }
    return { accept: "application/json" };
}

async function assertCdnMissingObjectResponse(contract: GeneratedHttpContract, method: "GET" | "HEAD", response: Response) {
    assert.equal(response.status, 404, \`\${contract.manifestId} should report missing CDN objects for \${method}\`);
    assert.match(
        response.headers.get("cache-control") ?? "",
        /^public, max-age=\\d+, s-maxage=\\d+, immutable$/,
        \`\${contract.manifestId} should include cache headers for missing CDN objects\`,
    );

    if (method === "HEAD") return;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        const body = (await response.json()) as Record<string, unknown>;
        assert.equal(body.code, 404, \`\${contract.manifestId} should return a JSON missing-object code\`);
        assert.match(String(body.message), /^Error: (File )?not found$/i, \`\${contract.manifestId} should return a JSON missing-object message\`);
        return;
    }

    const body = await response.text();
    assert.match(body, /not found|no longer available/i, \`\${contract.manifestId} should return a missing-object body\`);
}

function cdnDownloadPathForContract(contract: GeneratedHttpContract) {
    if (contract.manifestId === "cdn:http:GET:/embed/avatars/:id") return "/embed/avatars/0";
    if (contract.manifestId === "cdn:http:GET:/embed/group-avatars/:id") return "/embed/group-avatars/0";
    return contract.samplePath;
}

function cdnStoragePathForContract(contract: GeneratedHttpContract) {
    if (contract.manifestId === "cdn:http:GET:/embed/avatars/:id" || contract.manifestId === "cdn:http:GET:/embed/group-avatars/:id") return undefined;
    if (contract.manifestId === "cdn:http:GET:/role-icons/:role_id/:hash") return \`\${contract.samplePath.slice(1)}.png\`;
    if (contract.manifestId === "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:message_id/:filename") return contract.samplePath.replace(/^\\/_spacebar\\/cdn\\//, "");
    return contract.samplePath.slice(1).replace(/\\/$/, "");
}

async function seedCdnObjectForContract(storage: GeneratedCdnStorage, contract: GeneratedHttpContract) {
    const storagePath = cdnStoragePathForContract(contract);
    if (!storagePath) return;

    await storage.set(storagePath, cdnRuntimePng);
}

function signedCdnUrl(baseUrl: string, pathValue: string) {
    const url = \`\${baseUrl}\${pathValue}\`;
    return getUrlSignature(new NewUrlSignatureData({ url })).applyToUrl(url).toString();
}

async function assertCdnValidObjectResponse(contract: GeneratedHttpContract, response: Response) {
    assert.equal(response.status, 200, \`\${contract.manifestId} should download seeded CDN objects\`);
    assert.equal(response.headers.get("cache-control"), "public, max-age=21600, s-maxage=21600, immutable", \`\${contract.manifestId} should include successful CDN cache headers\`);
    assert.equal(response.headers.get("content-type"), "image/png", \`\${contract.manifestId} should return PNG content\`);

    const body = Buffer.from(await response.arrayBuffer());
    if (cdnStoragePathForContract(contract)) {
        assert.deepEqual(body, cdnRuntimePng, \`\${contract.manifestId} should return the seeded CDN object bytes\`);
    } else {
        assert.ok(body.length > 0, \`\${contract.manifestId} should return a checked-in default asset\`);
    }
}

async function assertCdnSignedUrlResponse(contract: GeneratedHttpContract, unsignedResponse: Response, signedResponse: Response) {
    assert.equal(unsignedResponse.status, 404, \`\${contract.manifestId} should hide signed attachment objects without URL auth\`);
    assert.match(await unsignedResponse.text(), /no longer available/i, \`\${contract.manifestId} should return the signed-url missing body\`);
    await assertCdnValidObjectResponse(contract, signedResponse);
}

async function assertCdnMissingSignatureResponse(contract: GeneratedHttpContract, response: Response) {
    assert.equal(response.status, 400, \`\${contract.manifestId} should reject missing CDN request signatures\`);
    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON signature error\`);

    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.code, 400, \`\${contract.manifestId} should return the signature error code\`);
    assert.match(String(body.message), /^Error: Invalid request signature/, \`\${contract.manifestId} should return the signature error message\`);
}

async function assertCdnDeleteResponse(contract: GeneratedHttpContract, response: Response) {
    assert.equal(response.status, 200, \`\${contract.manifestId} should delete seeded CDN objects\`);
    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON delete response\`);

    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(body, { success: true }, \`\${contract.manifestId} should return the CDN delete success body\`);
}

async function postGeneratedCdnMultipart(url: string, filename = "generated.png") {
    const form = new FormData();
    const bytes = new Uint8Array(cdnRuntimePng.length);
    bytes.set(cdnRuntimePng);
    form.set("file", new Blob([bytes], { type: "image/png" }), filename);

    return await fetch(url, {
        method: "POST",
        headers: {
            accept: "application/json",
            signature: cdnRuntimeRequestSignature,
        },
        body: form,
    });
}

async function assertCdnFilenameSanitizationResponse(contract: GeneratedHttpContract, response: Response, storage: GeneratedCdnStorage) {
    const body = await assertCdnUploadResponse(contract, response);

    assert.equal(body.filename, "generated_unsafe.png", \`\${contract.manifestId} should sanitize uploaded attachment filenames\`);
    assert.equal(body.path, "attachments/100000000000000002/100000000000000003/generated_unsafe.png", \`\${contract.manifestId} should return the sanitized storage path\`);
    assert.equal(await storage.exists(String(body.path)), true, \`\${contract.manifestId} should persist the sanitized filename path\`);
}

async function postGeneratedCdnInvalidMultipart(url: string) {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([0x6e, 0x6f, 0x74, 0x2d, 0x61, 0x6e, 0x2d, 0x69, 0x6d, 0x61, 0x67, 0x65])], { type: "text/plain" }), "invalid.txt");

    return await fetch(url, {
        method: "POST",
        headers: {
            accept: "application/json",
            signature: cdnRuntimeRequestSignature,
        },
        body: form,
    });
}

function cdnUploadStoragePathForContract(contract: GeneratedHttpContract, body: Record<string, unknown>) {
    if (typeof body.path === "string") return body.path.replace(/^\\/+/, "");

    const samplePath = contract.samplePath.slice(1).replace(/\\/$/, "");
    if (contract.manifestId === "cdn:http:POST:/emojis/:emoji_id" || contract.manifestId === "cdn:http:POST:/stickers/:sticker_id") return samplePath;

    assert.equal(typeof body.id, "string", \`\${contract.manifestId} should return an uploaded CDN object id\`);
    const id = body.id as string;
    return \`\${samplePath}/\${id}\`;
}

async function assertCdnUploadResponse(contract: GeneratedHttpContract, response: Response) {
    assert.equal(response.status, 200, \`\${contract.manifestId} should upload CDN objects\`);
    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON upload response\`);

    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.content_type, "image/png", \`\${contract.manifestId} should report uploaded PNG content\`);
    assert.equal(body.size, cdnRuntimePng.length, \`\${contract.manifestId} should report uploaded byte size\`);
    assert.equal(typeof body.url, "string", \`\${contract.manifestId} should return a CDN URL\`);
    return body;
}

async function assertCdnInvalidUploadResponse(contract: GeneratedHttpContract, response: Response) {
    assert.equal(response.status, 400, \`\${contract.manifestId} should reject invalid CDN upload files\`);
    assert.match(response.headers.get("content-type") ?? "", /application\\/json/, \`\${contract.manifestId} should return a JSON invalid-file response\`);

    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.code, 400, \`\${contract.manifestId} should return the invalid-file error code\`);
    assert.equal(body.message, "Error: Invalid file type", \`\${contract.manifestId} should return the invalid-file message\`);
}

function requiredCdnInternalAttachmentContract(manifestId: string) {
    const contract = cdnInternalAttachmentContracts.find((entry) => entry.manifestId === manifestId);
    assert.ok(contract, \`\${manifestId} should be present in generated CDN internal attachment contracts\`);
    return contract;
}

async function createGeneratedCloudAttachmentFixture() {
    const channelId = "100000000000000002";
    const batchId = "value";
    const attachmentId = "value";
    const filename = "file.png";
    const messageId = "100000000000000003";
    const uploadFilename = \`\${channelId}/\${batchId}/\${attachmentId}/\${filename}\`;
    const user = await makeUser({ id: "100000000000000100" }).save();
    const guild = await makeGuild(user, { id: "100000000000000101" }).save();
    const channel = await makeChannel(guild, { id: channelId }).save();
    const attachment = await CloudAttachment.create({
        user,
        channel,
        uploadFilename,
        userAttachmentId: attachmentId,
        userFilename: filename,
        userFileSize: cdnRuntimePng.length,
    }).save();

    return { attachment, channelId, batchId, attachmentId, filename, messageId, uploadFilename };
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
                    assert.equal(typeof body.errors, "object", \`\${contract.manifestId} should include validation errors\`);
                    assert.notEqual(body.errors, null, \`\${contract.manifestId} should include validation errors\`);
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
            assert.equal(typeof body.errors, "object", \`\${contract.manifestId} should include validation errors\`);
            assert.notEqual(body.errors, null, \`\${contract.manifestId} should include validation errors\`);
        }
    } finally {
        restoreConsole();
        if (api) await api.stop();
    }
});

test(
    "generated HTTP event-emission contracts emit declared events through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 600_000,
    },
    async () => {
        assert.equal(eventEmissionContracts.length, matrix.summary.runtimeEventEmissionContracts);
        assert.equal(eventEmissionContracts.length, eventEmissionManifestIds.size, "expected configured event-emission routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            let index = 0;
            for (const contract of eventEmissionContracts) {
                await withAuthenticatedApi(\`spacebar_contracts_events_\${index++}\`, async (context) => {
                    await assertGeneratedEventEmissionContract(contract, context);
                });
            }
        } finally {
            restoreConsole();
        }
    },
);

test(
    "generated HTTP rate-limited route groups expose rate-limit headers through the real API stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(rateLimitHeaderContracts.length, matrix.summary.runtimeRateLimitHeaderContracts);
        assert.ok(rateLimitHeaderContracts.length > 0, "expected rate-limited API route groups to be covered");

        const restoreConsole = silenceConsole();
        let restoreRateLimits: () => void = () => undefined;
        try {
            await withAuthenticatedApi(
                "spacebar_contracts_rate_limits",
                async ({ api, token }) => {
                    for (const contract of rateLimitHeaderContracts) {
                        const response = await fetch(\`\${api.apiBaseUrl}\${contract.samplePath}\`, rateLimitRequestInit(contract, token));
                        assertRateLimitHeaders(contract, response);
                    }
                },
                {
                    beforeStart: async () => {
                        const configPath = path.join(process.cwd(), "rate-limit-config.json");
                        process.env.CONFIG_PATH = configPath;
                        process.env.CONFIG_READONLY = "true";
                        await writeFile(
                            configPath,
                            JSON.stringify({
                                general: { serverName: "localhost" },
                                api: { endpointPublic: "http://localhost:3001/api/v9" },
                                cdn: { endpointPublic: "http://localhost:3003", endpointPrivate: "http://127.0.0.1:3003" },
                                gateway: { endpointPublic: "ws://localhost:3002" },
                            }),
                        );
                        await Config.init(true);
                        restoreRateLimits = configureGeneratedRateLimits();
                    },
                    afterStop: () => {
                        restoreRateLimits();
                    },
                },
            );
        } finally {
            restoreConsole();
        }
    },
);

test("generated CDN missing-object contracts reject absent GET objects through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnMissingObjectContracts.length, matrix.summary.runtimeCdnMissingObjectContracts);
    assert.ok(cdnMissingObjectContracts.length > 0, "expected CDN missing-object routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        await withGeneratedCdn(async ({ cdn }) => {
            for (const contract of cdnMissingObjectContracts) {
                const response = await fetch(\`\${cdn.baseUrl}\${contract.samplePath}\`, {
                    method: "GET",
                    headers: cdnHeadersForContract(contract),
                });

                await assertCdnMissingObjectResponse(contract, "GET", response);
            }
        });
    } finally {
        restoreConsole();
    }
});

test("generated CDN missing-object contracts reject absent HEAD objects through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnMissingObjectContracts.length, matrix.summary.runtimeCdnHeadMissingObjectContracts);
    assert.ok(cdnMissingObjectContracts.length > 0, "expected CDN HEAD missing-object routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        await withGeneratedCdn(async ({ cdn }) => {
            for (const contract of cdnMissingObjectContracts) {
                const response = await fetch(\`\${cdn.baseUrl}\${contract.samplePath}\`, {
                    method: "HEAD",
                    headers: cdnHeadersForContract(contract),
                });

                await assertCdnMissingObjectResponse(contract, "HEAD", response);
            }
        });
    } finally {
        restoreConsole();
    }
});

test("generated CDN valid-object contracts download seeded objects through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnValidObjectContracts.length, matrix.summary.runtimeCdnValidObjectContracts);
    assert.ok(cdnValidObjectContracts.length > 0, "expected CDN valid-object routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        for (const contract of cdnValidObjectContracts) {
            await withGeneratedCdn(async ({ cdn, storage }) => {
                await seedCdnObjectForContract(storage, contract);

                const response = await fetch(\`\${cdn.baseUrl}\${cdnDownloadPathForContract(contract)}\`, {
                    method: "GET",
                    headers: cdnHeadersForContract(contract),
                });

                await assertCdnValidObjectResponse(contract, response);
            });
        }
    } finally {
        restoreConsole();
    }
});

test("generated CDN signed URL contracts authorize attachment downloads through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnSignedUrlContracts.length, matrix.summary.runtimeCdnSignedUrlContracts);
    assert.equal(cdnSignedUrlContracts.length, 1, "expected the attachment download CDN route to be signed-url covered");

    const restoreConsole = silenceConsole();
    try {
        for (const contract of cdnSignedUrlContracts) {
            await withGeneratedCdn(async ({ cdn, storage }) => {
                await seedCdnObjectForContract(storage, contract);

                const unsignedResponse = await fetch(\`\${cdn.baseUrl}\${contract.samplePath}\`, {
                    method: "GET",
                    headers: { accept: "application/json" },
                });
                const signedResponse = await fetch(signedCdnUrl(cdn.baseUrl, contract.samplePath), {
                    method: "GET",
                    headers: { accept: "application/json" },
                });

                await assertCdnSignedUrlResponse(contract, unsignedResponse, signedResponse);
            });
        }
    } finally {
        restoreConsole();
    }
});

test("generated CDN signature-required contracts reject unsigned mutating requests through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnSignatureRequiredContracts.length, matrix.summary.runtimeCdnSignatureRequiredContracts);
    assert.ok(cdnSignatureRequiredContracts.length > 0, "expected CDN signature-required routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        await withGeneratedCdn(async ({ cdn }) => {
            for (const contract of cdnSignatureRequiredContracts) {
                const response = await fetch(\`\${cdn.baseUrl}\${contract.samplePath}\`, {
                    method: contract.method,
                    headers: { accept: "application/json" },
                });

                await assertCdnMissingSignatureResponse(contract, response);
            }
        });
    } finally {
        restoreConsole();
    }
});

test("generated CDN delete contracts remove seeded objects through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnDeleteContracts.length, matrix.summary.runtimeCdnDeleteContracts);
    assert.ok(cdnDeleteContracts.length > 0, "expected CDN delete routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        await withGeneratedCdn(async ({ cdn, storage }) => {
            for (const contract of cdnDeleteContracts) {
                const storagePath = cdnStoragePathForContract(contract);
                assert.ok(storagePath, \`\${contract.manifestId} should map to a seeded storage path\`);
                await storage.set(storagePath, cdnRuntimePng);
                assert.equal(await storage.exists(storagePath), true, \`\${contract.manifestId} should seed the CDN object before deletion\`);

                const response = await fetch(\`\${cdn.baseUrl}\${contract.samplePath}\`, {
                    method: "DELETE",
                    headers: {
                        accept: "application/json",
                        signature: cdnRuntimeRequestSignature,
                    },
                });

                await assertCdnDeleteResponse(contract, response);
                assert.equal(await storage.exists(storagePath), false, \`\${contract.manifestId} should remove the seeded CDN object\`);
            }
        });
    } finally {
        restoreConsole();
    }
});

test("generated CDN upload contracts persist multipart PNG objects through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnUploadContracts.length, matrix.summary.runtimeCdnUploadContracts);
    assert.ok(cdnUploadContracts.length > 0, "expected CDN upload routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        for (const contract of cdnUploadContracts) {
            await withGeneratedCdn(async ({ cdn, storage }) => {
                const response = await postGeneratedCdnMultipart(\`\${cdn.baseUrl}\${contract.samplePath}\`);
                const body = await assertCdnUploadResponse(contract, response);
                const storagePath = cdnUploadStoragePathForContract(contract, body);

                assert.equal(await storage.exists(storagePath), true, \`\${contract.manifestId} should persist the uploaded CDN object\`);
                assert.deepEqual(await storage.get(storagePath), cdnRuntimePng, \`\${contract.manifestId} should persist the uploaded bytes\`);
            });
        }
    } finally {
        restoreConsole();
    }
});

test("generated CDN attachment upload contracts sanitize unsafe filenames through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnFilenameSanitizationContracts.length, matrix.summary.runtimeCdnFilenameSanitizationContracts);
    assert.equal(cdnFilenameSanitizationContracts.length, 1, "expected the attachment upload CDN route to be filename-sanitization covered");

    const restoreConsole = silenceConsole();
    try {
        for (const contract of cdnFilenameSanitizationContracts) {
            await withGeneratedCdn(async ({ cdn, storage }) => {
                const response = await postGeneratedCdnMultipart(\`\${cdn.baseUrl}\${contract.samplePath}\`, "generated unsafe?.png");
                await assertCdnFilenameSanitizationResponse(contract, response, storage);
            });
        }
    } finally {
        restoreConsole();
    }
});

test("generated CDN invalid-upload contracts reject non-image multipart files through the real CDN stack", { timeout: 60_000 }, async () => {
    assert.equal(cdnInvalidUploadContracts.length, matrix.summary.runtimeCdnInvalidUploadContracts);
    assert.ok(cdnInvalidUploadContracts.length > 0, "expected CDN invalid-upload routes to be covered");

    const restoreConsole = silenceConsole();
    try {
        await withGeneratedCdn(async ({ cdn }) => {
            for (const contract of cdnInvalidUploadContracts) {
                const response = await postGeneratedCdnInvalidMultipart(\`\${cdn.baseUrl}\${contract.samplePath}\`);
                await assertCdnInvalidUploadResponse(contract, response);
            }
        });
    } finally {
        restoreConsole();
    }
});

test(
    "generated CDN internal attachment contracts upload, clone, and delete cloud attachments through the real CDN stack",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 120_000,
    },
    async () => {
        assert.equal(cdnInternalAttachmentContracts.length, matrix.summary.runtimeCdnInternalAttachmentContracts);
        assert.equal(cdnInternalAttachmentContracts.length, 3, "expected CDN internal attachment routes to be covered");

        const restoreConsole = silenceConsole();
        try {
            await withGeneratedCdnDatabase("spacebar_contracts_cdn_internal", async ({ cdn, storage }) => {
                const fixture = await createGeneratedCloudAttachmentFixture();
                const storagePath = \`attachments/\${fixture.uploadFilename}\`;
                const uploadContract = requiredCdnInternalAttachmentContract("cdn:http:PUT:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename");
                const cloneContract = requiredCdnInternalAttachmentContract(
                    "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id",
                );
                const deleteContract = requiredCdnInternalAttachmentContract("cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename");

                const upload = await fetch(\`\${cdn.baseUrl}\${uploadContract.samplePath}\`, {
                    method: "PUT",
                    headers: {
                        "content-length": String(cdnRuntimePng.length),
                        "content-type": "image/png",
                    },
                    body: cdnRuntimePng,
                });
                assert.equal(upload.status, 200, \`\${uploadContract.manifestId} should upload cloud attachment bytes\`);
                assert.equal(await upload.text(), "", \`\${uploadContract.manifestId} should return an empty upload response\`);

                const uploaded = await CloudAttachment.findOneByOrFail({ id: fixture.attachment.id });
                assert.equal(uploaded.size, cdnRuntimePng.length, \`\${uploadContract.manifestId} should persist the uploaded byte size\`);
                assert.equal(uploaded.contentType, "image/png", \`\${uploadContract.manifestId} should detect PNG content\`);
                assert.equal(uploaded.width, 1, \`\${uploadContract.manifestId} should persist PNG width\`);
                assert.equal(uploaded.height, 1, \`\${uploadContract.manifestId} should persist PNG height\`);
                assert.equal(await storage.exists(storagePath), true, \`\${uploadContract.manifestId} should write the CDN object\`);
                assert.deepEqual(await storage.get(storagePath), cdnRuntimePng, \`\${uploadContract.manifestId} should write uploaded bytes\`);

                const clone = await fetch(\`\${cdn.baseUrl}\${cloneContract.samplePath}\`, {
                    method: "POST",
                    headers: {
                        accept: "application/json",
                        signature: cdnRuntimeRequestSignature,
                    },
                });
                assert.equal(clone.status, 200, \`\${cloneContract.manifestId} should clone uploaded cloud attachments\`);
                assert.match(clone.headers.get("content-type") ?? "", /application\\/json/, \`\${cloneContract.manifestId} should return a JSON clone response\`);
                const cloneBody = (await clone.json()) as Record<string, unknown>;
                const clonedPath = \`attachments/\${fixture.channelId}/\${fixture.messageId}/\${fixture.filename}\`;
                assert.deepEqual(cloneBody, { success: true, new_path: clonedPath }, \`\${cloneContract.manifestId} should return the cloned CDN path\`);
                assert.deepEqual(await storage.get(clonedPath), cdnRuntimePng, \`\${cloneContract.manifestId} should clone uploaded bytes\`);

                const deleted = await fetch(\`\${cdn.baseUrl}\${deleteContract.samplePath}\`, {
                    method: "DELETE",
                    headers: {
                        accept: "application/json",
                        signature: cdnRuntimeRequestSignature,
                    },
                });
                await assertCdnDeleteResponse(deleteContract, deleted);
                assert.equal(await CloudAttachment.findOneBy({ id: fixture.attachment.id }), null, \`\${deleteContract.manifestId} should remove the cloud attachment row\`);
                assert.equal(await storage.exists(storagePath), false, \`\${deleteContract.manifestId} should remove the uploaded CDN object\`);
                assert.equal(await storage.exists(clonedPath), true, \`\${deleteContract.manifestId} should leave cloned message CDN objects intact\`);
            });
        } finally {
            restoreConsole();
        }
    },
);
`;
}

async function main() {
    const args = process.argv.slice(2);
    const repoRoot = path.resolve(optionValue(args, "--repo-root", path.join(__dirname, "..", "..")));
    const manifestPath = path.resolve(repoRoot, optionValue(args, "--manifest", DEFAULT_MANIFEST_PATH));
    const matrixPath = path.resolve(repoRoot, optionValue(args, "--output", DEFAULT_CONTRACT_MATRIX_PATH));
    const testPath = path.resolve(repoRoot, optionValue(args, "--test-output", DEFAULT_CONTRACT_TEST_PATH));
    const runtimeTestPath = path.resolve(repoRoot, optionValue(args, "--runtime-test-output", DEFAULT_RUNTIME_CONTRACT_TEST_PATH));
    const check = args.includes("--check");
    const matrix = buildContractMatrix(readJson(manifestPath));
    const expectedMatrix = await serialize(matrix, matrixPath);
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

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
