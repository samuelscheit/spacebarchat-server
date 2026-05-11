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
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { ClaimedQuestResponse, QuestClaimedQuestsResponse, QuestUserStatusResponse } from "@spacebar/schemas";
import express from "express";
import claimedQuestsRouter, {
    buildEmptyClaimedQuestsResponse,
    createClaimedQuestsRouter,
    getClaimedQuests,
    getConfiguredClaimedQuests,
    toClaimedQuestsResponse,
    type ClaimedQuestsProvider,
} from "../../src/api/routes/quests/@me/claimed";

const coveredManifestIds = ["api:http:GET:/quests/@me/claimed/"];
const questId = "8206816794116096000";
const rewardSkuId = "200000000000000001";
const userId = "222069018507345921";
const otherUserId = "333333333333333333";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    anyOf?: JsonSchema[];
    additionalProperties?: JsonSchema | boolean | Record<string, never>;
};

describe("GET /quests/@me/claimed", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/quests/@me/claimed/"]);
    });

    test("returns the documented empty claimed-quest collection by default", async () => {
        assert.deepEqual(buildEmptyClaimedQuestsResponse(), expectedEmptyClaimedQuestsResponse);
        assert.deepEqual(getConfiguredClaimedQuests(userId), expectedEmptyClaimedQuestsResponse);
        assert.notEqual(getConfiguredClaimedQuests(userId).quests, getConfiguredClaimedQuests(userId).quests);
        assert.deepEqual(await getClaimedQuests(userId, () => undefined), expectedEmptyClaimedQuestsResponse);

        const response = await requestJson(createRouteApp(), "/quests/@me/claimed");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, expectedEmptyClaimedQuestsResponse);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
    });

    test("returns only locally provider-backed claimed quest fields for the authenticated user", async () => {
        const source = {
            quests: [
                {
                    ...sampleClaimedQuest,
                    internal_notes: "do not serialize",
                    config: {
                        ...sampleClaimedQuest.config,
                        starts_at: new Date(sampleClaimedQuest.config.starts_at),
                        expires_at: new Date(sampleClaimedQuest.config.expires_at),
                        internal_notes: "do not serialize",
                        rewards: [
                            {
                                ...sampleClaimedQuest.config.rewards[0],
                                internal_notes: "do not serialize",
                            },
                        ],
                    },
                    user_status: {
                        ...sampleClaimedQuest.user_status,
                        claimed_at: new Date(sampleClaimedQuest.user_status.claimed_at ?? ""),
                        internal_notes: "do not serialize",
                    },
                },
            ],
            internal_notes: "do not serialize",
        } as unknown as QuestClaimedQuestsResponse;

        const response = await requestJson(
            createRouteApp(() => source),
            "/quests/@me/claimed",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleClaimedQuestsResponse);
        assert.deepEqual(toClaimedQuestsResponse(source, userId), sampleClaimedQuestsResponse);
        assert.equal((response.body as QuestClaimedQuestsResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(((response.body as QuestClaimedQuestsResponse).quests[0] as ClaimedQuestResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(((response.body as QuestClaimedQuestsResponse).quests[0].config as { internal_notes?: unknown }).internal_notes, undefined);
    });

    test("filters malformed, cross-user, and unclaimed provider data instead of leaking unsupported quest state", async () => {
        const source = {
            quests: [
                sampleClaimedQuest,
                { ...sampleClaimedQuest, user_status: { ...sampleClaimedQuestUserStatus, user_id: otherUserId } },
                { ...sampleClaimedQuest, user_status: { ...sampleClaimedQuestUserStatus, claimed_at: null } },
                { ...sampleClaimedQuest, id: "not-a-snowflake" },
                { ...sampleClaimedQuest, config: { ...sampleClaimedQuest.config, id: "8206816794116096001" } },
                { ...sampleClaimedQuest, config: { ...sampleClaimedQuest.config, rewards: [{ ...sampleClaimedQuest.config.rewards[0], orb_quantity: -1 }] } },
            ],
        } as unknown as QuestClaimedQuestsResponse;

        assert.deepEqual(toClaimedQuestsResponse(source, userId), sampleClaimedQuestsResponse);
    });

    test("stays bearer-authenticated and does not make adjacent quest routes public", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/@me/claimed"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/quests/@me/claimed/"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/@me"), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}`), true);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}/reward-code`), false);

        const response = await requestJson(createAuthenticationBoundaryApp(), "/quests/@me/claimed");
        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("declares source-backed metadata for the authenticated claimed-quests contract", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "quests", "@me", "claimed.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Claimed Quests"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestClaimedQuestsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /right:\s*"OPERATOR"|emitEvent|QUESTS_USER_STATUS_UPDATE|claim-reward|reward-code|video-progress|router\.post/);
    });

    test("generates response schema, source catalog, OpenAPI, manifest, contracts, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.QuestClaimedQuestsResponse.type, "object");
        assert.deepEqual(schemas.QuestClaimedQuestsResponse.required, ["quests"]);
        assert.equal(schemas.QuestClaimedQuestsResponse.properties?.quests?.items?.$ref, "#/definitions/ClaimedQuestResponse");
        assert.deepEqual(schemas.ClaimedQuestResponse.required?.sort(), ["config", "id", "user_status"]);
        assert.deepEqual(schemas.ClaimedQuestConfigResponse.required?.sort(), ["assets", "colors", "expires_at", "features", "id", "messages", "rewards", "starts_at"]);
        assert.equal(schemas.ClaimedQuestConfigResponse.properties?.rewards?.items?.$ref, "#/definitions/ClaimedQuestRewardResponse");
        assert.deepEqual(schemas.ClaimedQuestRewardResponse.required?.sort(), ["asset", "name", "name_with_article", "sku_id", "type"]);
        assert.deepEqual(
            schemas.ClaimedQuestRewardResponse.properties?.collectible_product?.anyOf?.map((schema) => schema.$ref ?? schema.type),
            ["#/definitions/ClaimedQuestCollectibleProductResponse", "null"],
        );
        assert.equal(schemas.ClaimedQuestCollectibleProductResponse.type, "object");
        assert.deepEqual(schemas.ClaimedQuestCollectibleProductResponse.additionalProperties, {});

        const route = openapi.paths?.["/quests/@me/claimed/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestClaimedQuestsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/quests/@me/claimed");
        assert.equal(sourceEntry?.route_name, "GET_QUESTS__ME_CLAIMED");
        assert.equal(sourceEntry?.source, "src/api/routes/quests/@me/claimed.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "QuestClaimedQuestsResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/quests/@me/claimed.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "QuestClaimedQuestsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/quests/@me/claimed/");
        assert.equal(contract?.routeMetadata?.responses?.includes("QuestClaimedQuestsResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/quests/@me/claimed" && entry.route_name === "GET_QUESTS__ME_CLAIMED"),
            false,
        );
    });
});

const sampleClaimedQuestUserStatus: QuestUserStatusResponse = {
    user_id: userId,
    quest_id: questId,
    enrolled_at: "2077-01-01T11:59:59.000Z",
    completed_at: "2077-01-01T12:30:00.000Z",
    claimed_at: "2077-01-01T18:41:29.706Z",
    claimed_tier: null,
    progress: {},
};

const sampleClaimedQuest: ClaimedQuestResponse = {
    id: questId,
    config: {
        id: questId,
        starts_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
        features: [3, 9],
        colors: {
            primary: "#5865f2",
            secondary: "#57f287",
        },
        assets: {
            hero: "hero.png",
            hero_video: null,
            quest_bar_hero: "quest-bar-hero.png",
            quest_bar_hero_video: null,
            game_tile: "game-tile.png",
            logotype: "logotype.png",
        },
        messages: {
            quest_name: "Spacebar Quest",
            game_title: "Spacebar",
            game_publisher: "Spacebar Contributors",
        },
        rewards: [
            {
                type: 3,
                sku_id: rewardSkuId,
                name: "Reward",
                name_with_article: "a Reward",
                asset: "reward.png",
                asset_video: null,
                orb_quantity: 10,
                collectible_product: {
                    sku_id: rewardSkuId,
                    name: "Reward",
                },
            },
        ],
    },
    user_status: sampleClaimedQuestUserStatus,
};

const sampleClaimedQuestsResponse: QuestClaimedQuestsResponse = {
    quests: [sampleClaimedQuest],
};

const expectedEmptyClaimedQuestsResponse: QuestClaimedQuestsResponse = {
    quests: [],
};

function createRouteApp(provider: ClaimedQuestsProvider = getConfiguredClaimedQuests) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/quests/@me/claimed", createClaimedQuestsRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticationBoundaryApp() {
    const app = express();

    app.use(Authentication);
    app.use("/quests/@me/claimed", claimedQuestsRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, init?: RequestInit) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address();
        assert(address && typeof address === "object");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, init);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await close(server);
    }
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
