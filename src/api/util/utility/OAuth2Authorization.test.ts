import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DiscordApiErrors, Permissions } from "../../../util";
import type { AssertMfaCodeOptions } from "./Totp";
import { requireOAuth2BotAuthorization } from "./OAuth2Authorization";

function permissionWithCache({ bot = false, mfaLevel = 0, permissions = ["VIEW_CHANNEL", "MANAGE_GUILD"] }: { bot?: boolean; mfaLevel?: number; permissions?: string[] } = {}) {
    const permission = new Permissions([...permissions]);
    permission.cache = {
        guild: { mfa_level: mfaLevel } as never,
        member: { user: { bot } } as never,
    };

    return permission;
}

function permissionWithoutCache() {
    return new Permissions(["VIEW_CHANNEL", "MANAGE_GUILD"]);
}

function guildRepository(mfaLevel: number) {
    return {
        findOneOrFail: test.mock.fn(async (_options: unknown) => ({ id: "guild", mfa_level: mfaLevel })),
    };
}

describe("OAuth2 bot authorization", () => {
    test("allows MANAGE_GUILD users when the guild does not require MFA", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache());
        const guildRepo = guildRepository(0);
        const userRepository = {
            findOneOrFail: t.mock.fn(async (_options: unknown) => ({ id: "user", mfa_enabled: false })),
        };

        await requireOAuth2BotAuthorization({ getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: undefined, userId: "user", userRepository });

        assert.deepEqual(getPermission.mock.calls[0].arguments, ["user", "guild", undefined, { guild_select: ["mfa_level"], member_relations: ["user"] }]);
        assert.deepEqual(guildRepo.findOneOrFail.mock.calls[0].arguments[0], {
            where: { id: "guild" },
            select: { id: true, mfa_level: true },
        });
        assert.equal(userRepository.findOneOrFail.mock.calls.length, 0);
    });

    test("rejects bot callers before authorizing OAuth2 bot joins", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ bot: true }));

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", mfaCode: undefined, userId: "bot" }),
            (error) => error === DiscordApiErrors.UNAUTHORIZED,
        );
    });

    test("rejects callers without MANAGE_GUILD", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ permissions: ["VIEW_CHANNEL"] }));

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", mfaCode: undefined, userId: "user" }),
            (error: unknown) => error instanceof Error && error.message.includes("MANAGE_GUILD"),
        );
    });

    test("requires account MFA when the target guild requires MFA", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ mfaLevel: 1 }));
        const guildRepo = guildRepository(1);
        const userRepository = { findOneOrFail: t.mock.fn(async (_options: unknown) => ({ id: "user", mfa_enabled: false })) };

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: "123456", userId: "user", userRepository }),
            (error) => error === DiscordApiErrors.TWO_FACTOR_REQUIRED,
        );
        assert.deepEqual(userRepository.findOneOrFail.mock.calls[0].arguments[0], {
            where: { id: "user" },
            select: { id: true, mfa_enabled: true, totp_secret: true },
        });
    });

    test("validates the submitted MFA code when the target guild requires MFA", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ mfaLevel: 1 }));
        const guildRepo = guildRepository(1);
        const userRepository = {
            findOneOrFail: t.mock.fn(async (_options: unknown) => ({ id: "user", mfa_enabled: true, totp_secret: "secret" })),
        };
        const assertMfaCodeFn = t.mock.fn(async (_options: AssertMfaCodeOptions) => undefined);

        await requireOAuth2BotAuthorization({ assertMfaCodeFn, getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: "123456", userId: "user", userRepository });

        assert.equal(assertMfaCodeFn.mock.calls.length, 1);
        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].code, "123456");
        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].mfa_enabled, true);
        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].totp_secret, "secret");
    });

    test("requires MFA for guild owners even when permission cache is absent", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithoutCache());
        const guildRepo = guildRepository(1);
        const userRepository = {
            findOneOrFail: t.mock.fn(async (_options: unknown) => ({ id: "owner", mfa_enabled: true, totp_secret: "secret" })),
        };
        const assertMfaCodeFn = t.mock.fn(async (_options: AssertMfaCodeOptions) => undefined);

        await requireOAuth2BotAuthorization({ assertMfaCodeFn, getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: "654321", userId: "owner", userRepository });

        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].code, "654321");
    });
});
