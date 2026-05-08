import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const allowedGenericGuildChannelTypes = [
    0, // GUILD_TEXT
    2, // GUILD_VOICE
    4, // GUILD_CATEGORY
    5, // GUILD_NEWS
    13, // GUILD_STAGE_VOICE
    15, // GUILD_FORUM
    16, // GUILD_MEDIA
    255, // UNHANDLED
];

const dedicatedOrUnsupportedChannelTypes = [
    1, // DM
    3, // GROUP_DM
    6, // GUILD_STORE
    7, // GUILD_LFG
    8, // LFG_GROUP_DM
    9, // THREAD_ALPHA
    10, // GUILD_NEWS_THREAD
    11, // GUILD_PUBLIC_THREAD
    12, // GUILD_PRIVATE_THREAD
    14, // GUILD_DIRECTORY
    17, // LOBBY
    18, // EPHEMERAL_DM
];

test("ChannelCreateSchema only accepts channel types supported by the generic guild channel route", async () => {
    const schemas = JSON.parse(await readFile(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as {
        ChannelCreateSchema: { properties: { type: { enum: number[] } } };
    };

    const enumValues = schemas.ChannelCreateSchema.properties.type.enum;
    assert.deepEqual(
        [...enumValues].sort((a, b) => a - b),
        allowedGenericGuildChannelTypes,
    );

    for (const type of dedicatedOrUnsupportedChannelTypes) {
        assert.equal(enumValues.includes(type), false, `ChannelCreateSchema should reject channel type ${type}`);
    }
});
