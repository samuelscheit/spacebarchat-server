/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import {
    MISSING_TEAM_PAYOUT_ONBOARDING_ACCESS_ERROR,
    TEAM_PAYOUT_ONBOARDING_UNSUPPORTED_MESSAGE,
    UNKNOWN_TEAM_PAYOUT_ONBOARDING_TEAM_ERROR,
    createTeamPayoutOnboardingRouter,
    getTeamPayoutOnboarding,
    type TeamPayoutOnboardingRepositories,
    type TeamPayoutOnboardingTarget,
} from "../../src/api/routes/teams/#team_id/payouts/onboarding";

const coveredManifestId = "api:http:GET:/teams/:team_id/payouts/onboarding/";
const sourceFile = "src/api/routes/teams/#team_id/payouts/onboarding.ts";

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function team(overrides: Partial<TeamPayoutOnboardingTarget> = {}): TeamPayoutOnboardingTarget {
    return {
        owner_user_id: "owner",
        ...overrides,
    };
}

function createApp(repositories: TeamPayoutOnboardingRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/teams/:team_id/payouts/onboarding", createTeamPayoutOnboardingRouter(repositories));
    app.use(
        (
            error: { code?: number | string; httpStatus?: number; message?: string; status?: number; statusCode?: number },
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            res.status(error.httpStatus ?? error.status ?? error.statusCode ?? 400).json({ code: error.code, message: error.message });
        },
    );

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /teams/:team_id/payouts/onboarding", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/teams/:team_id/payouts/onboarding/");
    });

    test("queries the team owner and fails closed without fabricating a Tipalti URL", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        await assert.rejects(
            () => getTeamPayoutOnboarding("team-1", "owner", { teamRepository }),
            (error: { code?: number; httpStatus?: number; message?: string }) =>
                error.code === 0 && error.httpStatus === 501 && error.message === TEAM_PAYOUT_ONBOARDING_UNSUPPORTED_MESSAGE,
        );
        assert.deepEqual(teamRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "team-1" },
            select: { owner_user_id: true },
        });
    });

    test("rejects non-owner users before unsupported provider handling", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        await assert.rejects(
            () => getTeamPayoutOnboarding("team-1", "member", { teamRepository }),
            (error) => error === MISSING_TEAM_PAYOUT_ONBOARDING_ACCESS_ERROR,
        );
    });

    test("returns unknown team when the team does not exist", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getTeamPayoutOnboarding("missing-team", "owner", { teamRepository }),
            (error) => error === UNKNOWN_TEAM_PAYOUT_ONBOARDING_TEAM_ERROR,
        );
    });

    test("returns the mounted unsupported route response for the team owner", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team()),
            },
        };

        const response = await requestJson(createApp(repositories), "/teams/team-1/payouts/onboarding");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: TEAM_PAYOUT_ONBOARDING_UNSUPPORTED_MESSAGE,
        });
    });

    test("returns missing access from the mounted route for non-owners", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team()),
            },
        };

        const response = await requestJson(createApp(repositories, "member"), "/teams/team-1/payouts/onboarding");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: MISSING_TEAM_PAYOUT_ONBOARDING_ACCESS_ERROR.code,
            message: MISSING_TEAM_PAYOUT_ONBOARDING_ACCESS_ERROR.message,
        });
    });

    test("declares authenticated metadata, generated artifacts, and missing-route removal", () => {
        const routeSource = fs.readFileSync(path.join(process.cwd(), sourceFile), "utf8");
        const openapi = readJson<{
            paths?: Record<string, { get?: { security?: unknown[]; responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }> } }>;
        }>(path.join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: { responseBodies?: string[]; responseStatuses?: number[]; hasQuery?: boolean };
            }[];
        }>(path.join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: { manifestId?: string; sourceFile?: string; routeMetadata?: { responses?: string[]; responseStatuses?: number[] } }[];
        }>(path.join(process.cwd(), "test", "generated", "http-contracts.json"));
        const sourceCatalog = readJson<{ method?: string; route?: string; route_name?: string; source?: string; response_schema_refs?: string[] }[]>(
            path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"),
        );
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string }[] }>(path.join(process.cwd(), "packages", "missing-routes", "missing.json"));
        assert.match(routeSource, /summary:\s*"Get Team Payout Onboarding"/);
        assert.match(routeSource, /Tipalti payee dashboard URL/);
        assert.match(routeSource, /owner access checks/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /res\.status\(200\)\.json\(\{\s*url:/s);

        const operation = openapi.paths?.["/teams/{team_id}/payouts/onboarding/"]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["200"], undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 403, 404, 501]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contractEntry?.sourceFile, sourceFile);
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [401, 403, 404, 501]);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/teams/{team_id}/payouts/onboarding");
        assert.equal(catalogEntry?.route_name, "GET_TEAMS_TEAM_ID_PAYOUTS_ONBOARDING");
        assert.equal(catalogEntry?.source, sourceFile);
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/teams/{param}/payouts/onboarding"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/teams/{param}/payouts/{param}/report"),
            true,
        );
    });
});
