import assert from "node:assert/strict";
import { test } from "node:test";
import { startApi } from "../server/startApi";

type GeneratedHttpContract = {
    manifestId: string;
    service: string;
    method: string;
    samplePath: string;
    authMode: string;
};

type GeneratedHttpContractMatrix = {
    summary: {
        runtimeAuthBoundaryContracts: number;
    };
    contracts: GeneratedHttpContract[];
};

// This path is resolved from the compiled dist-test/test/generated directory.
const matrix = require("../../../test/generated/http-contracts.json") as GeneratedHttpContractMatrix;

const protectedApiContracts = matrix.contracts.filter((contract) => contract.service === "api" && contract.authMode === "bearer" && contract.method !== "OPTIONS");

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
