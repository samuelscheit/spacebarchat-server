import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import { closeDatabase, Config, generateToken, initDatabase, User } from "@spacebar/util";
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
        runtimePublicAuthBoundaryContracts: number;
        runtimePublicInvalidBodyContracts: number;
        runtimeProtectedInvalidBodyContracts: number;
        runtimePublicResponseSchemaContracts: number;
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

test("generated HTTP auth contracts reject missing bearer tokens through the real API stack", { timeout: 120_000 }, async () => {
    assert.equal(protectedApiContracts.length, matrix.summary.runtimeAuthBoundaryContracts);
    assert.ok(protectedApiContracts.length > 0, "expected protected API routes to be covered");

    const api = await startApi();
    try {
        for (const contract of protectedApiContracts) {
            const response = await fetch(`${api.apiBaseUrl}${contract.samplePath}`, {
                method: contract.method,
                headers: { accept: "application/json" },
            });

            assert.equal(response.status, 401, `${contract.manifestId} should reject missing Authorization`);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${contract.manifestId} should return a JSON error`);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, 401, `${contract.manifestId} should return the auth error code`);
            assert.equal(body.message, "Error: Missing Authorization Header", `${contract.manifestId} should return the auth error message`);
            assert.equal(body.request, `${contract.method} /api/v9${contract.samplePath}`, `${contract.manifestId} should include the request route`);
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
            const response = await fetch(`${api.apiBaseUrl}${contract.samplePath}`, {
                method: contract.method,
                headers: {
                    accept: "application/json",
                    authorization: "Bearer not-a-token",
                },
            });

            assert.equal(response.status, 401, `${contract.manifestId} should reject malformed bearer tokens`);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${contract.manifestId} should return a JSON auth error`);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, 401, `${contract.manifestId} should return the invalid token error code`);
            assert.equal(body.message, "Error: Invalid Token", `${contract.manifestId} should return the invalid token error message`);
            assert.equal(body.request, `${contract.method} /api/v9${contract.samplePath}`, `${contract.manifestId} should include the request route`);
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
            const response = await fetch(`${api.apiBaseUrl}${contract.samplePath}`, {
                method: contract.method,
                headers: { accept: "application/json" },
            });
            const body = await response.text();
            const failedInBearerMiddleware = response.status === 401 && body.includes("Missing Authorization Header");

            assert.equal(failedInBearerMiddleware, false, `${contract.manifestId} should not require bearer Authorization`);
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
            const response = await fetch(`${api.apiBaseUrl}${contract.samplePath}`, {
                method: contract.method,
                headers: { accept: "application/json" },
            });

            assert.equal(response.status, 200, `${contract.manifestId} should return a successful response for schema validation`);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${contract.manifestId} should return a JSON response`);

            const schema = responseSchemaForContract(contract);
            assert.ok(schema, `${contract.manifestId} should declare a known response schema`);
            const validate = ajv.getSchema(schema);
            assert.ok(validate, `${contract.manifestId} should resolve response schema ${schema}`);
            const body = (await response.json()) as unknown;

            assert.equal(validate(body), true, `${contract.manifestId} response should match ${schema}: ${JSON.stringify(validate.errors)}`);
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

        const previous = snapshotProcessState();
        const restoreConsole = silenceConsole();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let database: Awaited<ReturnType<typeof createDisposablePostgresDatabase>> | undefined;
        let databaseInitialized = false;
        let tempCwd: string | undefined;

        try {
            database = await createDisposablePostgresDatabase({ prefix: "spacebar_contracts_protected_body" });
            tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-contracts-protected-body-"));
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            await initDatabase();
            databaseInitialized = true;
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const user = await User.register({
                username: `contract${suffix.slice(-8)}`,
                email: `contract-${suffix}@example.com`,
                password: "contract-password",
            });
            const token = await generateToken(user.id);
            assert.ok(token, "token generation should return a bearer token");

            for (const contract of protectedInvalidBodyContracts) {
                const response = await fetch(`${api.apiBaseUrl}${contract.samplePath}`, {
                    method: contract.method,
                    headers: {
                        accept: "application/json",
                        authorization: `Bearer ${token}`,
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({ __generated_contract_invalid_body__: true }),
                });

                assert.equal(response.status, 400, `${contract.manifestId} should reject a schema-invalid request body after auth`);
                assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${contract.manifestId} should return a JSON validation error`);

                const body = (await response.json()) as Record<string, unknown>;
                assert.equal(body.code, 50035, `${contract.manifestId} should return the invalid form body code`);
                assert.equal(body.message, "Invalid Form Body", `${contract.manifestId} should return the invalid form body message`);
                assert.equal(body.request, `${contract.method} /api/v9${contract.samplePath}`, `${contract.manifestId} should include the request route`);
                assert.equal(typeof body.errors, "object", `${contract.manifestId} should include validation errors`);
                assert.notEqual(body.errors, null, `${contract.manifestId} should include validation errors`);
                assert.ok(Array.isArray(body._ajvErrors), `${contract.manifestId} should include raw AJV errors`);
                assert.ok(body._ajvErrors.length > 0, `${contract.manifestId} should include at least one raw AJV error`);
            }
        } finally {
            restoreConsole();
            if (api) await api.stop();
            if (databaseInitialized) await closeDatabase();
            if (database) await database.close();
            restoreProcessState(previous);
            if (tempCwd) await rm(tempCwd, { recursive: true, force: true });
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
            const response = await fetch(`${api.apiBaseUrl}${contract.samplePath}`, {
                method: contract.method,
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ __generated_contract_invalid_body__: true }),
            });

            assert.equal(response.status, 400, `${contract.manifestId} should reject a schema-invalid request body`);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/, `${contract.manifestId} should return a JSON validation error`);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, 50035, `${contract.manifestId} should return the invalid form body code`);
            assert.equal(body.message, "Invalid Form Body", `${contract.manifestId} should return the invalid form body message`);
            assert.equal(body.request, `${contract.method} /api/v9${contract.samplePath}`, `${contract.manifestId} should include the request route`);
            assert.equal(typeof body.errors, "object", `${contract.manifestId} should include validation errors`);
            assert.notEqual(body.errors, null, `${contract.manifestId} should include validation errors`);
            assert.ok(Array.isArray(body._ajvErrors), `${contract.manifestId} should include raw AJV errors`);
            assert.ok(body._ajvErrors.length > 0, `${contract.manifestId} should include at least one raw AJV error`);
        }
    } finally {
        restoreConsole();
        if (api) await api.stop();
    }
});
