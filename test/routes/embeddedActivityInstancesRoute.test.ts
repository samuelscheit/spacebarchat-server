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
import { describe, test } from "node:test";
import { DiscordApiErrors, type Activity } from "@spacebar/util";
import {
    buildChannelActivityInstances,
    type EmbeddedActivityInstancesDependencies,
    getEmbeddedActivityInstancesResponse,
    toChannelActivityInstanceId,
} from "../../src/api/routes/activities/#application_id/instances/#channel_id";

function activity(application_id: string, partyId?: string): Activity {
    return {
        application_id,
        name: "Embedded Activity",
        type: 0,
        party: partyId ? { id: partyId } : undefined,
    };
}

function dependencies(overrides: Partial<EmbeddedActivityInstancesDependencies> = {}): EmbeddedActivityInstancesDependencies {
    return {
        findApplication: async () => ({ bot: { id: "bot-user-id" } }),
        findChannel: async () => ({ id: "channel-id", guild_id: "guild-id" }),
        getPermission: async () => ({ has: (permission) => permission === "VIEW_CHANNEL" }),
        findVoiceStates: async () => [],
        findSessions: async () => [],
        ...overrides,
    };
}

describe("GET /activities/{application_id}/instances/{channel_id}", () => {
    test("rejects non-bot users before application lookup", async () => {
        let applicationLookups = 0;

        await assert.rejects(
            () =>
                getEmbeddedActivityInstancesResponse(
                    {
                        applicationId: "application-id",
                        channelId: "channel-id",
                        userId: "user-id",
                        userIsBot: false,
                    },
                    dependencies({
                        findApplication: async () => {
                            applicationLookups++;
                            return { bot: { id: "bot-user-id" } };
                        },
                    }),
                ),
            (error) => error === DiscordApiErrors.BOT_ONLY_ENDPOINT,
        );
        assert.equal(applicationLookups, 0);
    });

    test("rejects bot tokens that do not belong to the requested application", async () => {
        await assert.rejects(
            () =>
                getEmbeddedActivityInstancesResponse(
                    {
                        applicationId: "application-id",
                        channelId: "channel-id",
                        userId: "different-bot-user-id",
                        userIsBot: true,
                    },
                    dependencies(),
                ),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });

    test("requires VIEW_CHANNEL before exposing inferred activity instances", async () => {
        await assert.rejects(
            () =>
                getEmbeddedActivityInstancesResponse(
                    {
                        applicationId: "application-id",
                        channelId: "channel-id",
                        userId: "bot-user-id",
                        userIsBot: true,
                    },
                    dependencies({
                        getPermission: async () => ({ has: () => false }),
                    }),
                ),
            (error) =>
                error instanceof Error &&
                "code" in error &&
                error.code === DiscordApiErrors.MISSING_PERMISSIONS.code &&
                error.message === DiscordApiErrors.MISSING_PERMISSIONS.withParams("VIEW_CHANNEL").message,
        );
    });

    test("treats missing permission subjects as permission denial", async () => {
        const entityNotFound = new Error("Member not found");
        entityNotFound.name = "EntityNotFoundError";

        await assert.rejects(
            () =>
                getEmbeddedActivityInstancesResponse(
                    {
                        applicationId: "application-id",
                        channelId: "channel-id",
                        userId: "bot-user-id",
                        userIsBot: true,
                    },
                    dependencies({
                        getPermission: async () => {
                            throw entityNotFound;
                        },
                    }),
                ),
            (error) =>
                error instanceof Error &&
                "code" in error &&
                error.code === DiscordApiErrors.MISSING_PERMISSIONS.code &&
                error.message === DiscordApiErrors.MISSING_PERMISSIONS.withParams("VIEW_CHANNEL").message,
        );
    });

    test("returns instances inferred from voice-state sessions with matching application parties", async () => {
        const response = await getEmbeddedActivityInstancesResponse(
            {
                applicationId: "application-id",
                channelId: "channel-id",
                userId: "bot-user-id",
                userIsBot: true,
            },
            dependencies({
                findVoiceStates: async () => [
                    { channel_id: "channel-id", guild_id: "guild-id", session_id: "session-b", user_id: "user-b" },
                    { channel_id: "channel-id", guild_id: "guild-id", session_id: "session-a", user_id: "user-a" },
                ],
                findSessions: async () => [
                    { session_id: "session-a", user_id: "user-a", activities: [activity("application-id", "party-id")] },
                    {
                        session_id: "session-b",
                        user_id: "user-b",
                        activities: [activity("other-application-id", "other-party-id"), activity("application-id", "party-id")],
                    },
                ],
            }),
        );

        assert.deepEqual(response, {
            instances: [
                {
                    application_id: "application-id",
                    instance_id: "i-party-id-gc-channel-id",
                    channel_id: "channel-id",
                    guild_id: "guild-id",
                    users: ["user-a", "user-b"],
                },
            ],
        });
    });

    test("does not fabricate instances when matching activities lack a party id", () => {
        const response = buildChannelActivityInstances({
            applicationId: "application-id",
            channelId: "channel-id",
            voiceStates: [{ channel_id: "channel-id", guild_id: "guild-id", session_id: "session-id", user_id: "user-id" }],
            sessions: [{ session_id: "session-id", user_id: "user-id", activities: [activity("application-id")] }],
        });

        assert.deepEqual(response, { instances: [] });
    });

    test("preserves already-composite party ids", () => {
        assert.equal(toChannelActivityInstanceId("i-existing-gc-channel-id", "guild-id", "channel-id"), "i-existing-gc-channel-id");
    });
});
