"use strict";

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
            assert.ok(contractIds.has(id), `missing generated HTTP contract for ${id}`);
        }
    });

    test("each contract maps to a manifest id and executable contract checks", () => {
        for (const contract of matrix.contracts) {
            assert.ok(httpRouteIds.has(contract.manifestId), `unknown manifest id ${contract.manifestId}`);
            assert.ok(contract.method, `${contract.manifestId} is missing method`);
            assert.ok(contract.path, `${contract.manifestId} is missing path`);
            assert.ok(contract.samplePath && !contract.samplePath.includes(":"), `${contract.manifestId} has unresolved path params`);
            assert.ok(contract.authMode, `${contract.manifestId} is missing auth mode`);
            assert.ok(contract.testTier, `${contract.manifestId} is missing test tier`);
            assert.ok(contract.benchmarkClass, `${contract.manifestId} is missing benchmark class`);
            assert.ok(Array.isArray(contract.fixtureRequirements), `${contract.manifestId} is missing fixture requirements`);
            assert.ok(Array.isArray(contract.contractChecks), `${contract.manifestId} is missing contract checks`);
            assert.ok(Array.isArray(contract.cases) && contract.cases.length > 0, `${contract.manifestId} has no contract cases`);

            const caseChecks = new Set(contract.cases.flatMap((contractCase) => contractCase.checks));
            for (const requiredCheck of contract.contractChecks) {
                assert.ok(caseChecks.has(requiredCheck), `${contract.manifestId} does not exercise policy check ${requiredCheck}`);
            }
        }
    });

    test("API request-body routes get schema-validation cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.service === "api" && entry.routeMetadata.requestBody)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "invalid-request-body" && contractCase.checks.includes("schema-validation")),
                `${contract.manifestId} is missing invalid body schema-validation case`,
            );
        }
    });

    test("permissioned routes get authorization-denied cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.routeMetadata.permission || entry.routeMetadata.right)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "authorization-denied"),
                `${contract.manifestId} is missing authorization-denied case`,
            );
        }
    });

    test("routes with declared or emitted events get event-emission cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.routeMetadata.event || entry.routeMetadata.emittedEvents?.length)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "event-emission" && contractCase.checks.includes("events")),
                `${contract.manifestId} is missing event-emission case`,
            );
        }
    });

    test("rate-limited route groups get rate-limit header cases", () => {
        for (const contract of matrix.contracts.filter((entry) => entry.rateLimit)) {
            assert.ok(
                contract.cases.some((contractCase) => contractCase.id === "rate-limit-headers" && contractCase.checks.includes("rate-limit-headers")),
                `${contract.manifestId} is missing rate-limit header case`,
            );
        }
    });
});
