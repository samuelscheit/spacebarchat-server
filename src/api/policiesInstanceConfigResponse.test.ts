import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getPublicInstanceConfigResponse } from "./util/responses/InstanceConfig";

describe("GET /policies/instance/config response schema", () => {
    it("should return the public config shape for non-operators", () => {
        const config = createConfigSource();

        const response = getPublicInstanceConfigResponse(config);

        assert.deepEqual(response, {
            limits_user_maxGuilds: config.limits.user.maxGuilds,
            limits_user_maxBio: config.limits.user.maxBio,
            limits_guild_maxEmojis: config.limits.guild.maxEmojis,
            limits_guild_maxRoles: config.limits.guild.maxRoles,
            limits_message_maxCharacters: config.limits.message.maxCharacters,
            limits_message_maxAttachmentSize: config.limits.message.maxAttachmentSize,
            limits_message_maxEmbedDownloadSize: config.limits.message.maxEmbedDownloadSize,
            limits_channel_maxWebhooks: config.limits.channel.maxWebhooks,
            register_dateOfBirth_requiredc: config.register.dateOfBirth.required,
            register_password_required: config.register.password.required,
            register_disabled: config.register.disabled,
            register_requireInvite: config.register.requireInvite,
            register_allowNewRegistration: config.register.allowNewRegistration,
            register_allowMultipleAccounts: config.register.allowMultipleAccounts,
            guild_autoJoin_canLeave: config.guild.autoJoin.canLeave,
            guild_autoJoin_guilds_x: ["123", "456"],
            register_email_required: config.register.email.required,
            can_recover_account: true,
        });
        assert.equal("security" in response, false);
        assert.equal("external" in response, false);
        assert.equal("email" in response, false);
    });

    it("should emit an OpenAPI response reference that resolves to a generated schema", () => {
        const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "policies", "instance", "config.ts"), "utf-8");
        const openapi = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8"));
        const schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf-8"));

        const configPath = openapi.paths["/policies/instance/config/"] ?? openapi.paths["/policies/instance/config"];
        const responseSchema = configPath.get.responses["200"].content["application/json"].schema;

        assert.match(routeSource, /body:\s*"InstanceConfigResponse"/);
        assert.doesNotMatch(routeSource, /body:\s*"Object"/);
        assert.deepEqual(responseSchema, { $ref: "#/components/schemas/InstanceConfigResponse" });
        assert.ok(schemas.InstanceConfigResponse, "InstanceConfigResponse must be present in generated schemas");
    });
});

function createConfigSource() {
    return {
        limits: {
            user: {
                maxGuilds: 100,
                maxBio: 190,
            },
            guild: {
                maxEmojis: 50,
                maxRoles: 25,
            },
            message: {
                maxCharacters: 2000,
                maxAttachmentSize: 1024,
                maxEmbedDownloadSize: 2048,
            },
            channel: {
                maxWebhooks: 10,
            },
        },
        register: {
            dateOfBirth: {
                required: true,
            },
            password: {
                required: false,
            },
            disabled: false,
            requireInvite: true,
            allowNewRegistration: true,
            allowMultipleAccounts: false,
            email: {
                required: true,
            },
        },
        guild: {
            autoJoin: {
                canLeave: true,
                guilds: ["123", "456"],
            },
        },
        email: {
            provider: "smtp",
        },
        general: {
            frontPage: "https://spacebar.example",
        },
    };
}
