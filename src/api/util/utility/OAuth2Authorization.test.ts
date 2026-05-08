import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DiscordApiErrors, Permissions } from "../../../util";
import type { AssertMfaCodeOptions } from "./Totp";
import { requireOAuth2BotAuthorization } from "./OAuth2Authorization";

function hasDiscordErrorCode(error: unknown, code: number) {
    return error instanceof Error && (error as { code?: number }).code === code;
}

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

function userRepository({ bot = false, mfaEnabled = false, totpSecret = null }: { bot?: boolean; mfaEnabled?: boolean; totpSecret?: string | null } = {}) {
    return {
        findOneOrFail: test.mock.fn(async (_options: unknown) => ({ id: bot ? "bot" : "user", bot, mfa_enabled: mfaEnabled, totp_secret: totpSecret })),
    };
}

const expectedUserLookup = {
    where: { id: "user" },
    select: { id: true, bot: true, mfa_enabled: true, totp_secret: true },
};

describe("OAuth2 bot authorization", () => {
    test("allows MANAGE_GUILD users when the guild does not require MFA", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache());
        const guildRepo = guildRepository(0);
        const users = userRepository();

        await requireOAuth2BotAuthorization({ getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: undefined, userId: "user", userRepository: users });

        assert.deepEqual(users.findOneOrFail.mock.calls[0].arguments[0], expectedUserLookup);
        assert.deepEqual(getPermission.mock.calls[0].arguments, ["user", "guild", undefined]);
        assert.deepEqual(guildRepo.findOneOrFail.mock.calls[0].arguments[0], {
            where: { id: "guild" },
            select: { id: true, mfa_level: true },
        });
    });

    test("rejects bot callers before authorizing OAuth2 bot joins", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ bot: true }));
        const users = userRepository({ bot: true });
        const guildRepo = guildRepository(0);

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: undefined, userId: "user", userRepository: users }),
            (error) => hasDiscordErrorCode(error, DiscordApiErrors.UNAUTHORIZED.code),
        );
        assert.equal(getPermission.mock.calls.length, 0);
        assert.equal(guildRepo.findOneOrFail.mock.calls.length, 0);
    });

    test("rejects bot guild owners when the permission cache is absent", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithoutCache());
        const users = userRepository({ bot: true });

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", mfaCode: undefined, userId: "user", userRepository: users }),
            (error) => hasDiscordErrorCode(error, DiscordApiErrors.UNAUTHORIZED.code),
        );
        assert.equal(getPermission.mock.calls.length, 0);
    });

    test("rejects callers without MANAGE_GUILD", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ permissions: ["VIEW_CHANNEL"] }));

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", mfaCode: undefined, userId: "user", userRepository: userRepository() }),
            (error: unknown) => error instanceof Error && error.message.includes("MANAGE_GUILD"),
        );
    });

    test("requires account MFA when the target guild requires MFA", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ mfaLevel: 1 }));
        const guildRepo = guildRepository(1);
        const users = userRepository({ mfaEnabled: false });

        await assert.rejects(
            () => requireOAuth2BotAuthorization({ getPermission, guildId: "guild", guildRepository: guildRepo, mfaCode: "123456", userId: "user", userRepository: users }),
            (error) => hasDiscordErrorCode(error, DiscordApiErrors.TWO_FACTOR_REQUIRED.code),
        );
        assert.deepEqual(users.findOneOrFail.mock.calls[0].arguments[0], expectedUserLookup);
    });

    test("validates the submitted MFA code when the target guild requires MFA", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ mfaLevel: 1 }));
        const guildRepo = guildRepository(1);
        const users = userRepository({ mfaEnabled: true, totpSecret: "secret" });
        const assertMfaCodeFn = t.mock.fn(async (_options: AssertMfaCodeOptions) => undefined);

        await requireOAuth2BotAuthorization({
            assertMfaCodeFn,
            getPermission,
            guildId: "guild",
            guildRepository: guildRepo,
            mfaCode: "123456",
            userId: "user",
            userRepository: users,
        });

        assert.equal(assertMfaCodeFn.mock.calls.length, 1);
        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].code, "123456");
        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].mfa_enabled, true);
        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].totp_secret, "secret");
    });

    test("passes backup-code length values to MFA validation", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithCache({ mfaLevel: 1 }));
        const guildRepo = guildRepository(1);
        const users = userRepository({ mfaEnabled: true, totpSecret: "secret" });
        const assertMfaCodeFn = t.mock.fn(async (_options: AssertMfaCodeOptions) => undefined);

        await requireOAuth2BotAuthorization({
            assertMfaCodeFn,
            getPermission,
            guildId: "guild",
            guildRepository: guildRepo,
            mfaCode: "deadbeef",
            userId: "user",
            userRepository: users,
        });

        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].code, "deadbeef");
    });

    test("requires MFA for guild owners even when permission cache is absent", async (t) => {
        const getPermission = t.mock.fn(async () => permissionWithoutCache());
        const guildRepo = guildRepository(1);
        const users = userRepository({ mfaEnabled: true, totpSecret: "secret" });
        const assertMfaCodeFn = t.mock.fn(async (_options: AssertMfaCodeOptions) => undefined);

        await requireOAuth2BotAuthorization({
            assertMfaCodeFn,
            getPermission,
            guildId: "guild",
            guildRepository: guildRepo,
            mfaCode: "654321",
            userId: "user",
            userRepository: users,
        });

        assert.equal(assertMfaCodeFn.mock.calls[0].arguments[0].code, "654321");
    });
});
