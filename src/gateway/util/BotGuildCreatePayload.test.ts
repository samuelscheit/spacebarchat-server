import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PublicMember } from "../../schemas/api/users/Member";
import type { PublicUser } from "../../schemas/api/users/User";
import type { PublicVoiceState } from "../../schemas/api/guilds/VoiceState";
import type { VoiceState } from "../../util/entities/VoiceState";
import type { Member } from "../../util/entities/Member";
import { Intents } from "../../util/util/Intents";
import { createBotGuildCreatePayload, createBotGuildCreatePayloads } from "./BotGuildCreatePayload";

const user = {
    toPublicUser: () => ({ id: "bot-user", username: "bot" }) as PublicUser,
};

const botMember = {
    guild_id: "guild-1",
    toPublicMember: () => ({ id: "bot-user", roles: ["guild-1"] }) as PublicMember,
} as Member;

const voiceState = {
    toPublicVoiceState: () => ({ guild_id: "guild-1", channel_id: "voice-1", user_id: "other-user" }) as PublicVoiceState,
} as VoiceState;

describe("createBotGuildCreatePayload", () => {
    test("does not create initial bot guild payloads without the GUILDS intent", () => {
        assert.deepEqual(createBotGuildCreatePayloads([{ id: "guild-1" }], [botMember], user, new Intents(0)), []);
    });

    test("always includes only the bot member even without the GUILD_MEMBERS intent", () => {
        const payload = createBotGuildCreatePayload(
            {
                id: "guild-1",
                members: [{ id: "other-user" } as PublicMember],
            },
            [botMember],
            user,
            new Intents(Intents.FLAGS.GUILDS),
        );

        assert.deepEqual(payload.members, [
            {
                id: "bot-user",
                roles: ["guild-1"],
                user: { id: "bot-user", username: "bot" },
            },
        ]);
    });

    test("filters voice states unless the GUILD_VOICE_STATES intent is present", () => {
        const guild = {
            id: "guild-1",
            voice_states: [voiceState],
        };

        assert.deepEqual(createBotGuildCreatePayload(guild, [botMember], user, new Intents(Intents.FLAGS.GUILDS)).voice_states, []);
        assert.deepEqual(createBotGuildCreatePayload(guild, [botMember], user, new Intents(Intents.FLAGS.GUILDS | Intents.FLAGS.GUILD_VOICE_STATES)).voice_states, [
            { guild_id: "guild-1", channel_id: "voice-1", user_id: "other-user" },
        ]);
    });

    test("filters presences unless the GUILD_PRESENCES intent is present", () => {
        const presence = {
            user: { id: "other-user", username: "other" },
            status: "online",
            activities: [],
            client_status: {},
        };
        const guild = {
            id: "guild-1",
            presences: [presence],
        };

        assert.deepEqual(createBotGuildCreatePayload(guild, [botMember], user, new Intents(Intents.FLAGS.GUILDS)).presences, []);
        assert.deepEqual(createBotGuildCreatePayload(guild, [botMember], user, new Intents(Intents.FLAGS.GUILDS | Intents.FLAGS.GUILD_PRESENCES)).presences, [presence]);
    });
});
