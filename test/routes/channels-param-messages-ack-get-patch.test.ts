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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { ReadStateType } from "../../src/schemas";
import { getChannelMessagesAckState, patchChannelMessagesAckState, type ChannelMessagesAckDependencies } from "../../src/api/routes/channels/#channel_id/messages";

const channelId = "200000000000000002";
const userId = "100000000000000001";
const getManifestId = "api:http:GET:/channels/:channel_id/messages/ack";
const patchManifestId = "api:http:PATCH:/channels/:channel_id/messages/ack";

describe("GET and PATCH /channels/:channel_id/messages/ack", () => {
    test("returns an empty local read-state representation when the user has no channel read state", async (t) => {
        const harness = createAckHarness(t);

        assert.deepEqual(await getChannelMessagesAckState(userId, channelId, harness.dependencies), {
            channel_id: channelId,
            read_state_type: ReadStateType.CHANNEL,
            last_message_id: null,
            notifications_cursor: null,
            mention_count: 0,
            last_pin_timestamp: null,
            last_viewed: 0,
            flags: 0,
        });
        assert.equal(harness.findCalls.length, 1);
    });

    test("patches only locally backed read-state fields and emits Message Ack when a message cursor is supplied", async (t) => {
        const harness = createAckHarness(t, {
            last_pin_timestamp: new Date("2026-05-11T12:00:00.000Z"),
        });

        const response = await patchChannelMessagesAckState(
            userId,
            channelId,
            {
                message_id: "300000000000000003",
                mention_count: 2,
                last_viewed: 17,
                flags: 1,
                token: "discord-token-is-not-persisted",
            },
            harness.dependencies,
        );

        assert.deepEqual(harness.upsertCalls, [
            [
                {
                    user_id: userId,
                    channel_id: channelId,
                },
                "300000000000000003",
                {
                    flags: 1,
                    last_viewed: 17,
                },
            ],
        ]);
        assert.equal(harness.saveCount, 1);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "MESSAGE_ACK",
                channel_id: channelId,
                data: {
                    channel_id: channelId,
                    message_id: "300000000000000003",
                    version: 3763,
                },
            },
        ]);
        assert.deepEqual(response, {
            channel_id: channelId,
            read_state_type: ReadStateType.CHANNEL,
            last_message_id: "300000000000000003",
            notifications_cursor: "300000000000000003",
            mention_count: 2,
            last_pin_timestamp: "2026-05-11T12:00:00.000Z",
            last_viewed: 17,
            flags: 1,
        });
    });

    test("rejects ambiguous or unsafe patch input before mutating read state", async (t) => {
        const harness = createAckHarness(t);

        await assert.rejects(
            () =>
                patchChannelMessagesAckState(
                    userId,
                    channelId,
                    {
                        message_id: "300000000000000003",
                        last_message_id: "400000000000000004",
                    },
                    harness.dependencies,
                ),
            /message_id and last_message_id must match/,
        );
        await assert.rejects(
            () =>
                patchChannelMessagesAckState(
                    userId,
                    channelId,
                    {
                        message_id: "not-a-snowflake",
                    },
                    harness.dependencies,
                ),
            /message_id must be a valid snowflake/,
        );
        await assert.rejects(
            () =>
                patchChannelMessagesAckState(
                    userId,
                    channelId,
                    {
                        message_id: "0",
                    },
                    harness.dependencies,
                ),
            /message_id must be a valid snowflake/,
        );
        await assert.rejects(
            () =>
                patchChannelMessagesAckState(
                    userId,
                    channelId,
                    {
                        last_message_id: "1234567890123456",
                    },
                    harness.dependencies,
                ),
            /message_id must be a valid snowflake/,
        );
        await assert.rejects(
            () =>
                patchChannelMessagesAckState(
                    userId,
                    channelId,
                    {
                        mention_count: -1,
                    },
                    harness.dependencies,
                ),
            /mention_count must be a non-negative integer/,
        );
        assert.equal(harness.upsertCalls.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
        assert.equal(harness.saveCount, 0);
    });

    test("declares generated route catalog, OpenAPI, manifest, contract, suite, and missing-route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "channels", "#channel_id", "messages", "index.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverageCatalog>(join("test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Channel Message Acknowledgement"/);
        assert.match(routeSource, /summary:\s*"Update Channel Message Acknowledgement"/);
        assert.match(routeSource, /requestBody:\s*"ChannelMessagesAckPatchSchema"/);
        assert.match(routeSource, /body:\s*"ChannelMessagesAckStateResponse"/);
        assert.match(routeSource, /permission:\s*"VIEW_CHANNEL"/);

        assert.equal(schemas.ChannelMessagesAckStateResponse?.type, "object");
        assert.equal(schemas.ChannelMessagesAckStateResponse?.properties?.channel_id?.type, "string");
        assert.deepEqual(schemaTypeSet(schemas.ChannelMessagesAckStateResponse?.properties?.last_message_id), ["null", "string"]);
        assert.deepEqual(schemaTypeSet(schemas.ChannelMessagesAckStateResponse?.properties?.notifications_cursor), ["null", "string"]);
        assert.equal(schemas.ChannelMessagesAckPatchSchema?.properties?.message_id?.type, "string");
        assert.equal(schemas.ChannelMessagesAckPatchSchema?.properties?.last_message_id?.type, "string");

        const openapiPath = openapi.paths?.["/channels/{channel_id}/messages/ack"];
        assert.equal(openapiPath?.get?.summary, "Get Channel Message Acknowledgement");
        assert.equal(openapiPath?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ChannelMessagesAckStateResponse");
        assert.equal(openapiPath?.get?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiPath?.get?.security, [{ bearer: [] }]);
        assert.equal(openapiPath?.patch?.summary, "Update Channel Message Acknowledgement");
        assert.equal(openapiPath?.patch?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ChannelMessagesAckPatchSchema");
        assert.equal(openapiPath?.patch?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ChannelMessagesAckStateResponse");
        assert.equal(openapiPath?.patch?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiPath?.patch?.security, [{ bearer: [] }]);

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === getManifestId);
        const patchManifestEntry = manifest.entries?.find((entry) => entry.id === patchManifestId);
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(getManifestEntry?.routeMetadata?.responseBodies?.includes("ChannelMessagesAckStateResponse"), true);
        assert.equal(patchManifestEntry?.authMode, "bearer");
        assert.equal(patchManifestEntry?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(patchManifestEntry?.routeMetadata?.requestBody, "ChannelMessagesAckPatchSchema");
        assert.equal(patchManifestEntry?.routeMetadata?.responseBodies?.includes("ChannelMessagesAckStateResponse"), true);

        const getCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/channels/{channel_id}/messages/ack");
        const patchCatalogEntry = sourceCatalog.find((entry) => entry.method === "PATCH" && entry.route === "/channels/{channel_id}/messages/ack");
        assert.equal(getCatalogEntry?.route_name, "GET_CHANNELS_CHANNEL_ID_MESSAGES_ACK");
        assert.deepEqual(getCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ChannelMessagesAckStateResponse"]);
        assert.equal(patchCatalogEntry?.route_name, "PATCH_CHANNELS_CHANNEL_ID_MESSAGES_ACK");
        assert.equal(patchCatalogEntry?.request_schema_ref, "ChannelMessagesAckPatchSchema");
        assert.deepEqual(patchCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ChannelMessagesAckStateResponse"]);

        for (const manifestId of [getManifestId, patchManifestId]) {
            const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
            assert.equal(contract?.authMode, "bearer");
            assert.equal(contract?.path, "/channels/:channel_id/messages/ack");
            assert.equal(contract?.routeMetadata?.permission, "VIEW_CHANNEL");
            assert.equal(JSON.stringify(suiteCoverage).includes(manifestId), true);
        }

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/channels/{param}/messages/ack"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PATCH" && entry.route === "/channels/{param}/messages/ack"),
            false,
        );
    });
});

function createAckHarness(t: TestContext, initialReadState?: Partial<FakeReadState>) {
    let saveCount = 0;
    let state: FakeReadState | null = initialReadState
        ? makeReadState({
              ...initialReadState,
              save: async () => {
                  saveCount++;
              },
          })
        : null;
    const findCalls: unknown[] = [];
    const upsertCalls: unknown[][] = [];
    const emitEventCalls: unknown[] = [];

    const dependencies: ChannelMessagesAckDependencies = {
        findChannelReadState: t.mock.fn(async (requestedUserId: string, requestedChannelId: string) => {
            findCalls.push([requestedUserId, requestedChannelId]);
            return state;
        }),
        createChannelReadState: t.mock.fn((requestedUserId: string, requestedChannelId: string) => {
            state = makeReadState({
                user_id: requestedUserId,
                channel_id: requestedChannelId,
                save: async () => {
                    saveCount++;
                },
            });
            return state;
        }),
        upsertChannelMessageReadState: t.mock.fn(async (...args: unknown[]) => {
            upsertCalls.push(args);
            const [identity, messageId, options] = args as [
                {
                    user_id: string;
                    channel_id: string;
                },
                string,
                {
                    flags?: number;
                    last_viewed?: number;
                },
            ];
            state ??= makeReadState({
                user_id: identity.user_id,
                channel_id: identity.channel_id,
                save: async () => {
                    saveCount++;
                },
            });
            state.last_message_id = messageId;
            state.notifications_cursor = messageId;
            state.mention_count = 0;
            state.last_viewed = options.last_viewed ?? state.last_viewed;
            state.flags = options.flags ?? state.flags;
        }) as ChannelMessagesAckDependencies["upsertChannelMessageReadState"],
        emitEvent: t.mock.fn(async (event: unknown) => {
            emitEventCalls.push(event);
        }) as ChannelMessagesAckDependencies["emitEvent"],
    };

    return {
        dependencies,
        findCalls,
        upsertCalls,
        emitEventCalls,
        get saveCount() {
            return saveCount;
        },
    };
}

function makeReadState(overrides: Partial<FakeReadState>): FakeReadState {
    return {
        user_id: userId,
        channel_id: channelId,
        read_state_type: ReadStateType.CHANNEL,
        last_message_id: null,
        notifications_cursor: null,
        mention_count: 0,
        last_viewed: 0,
        flags: 0,
        async save() {},
        ...overrides,
    };
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

type FakeReadState = {
    user_id: string;
    channel_id: string;
    read_state_type: ReadStateType;
    last_message_id?: string | null;
    notifications_cursor?: string | null;
    mention_count: number;
    last_pin_timestamp?: Date;
    last_viewed: number;
    flags: number;
    save(): Promise<unknown>;
};

type JsonSchema = {
    type?: string | string[];
    $ref?: string;
    properties?: Record<string, JsonSchema>;
};

function schemaTypeSet(schema: JsonSchema | undefined) {
    return (Array.isArray(schema?.type) ? schema.type : schema?.type ? [schema.type] : []).sort();
}

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: OpenApiOperation;
            patch?: OpenApiOperation;
        }
    >;
};

type OpenApiOperation = {
    summary?: string;
    requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
    responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
    security?: unknown;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        routeMetadata?: {
            permission?: string;
            requestBody?: string;
            responseBodies?: string[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        path?: string;
        routeMetadata?: {
            permission?: string;
        };
    }[];
};

type SuiteCoverageCatalog = {
    groups?: unknown[];
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};
