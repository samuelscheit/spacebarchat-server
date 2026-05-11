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
import type { QuestConfigResponse, QuestCurrentUserQuestsResponse, QuestResponse, QuestUserStatusResponse } from "@spacebar/schemas";
import express from "express";
import currentUserQuestsRouter, {
    buildEmptyCurrentUserQuestsResponse,
    createCurrentUserQuestsRouter,
    getConfiguredCurrentUserQuests,
    getCurrentUserQuests,
    toCurrentUserQuestsResponse,
    type CurrentUserQuestsProvider,
} from "../../src/api/routes/quests/@me";

const coveredManifestIds = ["api:http:GET:/quests/@me/"];
const questId = "8206816794116096000";
const excludedQuestId = "8206816794116096001";
const userId = "222069018507345921";
const otherUserId = "333333333333333333";
const blockedUntil = "2077-01-01T18:41:29.706Z";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /quests/@me", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/quests/@me/"]);
    });

    test("returns the documented empty current-user quest collection by default", async () => {
        assert.deepEqual(buildEmptyCurrentUserQuestsResponse(), expectedEmptyCurrentUserQuestsResponse);
        assert.deepEqual(getConfiguredCurrentUserQuests(userId), expectedEmptyCurrentUserQuestsResponse);
        assert.notEqual(getConfiguredCurrentUserQuests(userId).quests, getConfiguredCurrentUserQuests(userId).quests);
        assert.deepEqual(await getCurrentUserQuests(userId, () => undefined), expectedEmptyCurrentUserQuestsResponse);

        const response = await requestJson(createRouteApp(), "/quests/@me");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, expectedEmptyCurrentUserQuestsResponse);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
    });

    test("returns only locally provider-backed quest fields for the authenticated user", async () => {
        const source = {
            ...sampleCurrentUserQuestsResponse,
            quest_enrollment_blocked_until: new Date(blockedUntil),
            quests: [
                {
                    ...sampleQuest,
                    internal_notes: "do not serialize",
                    config: {
                        ...sampleQuestConfig,
                        internal_notes: "do not serialize",
                    },
                    user_status: {
                        ...sampleQuestUserStatus,
                        internal_notes: "do not serialize",
                        progress: {
                            PLAY_ON_DESKTOP: {
                                ...sampleQuestUserStatus.progress.PLAY_ON_DESKTOP,
                                updated_at: new Date(sampleQuestUserStatus.progress.PLAY_ON_DESKTOP.updated_at),
                                internal_notes: "do not serialize",
                            },
                        },
                    },
                },
            ],
            excluded_quests: [
                {
                    id: excludedQuestId,
                    config: sampleQuestConfig,
                    internal_notes: "do not serialize",
                },
            ],
            internal_notes: "do not serialize",
        } as unknown as QuestCurrentUserQuestsResponse;

        const response = await requestJson(
            createRouteApp(() => source),
            "/quests/@me",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleCurrentUserQuestsResponse);
        assert.deepEqual(toCurrentUserQuestsResponse(source, userId), sampleCurrentUserQuestsResponse);
        assert.equal((response.body as QuestCurrentUserQuestsResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(((response.body as QuestCurrentUserQuestsResponse).quests[0] as QuestResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.deepEqual((response.body as QuestCurrentUserQuestsResponse).excluded_quests, [{ id: excludedQuestId }]);
    });

    test("filters malformed or cross-user provider data instead of leaking unsupported quest state", async () => {
        const source = {
            quests: [
                sampleQuest,
                { ...sampleQuest, user_status: { ...sampleQuestUserStatus, user_id: otherUserId } },
                { ...sampleQuest, id: "not-a-snowflake" },
                { ...sampleQuest, config: { ...sampleQuestConfig, id: excludedQuestId } },
                { ...sampleQuest, targeted_content: [1, -1] },
            ],
            excluded_quests: [{ id: excludedQuestId }, { id: "not-a-snowflake" }],
            quest_enrollment_blocked_until: "not-a-date",
        } as unknown as QuestCurrentUserQuestsResponse;

        assert.deepEqual(toCurrentUserQuestsResponse(source, userId), {
            quests: [sampleQuest],
            excluded_quests: [{ id: excludedQuestId }],
            quest_enrollment_blocked_until: null,
        });
    });

    test("stays bearer-authenticated and does not make adjacent quest routes public", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/@me"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/quests/@me/"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/@me/claimed"), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}`), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/decision?placement=1"), false);

        const response = await requestJson(createAuthenticationBoundaryApp(), "/quests/@me");
        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("declares source-backed metadata for the authenticated current-user quests contract", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "quests", "@me.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Current User Quests"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestCurrentUserQuestsResponse"/s);
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

        assert.equal(schemas.QuestCurrentUserQuestsResponse.type, "object");
        assert.deepEqual(schemas.QuestCurrentUserQuestsResponse.required?.sort(), ["excluded_quests", "quest_enrollment_blocked_until", "quests"]);
        assert.equal(schemas.QuestCurrentUserQuestsResponse.properties?.quests?.items?.$ref, "#/definitions/QuestResponse");
        assert.equal(schemas.QuestCurrentUserQuestsResponse.properties?.excluded_quests?.items?.$ref, "#/definitions/PartialQuestResponse");
        assert.deepEqual(schemas.QuestCurrentUserQuestsResponse.properties?.quest_enrollment_blocked_until?.type, ["null", "string"]);
        assert.deepEqual(schemas.PartialQuestResponse.required, ["id"]);

        const route = openapi.paths?.["/quests/@me/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestCurrentUserQuestsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/quests/@me");
        assert.equal(sourceEntry?.route_name, "GET_QUESTS__ME");
        assert.equal(sourceEntry?.source, "src/api/routes/quests/@me.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "QuestCurrentUserQuestsResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/quests/@me.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "QuestCurrentUserQuestsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/quests/@me/");
        assert.equal(contract?.routeMetadata?.responses?.includes("QuestCurrentUserQuestsResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/quests/@me" && entry.route_name === "GET_QUESTS__ME"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/quests/@me/claimed"),
            false,
        );
    });
});

const sampleQuestConfig: QuestConfigResponse = {
    id: questId,
    config_version: 2,
    starts_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    features: [1, 2],
    application: {
        id: "100000000000000001",
        name: "Spacebar Quest",
        link: "https://example.invalid/spacebar-quest",
    },
    assets: {
        hero: "hero.png",
        hero_video: null,
        quest_bar_hero: "quest-bar-hero.png",
        quest_bar_hero_video: null,
        game_tile: "game-tile.png",
        logotype: "logotype.png",
    },
    colors: {
        primary: "#5865f2",
        secondary: "#57f287",
    },
    messages: {
        quest_name: "Spacebar Quest",
        game_title: "Spacebar",
        game_publisher: "Spacebar Contributors",
    },
    task_config: {
        type: 1,
        join_operator: "and",
        tasks: {
            PLAY_ON_DESKTOP: {
                event_name: "PLAY_ON_DESKTOP",
                target: 900,
                external_ids: ["external-game-id"],
                title: "Play Spacebar",
                description: "Play Spacebar on desktop.",
            },
        },
        enrollment_url: "https://example.invalid/enroll",
        developer_application_id: "100000000000000001",
    },
    rewards_config: {
        assignment_method: 1,
        rewards: [
            {
                type: 3,
                sku_id: "200000000000000001",
                asset: "reward.png",
                asset_video: null,
                messages: {
                    name: "Reward",
                    name_with_article: "a Reward",
                    redemption_instructions_by_platform: {
                        "0": "Redeem in app.",
                    },
                },
                approximate_count: null,
                redemption_link: null,
                expires_at: null,
                expires_at_premium: null,
                expiration_mode: 1,
                orb_quantity: 10,
                quantity: 1,
            },
        ],
        rewards_expire_at: null,
        platforms: [0],
    },
};

const sampleQuestUserStatus: QuestUserStatusResponse = {
    user_id: userId,
    quest_id: questId,
    enrolled_at: "2077-01-01T11:59:59.000Z",
    completed_at: null,
    claimed_at: null,
    claimed_tier: null,
    last_stream_heartbeat_at: null,
    stream_progress_seconds: 0,
    dismissed_quest_content: 0,
    progress: {
        PLAY_ON_DESKTOP: {
            event_name: "PLAY_ON_DESKTOP",
            value: 300,
            updated_at: "2077-01-01T12:00:00.000Z",
            completed_at: null,
            heartbeat: {
                last_beat_at: "2077-01-01T12:00:00.000Z",
                expires_at: null,
            },
        },
    },
};

const sampleQuest: QuestResponse = {
    id: questId,
    config: sampleQuestConfig,
    user_status: sampleQuestUserStatus,
    targeted_content: [1, 2],
    preview: false,
};

const sampleCurrentUserQuestsResponse: QuestCurrentUserQuestsResponse = {
    quests: [sampleQuest],
    excluded_quests: [{ id: excludedQuestId }],
    quest_enrollment_blocked_until: blockedUntil,
};

const expectedEmptyCurrentUserQuestsResponse: QuestCurrentUserQuestsResponse = {
    quests: [],
    excluded_quests: [],
    quest_enrollment_blocked_until: null,
};

function createRouteApp(provider: CurrentUserQuestsProvider = getConfiguredCurrentUserQuests) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/quests/@me", createCurrentUserQuestsRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticationBoundaryApp() {
    const app = express();

    app.use(Authentication);
    app.use("/quests/@me", currentUserQuestsRouter);
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
