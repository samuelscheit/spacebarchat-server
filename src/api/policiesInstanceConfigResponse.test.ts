import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import type { ConfigValue } from "../util/config/Config";
import { getInstanceConfigResponse, getPublicInstanceConfigResponse } from "./util/responses/InstanceConfig";

type AuthenticationMiddleware = (req: Request, res: Response, next: (error?: unknown) => void) => Promise<unknown> | unknown;

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

    it("should preserve the full config response for operators", () => {
        const config = createFullConfigSource();

        const operatorResponse = getInstanceConfigResponse(config, true);
        const publicResponse = getInstanceConfigResponse(config, false);

        assert.equal(operatorResponse, config);
        assert.ok("security" in operatorResponse, "operators should receive security settings");
        assert.ok("external" in operatorResponse, "operators should receive external provider settings");
        assert.ok("email" in operatorResponse, "operators should receive email settings");
        assert.deepEqual(publicResponse, getPublicInstanceConfigResponse(config));
        assert.equal("security" in publicResponse, false);
        assert.equal("external" in publicResponse, false);
        assert.equal("email" in publicResponse, false);
    });

    it("should treat public policy routes as optional-auth routes", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar_test";

        const { Authentication, isNoAuthorizationRoute } = await import("./middlewares/Authentication.js");

        assert.equal(isNoAuthorizationRoute("GET", "/policies/instance/config/"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/policies/instance/config/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me"), false);

        const authenticationError = await runAuthentication(Authentication, {
            method: "GET",
            url: "/policies/instance/config/",
            headers: {
                authorization: "not-a-valid-token",
            },
        });

        assert.equal(authenticationError, undefined);
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
        assert.ok(schemas.PublicInstanceConfigResponse, "public response variant must be present in generated schemas");
        assert.ok(schemas.FullInstanceConfigResponse, "full config response variant must be present in generated schemas");
        assert.match(JSON.stringify(schemas.InstanceConfigResponse), /PublicInstanceConfigResponse/);
        assert.match(JSON.stringify(schemas.InstanceConfigResponse), /FullInstanceConfigResponse|ConfigValue/);
    });
});

async function runAuthentication(authentication: AuthenticationMiddleware, req: Partial<Request>) {
    const originalConsoleError = console.error;
    let error: unknown;

    console.error = () => undefined;

    try {
        await new Promise<void>((resolve) => {
            void authentication(
                req as Request,
                {
                    setHeader: () => undefined,
                } as unknown as Response,
                (nextError?: unknown) => {
                    error = nextError;
                    resolve();
                },
            );
        });
    } finally {
        console.error = originalConsoleError;
    }

    return error;
}

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

function createFullConfigSource() {
    const publicConfig = createConfigSource();

    return {
        ...publicConfig,
        security: {
            jwtSecret: "operator-secret",
        },
        external: {
            twitter: "operator-twitter-token",
        },
    } as unknown as ConfigValue;
}
