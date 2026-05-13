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
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { QuestUserStatusResponse, QuestVideoProgressSchema } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    QUEST_VIDEO_PROGRESS_EVENT_NAME,
    createQuestVideoProgressRouter,
    getConfiguredQuestVideoProgress,
    submitQuestVideoProgress,
    toQuestVideoProgressResponse,
    type QuestVideoProgressContext,
    type QuestVideoProgressEventEmitter,
    type QuestVideoProgressProvider,
} from "../../src/api/routes/quests/#quest_id/video-progress";
import { UNKNOWN_QUEST } from "../../src/api/routes/quests/#quest_id";

const coveredManifestIds = ["api:http:POST:/quests/:quest_id/video-progress/"];
const questId = "8206816794116096000";
const userId = "222069018507345921";
const otherUserId = "333333333333333333";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    minimum?: number;
};

describe("POST /quests/:quest_id/video-progress", () => {
    test("returns provider-backed video progress and emits a quest user status update", async () => {
        const contexts: QuestVideoProgressContext[] = [];
        const emitted: Array<{ userId: string; status: QuestUserStatusResponse }> = [];
        const source = {
            ...sampleQuestUserStatus,
            progress: {
                WATCH_VIDEO: {
                    ...sampleQuestUserStatus.progress.WATCH_VIDEO,
                    updated_at: new Date(sampleQuestUserStatus.progress.WATCH_VIDEO.updated_at),
                    internal_notes: "do not serialize",
                },
            },
            internal_notes: "do not serialize",
        } as unknown as QuestUserStatusResponse;

        const provider: QuestVideoProgressProvider = (context) => {
            contexts.push(context);
            return source;
        };
        const eventEmitter: QuestVideoProgressEventEmitter = (emittedUserId, status) => {
            emitted.push({ userId: emittedUserId, status });
        };
        const response = await requestJson(createRouteApp(provider, eventEmitter), `/quests/${questId}/video-progress`, {
            timestamp: 42,
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleQuestUserStatus);
        assert.deepEqual(toQuestVideoProgressResponse(source, userId, questId), sampleQuestUserStatus);
        assert.deepEqual(contexts, [{ questId, userId, timestamp: 42 }]);
        assert.deepEqual(emitted, [{ userId, status: sampleQuestUserStatus }]);
        assert.equal((response.body as QuestUserStatusResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(
            ((response.body as QuestUserStatusResponse).progress.WATCH_VIDEO as QuestUserStatusResponse["progress"][string] & { internal_notes?: unknown }).internal_notes,
            undefined,
        );
    });

    test("fails closed for absent, malformed, cross-user, or non-video progress state", async () => {
        let providerCalled = false;

        assert.equal(getConfiguredQuestVideoProgress({ questId, userId, timestamp: 42 }), undefined);
        await assert.rejects(() => submitQuestVideoProgress(questId, userId, { timestamp: 42 }, () => undefined, noopEventEmitter), isUnknownQuestError);
        await assert.rejects(
            () => submitQuestVideoProgress(questId, userId, { timestamp: 42 }, () => ({ ...sampleQuestUserStatus, user_id: otherUserId }), noopEventEmitter),
            isUnknownQuestError,
        );
        await assert.rejects(
            () => submitQuestVideoProgress(questId, userId, { timestamp: 42 }, () => ({ ...sampleQuestUserStatus, progress: {} }), noopEventEmitter),
            isUnknownQuestError,
        );
        await assert.rejects(
            () => submitQuestVideoProgress(questId, userId, { timestamp: 42 }, () => ({ ...sampleQuestUserStatus, completed_at: "not-a-date" }), noopEventEmitter),
            isUnknownQuestError,
        );
        await assert.rejects(
            () =>
                submitQuestVideoProgress(
                    "not-a-snowflake",
                    userId,
                    { timestamp: 42 },
                    () => {
                        providerCalled = true;
                        return sampleQuestUserStatus;
                    },
                    noopEventEmitter,
                ),
            { code: DiscordApiErrors.INVALID_FORM_BODY.code },
        );
        await assert.rejects(
            () =>
                submitQuestVideoProgress(
                    questId,
                    userId,
                    { timestamp: -1 },
                    () => {
                        providerCalled = true;
                        return sampleQuestUserStatus;
                    },
                    noopEventEmitter,
                ),
            { code: DiscordApiErrors.INVALID_FORM_BODY.code },
        );
        assert.equal(providerCalled, false);

        const missingResponse = await requestJson(createRouteApp(), `/quests/${questId}/video-progress`, {
            timestamp: 42,
        });
        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_QUEST.code,
            message: UNKNOWN_QUEST.message,
        });
    });

    test("validates the JSON timestamp before touching provider-backed progress", async () => {
        const calls: QuestVideoProgressContext[] = [];
        const response = await requestJson(
            createRouteApp((context) => {
                calls.push(context);
                return sampleQuestUserStatus;
            }),
            `/quests/${questId}/video-progress`,
            { timestamp: "42" },
        );

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.deepEqual(calls, []);
    });

    test("remains bearer-authenticated without changing adjacent quest route auth", async () => {
        assert.equal(isNoAuthorizationRoute("POST", `/api/v9/quests/${questId}/video-progress`), false);
        assert.equal(isNoAuthorizationRoute("HEAD", `/api/v9/quests/${questId}/video-progress/`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}`), true);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}/reward-code`), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/decision?placement=1"), false);

        const response = await requestJson(
            createRouteApp(() => sampleQuestUserStatus, noopEventEmitter),
            `/quests/${questId}/video-progress`,
            {
                timestamp: 42,
            },
        );
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleQuestUserStatus);
    });

    test("declares source-backed metadata for the authenticated video-progress contract", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "quests", "#quest_id", "video-progress.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Send Quest Video Progress"/);
        assert.match(routeSource, /requestBody:\s*"QuestVideoProgressSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestUserStatusResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, new RegExp(QUEST_VIDEO_PROGRESS_EVENT_NAME));
        assert.doesNotMatch(routeSource, /right:\s*"OPERATOR"|claim-reward|reward-code|router\.get|router\.delete/);
    });

    test("generates request and response schemas, source catalog, OpenAPI, manifest, contracts, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        parameters?: { name?: string; in?: string; required?: boolean }[];
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
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
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
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.QuestVideoProgressSchema.type, "object");
        assert.deepEqual(schemas.QuestVideoProgressSchema.required, ["timestamp"]);
        assert.equal(schemas.QuestVideoProgressSchema.properties?.timestamp?.type, "integer");
        assert.equal(schemas.QuestVideoProgressSchema.properties?.timestamp?.minimum, 0);
        assert.equal(schemas.QuestUserStatusResponse.type, "object");
        assert.equal(schemas.QuestUserStatusResponse.properties?.progress?.$ref, "#/definitions/QuestTaskProgressMap");

        const route = openapi.paths?.["/quests/{quest_id}/video-progress/"]?.post;
        assert.equal(route?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestVideoProgressSchema");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestUserStatusResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "quest_id" && parameter.in === "path" && parameter.required === true),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/quests/{quest_id}/video-progress");
        assert.equal(sourceEntry?.route_name, "POST_QUESTS_QUEST_ID_VIDEO_PROGRESS");
        assert.equal(sourceEntry?.source, "src/api/routes/quests/#quest_id/video-progress.ts");
        assert.equal(sourceEntry?.request_schema_ref, "QuestVideoProgressSchema");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "QuestUserStatusResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/quests/#quest_id/video-progress.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "QuestVideoProgressSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "QuestUserStatusResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/quests/:quest_id/video-progress/");
        assert.equal(contract?.routeMetadata?.requestBody, "QuestVideoProgressSchema");
        assert.equal(contract?.routeMetadata?.responses?.includes("QuestUserStatusResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "POST" && entry.route === "/quests/{param}/video-progress" && entry.route_name === "POST_QUESTS_QUEST_ID_VIDEO_PROGRESS",
            ),
            false,
        );
    });
});

const sampleQuestUserStatus: QuestUserStatusResponse = {
    user_id: userId,
    quest_id: questId,
    enrolled_at: "2077-01-01T11:59:59.000Z",
    completed_at: null,
    claimed_at: null,
    claimed_tier: null,
    progress: {
        WATCH_VIDEO: {
            event_name: "WATCH_VIDEO",
            value: 42,
            updated_at: "2077-01-01T12:00:42.000Z",
            completed_at: null,
        },
    },
};

function createRouteApp(provider: QuestVideoProgressProvider = getConfiguredQuestVideoProgress, eventEmitter: QuestVideoProgressEventEmitter = noopEventEmitter) {
    const app = express();

    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/quests/:quest_id/video-progress", createQuestVideoProgressRouter(provider, eventEmitter));
    app.use(ErrorHandler);

    return app;
}

function isUnknownQuestError(error: unknown): boolean {
    return (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_QUEST.code && (error as { message?: unknown }).message === UNKNOWN_QUEST.message;
}

function noopEventEmitter() {
    return undefined;
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, body: unknown) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address();
        assert(address && typeof address === "object");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        });

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
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}
