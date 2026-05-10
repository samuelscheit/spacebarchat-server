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
import path from "node:path";
import { describe, test } from "node:test";
import { ChannelType } from "@spacebar/schemas";

describe("GET /channels/:channel_id/summaries", () => {
    test("returns latest persisted conversation summaries after channel permission checks", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsUtil = require("@spacebar/util/util/Permissions") as typeof import("../../../../util/util/Permissions");
        const routeModulePath = require.resolve("@spacebar/api/routes/channels/#channel_id/summaries");
        delete require.cache[routeModulePath];

        const permissionChecks: string[] = [];

        t.mock.method(util.Channel, "findOneOrFail", async (options: { where: { id: string } }) => {
            assert.deepEqual(options, {
                where: { id: "channel-id" },
            });

            return {
                id: "channel-id",
                guild_id: "guild-id",
                type: ChannelType.GUILD_TEXT,
            };
        });
        t.mock.method(permissionsUtil, "getPermission", async (userId: string, guildId: string, channelId: string) => {
            assert.equal(userId, "user-id");
            assert.equal(guildId, "guild-id");
            assert.equal(channelId, "channel-id");

            return {
                hasThrow(permission: string) {
                    permissionChecks.push(permission);
                },
            };
        });
        t.mock.method(util.ConversationSummary, "find", async (options: { where: { channel_id: string }; order: { id: "DESC" }; take: number }) => {
            assert.deepEqual(options, {
                where: { channel_id: "channel-id" },
                order: { id: "DESC" },
                take: 50,
            });

            return [
                {
                    id: "1315651706670813286",
                    topic: "Rare Footage",
                    summ_short: "Conversation about rare footage.",
                    message_ids: ["1314941815144845413", "1314944583397937213"],
                    people: ["852892297661906993", "841509053422632990"],
                    unsafe: false,
                    start_id: "1314941815144845413",
                    end_id: "1315650462522802196",
                    count: 2,
                    source: 2,
                    type: 3,
                },
            ];
        });

        const { getChannelConversationSummaries } = require(routeModulePath) as typeof import("./summaries");
        const response = await getChannelConversationSummaries("user-id", "channel-id");

        assert.deepEqual(permissionChecks, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]);
        assert.deepEqual(response, {
            summaries: [
                {
                    id: "1315651706670813286",
                    topic: "Rare Footage",
                    summ_short: "Conversation about rare footage.",
                    message_ids: ["1314941815144845413", "1314944583397937213"],
                    people: ["852892297661906993", "841509053422632990"],
                    unsafe: false,
                    start_id: "1314941815144845413",
                    end_id: "1315650462522802196",
                    count: 2,
                    source: 2,
                    type: 3,
                },
            ],
        });
    });

    test("requires READ_MESSAGE_HISTORY before querying persisted summaries", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsUtil = require("@spacebar/util/util/Permissions") as typeof import("../../../../util/util/Permissions");
        const routeModulePath = require.resolve("@spacebar/api/routes/channels/#channel_id/summaries");
        delete require.cache[routeModulePath];

        let queriedSummaries = false;
        const missingReadPermission = new Error("missing READ_MESSAGE_HISTORY");

        t.mock.method(util.Channel, "findOneOrFail", async () => ({
            id: "channel-id",
            guild_id: "guild-id",
            type: ChannelType.GUILD_TEXT,
        }));
        t.mock.method(permissionsUtil, "getPermission", async () => ({
            hasThrow(permission: string) {
                if (permission === "READ_MESSAGE_HISTORY") throw missingReadPermission;
            },
        }));
        t.mock.method(util.ConversationSummary, "find", async () => {
            queriedSummaries = true;
            return [];
        });

        const { getChannelConversationSummaries } = require(routeModulePath) as typeof import("./summaries");

        await assert.rejects(() => getChannelConversationSummaries("user-id", "channel-id"), missingReadPermission);
        assert.equal(queriedSummaries, false);
    });

    test("deletes a persisted summary after MANAGE_MESSAGES permission checks", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsUtil = require("@spacebar/util/util/Permissions") as typeof import("../../../../util/util/Permissions");
        const routeModulePath = require.resolve("@spacebar/api/routes/channels/#channel_id/summaries");
        delete require.cache[routeModulePath];

        const previousEventTransmission = process.env.EVENT_TRANSMISSION;
        delete process.env.EVENT_TRANSMISSION;
        t.after(() => {
            if (previousEventTransmission === undefined) delete process.env.EVENT_TRANSMISSION;
            else process.env.EVENT_TRANSMISSION = previousEventTransmission;
        });

        const permissionChecks: string[] = [];
        const emittedEvents: unknown[] = [];
        const captureEvent = (event: unknown) => {
            emittedEvents.push(event);
        };
        util.events.on("guild-id", captureEvent);
        t.after(() => {
            util.events.off("guild-id", captureEvent);
        });

        t.mock.method(util.Channel, "findOne", async (options: { where: { id: string } }) => {
            assert.deepEqual(options, {
                where: { id: "123456789012345678" },
                select: {
                    id: true,
                    guild_id: true,
                    type: true,
                },
            });

            return {
                id: "123456789012345678",
                guild_id: "guild-id",
                type: ChannelType.GUILD_TEXT,
            };
        });
        t.mock.method(permissionsUtil, "getPermission", async (userId: string, guildId: string, channelId: string) => {
            assert.equal(userId, "user-id");
            assert.equal(guildId, "guild-id");
            assert.equal(channelId, "123456789012345678");

            return {
                hasThrow(permission: string) {
                    permissionChecks.push(permission);
                },
            };
        });
        t.mock.method(util.ConversationSummary, "delete", async (options: { id: string; channel_id: string }) => {
            assert.deepEqual(options, {
                id: "223456789012345678",
                channel_id: "123456789012345678",
            });

            return { affected: 1 };
        });

        const { deleteChannelConversationSummary } = require(routeModulePath) as typeof import("./summaries");
        await deleteChannelConversationSummary("user-id", "123456789012345678", "223456789012345678");

        assert.deepEqual(permissionChecks, ["MANAGE_MESSAGES"]);
        assert.deepEqual(emittedEvents, [
            {
                event: "CONVERSATION_SUMMARY_UPDATE",
                guild_id: "guild-id",
                channel_id: "123456789012345678",
                data: {
                    guild_id: "guild-id",
                    channel_id: "123456789012345678",
                    summaries: [],
                },
            },
        ]);
    });

    test("requires MANAGE_MESSAGES before deleting a summary", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsUtil = require("@spacebar/util/util/Permissions") as typeof import("../../../../util/util/Permissions");
        const routeModulePath = require.resolve("@spacebar/api/routes/channels/#channel_id/summaries");
        delete require.cache[routeModulePath];

        const previousEventTransmission = process.env.EVENT_TRANSMISSION;
        delete process.env.EVENT_TRANSMISSION;
        t.after(() => {
            if (previousEventTransmission === undefined) delete process.env.EVENT_TRANSMISSION;
            else process.env.EVENT_TRANSMISSION = previousEventTransmission;
        });

        let deletedSummary = false;
        let emittedEvent = false;
        const missingManageMessages = new Error("missing MANAGE_MESSAGES");
        const captureEvent = () => {
            emittedEvent = true;
        };
        util.events.on("guild-id", captureEvent);
        t.after(() => {
            util.events.off("guild-id", captureEvent);
        });

        t.mock.method(util.Channel, "findOne", async () => ({
            id: "123456789012345678",
            guild_id: "guild-id",
            type: ChannelType.GUILD_TEXT,
        }));
        t.mock.method(permissionsUtil, "getPermission", async () => ({
            hasThrow(permission: string) {
                if (permission === "MANAGE_MESSAGES") throw missingManageMessages;
            },
        }));
        t.mock.method(util.ConversationSummary, "delete", async () => {
            deletedSummary = true;
            return { affected: 1 };
        });

        const { deleteChannelConversationSummary } = require(routeModulePath) as typeof import("./summaries");

        await assert.rejects(() => deleteChannelConversationSummary("user-id", "123456789012345678", "223456789012345678"), missingManageMessages);
        assert.equal(deletedSummary, false);
        assert.equal(emittedEvent, false);
    });

    test("returns 404 when no persisted summary belongs to the channel", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsUtil = require("@spacebar/util/util/Permissions") as typeof import("../../../../util/util/Permissions");
        const routeModulePath = require.resolve("@spacebar/api/routes/channels/#channel_id/summaries");
        delete require.cache[routeModulePath];

        const previousEventTransmission = process.env.EVENT_TRANSMISSION;
        delete process.env.EVENT_TRANSMISSION;
        t.after(() => {
            if (previousEventTransmission === undefined) delete process.env.EVENT_TRANSMISSION;
            else process.env.EVENT_TRANSMISSION = previousEventTransmission;
        });

        let emittedEvent = false;
        const captureEvent = () => {
            emittedEvent = true;
        };
        util.events.on("guild-id", captureEvent);
        t.after(() => {
            util.events.off("guild-id", captureEvent);
        });

        t.mock.method(util.Channel, "findOne", async () => ({
            id: "123456789012345678",
            guild_id: "guild-id",
            type: ChannelType.GUILD_TEXT,
        }));
        t.mock.method(permissionsUtil, "getPermission", async () => ({
            hasThrow() {
                return true;
            },
        }));
        t.mock.method(util.ConversationSummary, "delete", async () => ({ affected: 0 }));

        const { deleteChannelConversationSummary } = require(routeModulePath) as typeof import("./summaries");

        await assert.rejects(
            () => deleteChannelConversationSummary("user-id", "123456789012345678", "223456789012345678"),
            (error) => (error as { code?: number; httpStatus?: number; message?: string }).code === 404 && (error as { httpStatus?: number }).httpStatus === 404,
        );
        assert.equal(emittedEvent, false);
    });

    test("declares response, event, and authenticated error metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "channels", "#channel_id", "summaries.ts"), "utf8");

        assert.match(routeSource, /body:\s*"ConversationSummariesResponse"/);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /event:\s*"CONVERSATION_SUMMARY_UPDATE"/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/);
    });
});
