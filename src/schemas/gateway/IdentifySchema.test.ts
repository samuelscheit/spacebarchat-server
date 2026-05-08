import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateSchema } from "../Validator";

describe("IdentifySchema", () => {
    test("validates gateway identify payloads through the generated schema", () => {
        const payload = {
            token: "auth-token",
            properties: {
                os: "linux",
                os_arch: "x64",
                browser: "Spacebar Test",
                device: "desktop",
                $browser: "Discord Client",
                $referrer: "",
                $referring_domain: "",
                window_manager: "kwin",
                distro: "arch",
            },
            intents: "513",
            shard: ["0", "1"],
            capabilities: 4093,
            client_state: {
                guild_hashes: {},
                highest_last_message_id: 0,
                read_state_version: 1,
                user_guild_settings_version: 2,
                private_channels_version: 3,
                guild_versions: {},
                api_code_version: 1,
                initial_guild_id: "123",
            },
            v: 10,
            version: 10,
        };

        assert.equal(validateSchema("IdentifySchema", payload), payload);
        assert.equal(typeof payload.intents, "bigint");
        assert.deepEqual(payload.shard, [0n, 1n]);
    });

    test("rejects unknown top-level identify keys", () => {
        assert.throws(
            () =>
                validateSchema("IdentifySchema", {
                    token: "auth-token",
                    properties: {},
                    unexpected: true,
                }),
            (error) =>
                Array.isArray(error) &&
                error.some((entry) => entry?.keyword === "additionalProperties" && entry?.message === "must NOT have additional properties"),
        );
    });
});
