#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_MANIFEST_PATH } = require("./lib");

const DEFAULT_CONTRACT_MATRIX_PATH = path.join("test", "generated", "http-contracts.json");
const DEFAULT_CONTRACT_TEST_PATH = path.join("test", "generated", "http-contracts.test.js");
const DEFAULT_RUNTIME_CONTRACT_TEST_PATH = path.join("test", "generated", "http-auth-runtime-contracts.test.ts");

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
    const runtimePublicAuthBoundaryContracts = contracts.filter((contract) => contract.service === "api" && contract.authMode === "public" && contract.method !== "OPTIONS").length;
    const runtimePublicInvalidBodyContracts = contracts.filter(supportsRuntimePublicInvalidBodyContract).length;

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
            runtimePublicAuthBoundaryContracts,
            runtimePublicInvalidBodyContracts,
        },
        contracts,
    };
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
import { test } from "node:test";
import { startApi } from "../server/startApi";

type GeneratedHttpContract = {
    manifestId: string;
    service: string;
    method: string;
    samplePath: string;
    authMode: string;
    routeMetadata: {
        requestBody?: string;
    };
};

type GeneratedHttpContractMatrix = {
    summary: {
        runtimeAuthBoundaryContracts: number;
        runtimeMalformedAuthContracts: number;
        runtimePublicAuthBoundaryContracts: number;
        runtimePublicInvalidBodyContracts: number;
    };
    contracts: GeneratedHttpContract[];
};

// This path is resolved from the compiled dist-test/test/generated directory.
const matrix = require("../../../test/generated/http-contracts.json") as GeneratedHttpContractMatrix;

const protectedApiContracts = matrix.contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS");
const publicApiContracts = matrix.contracts.filter((contract) => contract.service === "api" && contract.authMode === "public" && contract.method !== "OPTIONS");
const publicRequestBodyValidationExclusions = new Set(["api:http:POST:/webhooks/:webhook_id/:token/github/"]);
const publicInvalidBodyContracts = matrix.contracts.filter(
    (contract) =>
        contract.service === "api" &&
        contract.authMode === "public" &&
        contract.method !== "OPTIONS" &&
        contract.routeMetadata.requestBody &&
        !publicRequestBodyValidationExclusions.has(contract.manifestId),
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
