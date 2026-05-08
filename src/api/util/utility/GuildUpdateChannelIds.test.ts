process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ensureGuildUpdateChannelIdsExistInGuild } from "./GuildUpdateChannelIds";
import { FieldError } from "../../../util/util/FieldError";

type FindOneOrFailOptions = {
    where: {
        guild_id: string;
        id: string;
    };
    select?: {
        id?: boolean;
    };
};

function createChannelFinder(existingChannels: Record<string, Set<string>>, calls: FindOneOrFailOptions[] = []) {
    const findOneOrFail = async (options: FindOneOrFailOptions) => {
        calls.push(options);
        const ids = existingChannels[options.where.guild_id] ?? new Set<string>();
        if (!ids.has(options.where.id)) {
            const error = new Error("not found");
            error.name = "EntityNotFoundError";
            throw error;
        }
        return { id: options.where.id };
    };

    return { calls, findOneOrFail };
}

describe("ensureGuildUpdateChannelIdsExistInGuild", () => {
    test("accepts guild update channel IDs that exist in the target guild", async () => {
        const finder = createChannelFinder({ guild: new Set(["afk", "system", "rules", "updates"]) });

        await ensureGuildUpdateChannelIdsExistInGuild(
            {
                afk_channel_id: "afk",
                system_channel_id: "system",
                rules_channel_id: "rules",
                public_updates_channel_id: "updates",
            },
            "guild",
            finder.findOneOrFail,
        );

        assert.deepEqual(
            finder.calls.map((call) => call.where),
            [
                { guild_id: "guild", id: "afk" },
                { guild_id: "guild", id: "system" },
                { guild_id: "guild", id: "rules" },
                { guild_id: "guild", id: "updates" },
            ],
        );
        assert.deepEqual(
            finder.calls.map((call) => call.select),
            [{ id: true }, { id: true }, { id: true }, { id: true }],
        );
    });

    test("rejects missing or cross-guild channel IDs as invalid form fields", async () => {
        const finder = createChannelFinder({ guild: new Set(["afk"]) });

        await assert.rejects(
            ensureGuildUpdateChannelIdsExistInGuild(
                {
                    afk_channel_id: "afk",
                    system_channel_id: "other-guild-channel",
                    rules_channel_id: "missing-rules",
                },
                "guild",
                finder.findOneOrFail,
            ),
            (error: unknown) => {
                assert(error instanceof FieldError);
                assert.equal(error.code, 50035);
                assert.equal(error.message, "Invalid Form Body");
                assert.deepEqual(error.errors, {
                    system_channel_id: {
                        _errors: [{ code: "CHANNEL_NOT_FOUND", message: "Channel does not exist in this guild" }],
                    },
                    rules_channel_id: {
                        _errors: [{ code: "CHANNEL_NOT_FOUND", message: "Channel does not exist in this guild" }],
                    },
                });
                return true;
            },
        );
    });

    test("does not look up omitted or null channel references", async () => {
        const finder = createChannelFinder({});

        await ensureGuildUpdateChannelIdsExistInGuild(
            {
                afk_channel_id: null,
                system_channel_id: null,
                rules_channel_id: null,
            },
            "guild",
            finder.findOneOrFail,
        );

        assert.deepEqual(finder.calls, []);
    });

    test("keeps the rules and public updates create-channel sentinel but validates other fields normally", async () => {
        const finder = createChannelFinder({ guild: new Set(["system"]) });

        await ensureGuildUpdateChannelIdsExistInGuild(
            {
                public_updates_channel_id: "1",
                rules_channel_id: "1",
                system_channel_id: "system",
            },
            "guild",
            finder.findOneOrFail,
        );

        assert.deepEqual(
            finder.calls.map((call) => call.where),
            [{ guild_id: "guild", id: "system" }],
        );
    });

    test("does not treat the create-channel sentinel as valid for afk or system channels", async () => {
        const finder = createChannelFinder({ guild: new Set() });

        await assert.rejects(
            ensureGuildUpdateChannelIdsExistInGuild(
                {
                    afk_channel_id: "1",
                    system_channel_id: "1",
                },
                "guild",
                finder.findOneOrFail,
            ),
            (error: unknown) => {
                assert(error instanceof FieldError);
                assert.deepEqual(error.errors, {
                    afk_channel_id: {
                        _errors: [{ code: "CHANNEL_NOT_FOUND", message: "Channel does not exist in this guild" }],
                    },
                    system_channel_id: {
                        _errors: [{ code: "CHANNEL_NOT_FOUND", message: "Channel does not exist in this guild" }],
                    },
                });
                return true;
            },
        );
    });

    test("does not mask unexpected channel lookup failures as validation errors", async () => {
        const databaseError = new Error("database unavailable");

        await assert.rejects(
            ensureGuildUpdateChannelIdsExistInGuild({ afk_channel_id: "afk" }, "guild", async () => {
                throw databaseError;
            }),
            (error: unknown) => {
                assert.equal(error, databaseError);
                return true;
            },
        );
    });
});
