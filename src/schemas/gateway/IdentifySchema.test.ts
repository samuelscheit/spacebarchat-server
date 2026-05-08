import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import { IdentifySchema } from "./IdentifySchema";

const baseIdentify = {
    token: "token",
};

describe("IdentifySchema", () => {
    test("allows snake_case identify fields", () => {
        assert.equal(
            instanceOf(IdentifySchema, {
                ...baseIdentify,
                large_threshold: 50,
                client_state: {
                    guild_hashes: {},
                    highest_last_message_id: 1,
                    read_state_version: 2,
                    user_guild_settings_version: 3,
                    user_settings_version: 4,
                    useruser_guild_settings_version: 5,
                    private_channels_version: 6,
                    guild_versions: {},
                    api_code_version: 7,
                    initial_guild_id: "8",
                },
            }),
            true,
        );
    });

    test("allows camelCase identify fields without duplicating the schema", () => {
        assert.equal(
            instanceOf(IdentifySchema, {
                ...baseIdentify,
                largeThreshold: 50,
                clientState: {
                    guildHashes: {},
                    highestLastMessageId: 1,
                    readStateVersion: 2,
                    userGuildSettingsVersion: 3,
                    userSettingsVersion: 4,
                    useruserGuildSettingsVersion: 5,
                    privateChannelsVersion: 6,
                    guildVersions: {},
                    apiCodeVersion: 7,
                    initialGuildId: "8",
                },
            }),
            true,
        );
    });

    test("rejects both spellings of the same identify field", () => {
        assert.throws(
            () =>
                instanceOf(IdentifySchema, {
                    ...baseIdentify,
                    large_threshold: 50,
                    largeThreshold: 50,
                }),
            /.large_threshold must only use one of large_threshold, largeThreshold/,
        );
    });

    test("rejects both spellings of the same client state field", () => {
        assert.throws(
            () =>
                instanceOf(IdentifySchema, {
                    ...baseIdentify,
                    clientState: {
                        private_channels_version: 6,
                        privateChannelsVersion: 6,
                    },
                }),
            /.clientState.private_channels_version must only use one of private_channels_version, privateChannelsVersion/,
        );
    });
});
