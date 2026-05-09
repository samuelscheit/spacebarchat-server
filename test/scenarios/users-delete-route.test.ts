import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { deleteSelfUserAccountRoute } from "../../src/api/routes/users/@me/delete";
import { deleteSelfUserAccount } from "../../src/api/util/handlers/SelfDeleteAccount";

const util = require("@spacebar/util");
const eventUtil = util;

type MemberRecord = {
    id: string;
    guild_id: string;
};

const originalMethods = {
    guildFindOne: util.Guild.findOne,
    guildFindOneOrFail: util.Guild.findOneOrFail,
    guildDecrement: util.Guild.decrement,
    memberFind: util.Member.find,
    memberFindOneOrFail: util.Member.findOneOrFail,
    memberDelete: util.Member.delete,
    memberRemoveFromGuild: util.Member.removeFromGuild,
    userDelete: util.User.delete,
    userFindOneOrFail: util.User.findOneOrFail,
    userSettingsProtosDelete: util.UserSettingsProtos.delete,
};

function restoreMethods() {
    util.Guild.findOne = originalMethods.guildFindOne;
    util.Guild.findOneOrFail = originalMethods.guildFindOneOrFail;
    util.Guild.decrement = originalMethods.guildDecrement;
    util.Member.find = originalMethods.memberFind;
    util.Member.findOneOrFail = originalMethods.memberFindOneOrFail;
    util.Member.delete = originalMethods.memberDelete;
    util.Member.removeFromGuild = originalMethods.memberRemoveFromGuild;
    util.User.delete = originalMethods.userDelete;
    util.User.findOneOrFail = originalMethods.userFindOneOrFail;
    util.UserSettingsProtos.delete = originalMethods.userSettingsProtosDelete;
}

afterEach(restoreMethods);

async function waitUntil(condition: () => boolean) {
    for (let attempt = 0; attempt < 20; attempt++) {
        if (condition()) return;
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
    }

    assert.fail("condition was not met before timeout");
}

function createRouteResponse() {
    const statuses: number[] = [];
    const response = {
        sendStatus(status: number) {
            statuses.push(status);
            return response;
        },
    } as Response;

    return { response, statuses };
}

function createRouteRequest(password: string) {
    return {
        body: { password },
        t: (key: string) => key,
        user_id: "user-id",
    } as unknown as Request;
}

function installSelfDeleteHarness(options: { ownedGuild?: unknown; members?: MemberRecord[]; deferMembershipCleanup?: boolean } = {}) {
    const operations: string[] = [];
    const membershipCleanupResolvers: Array<() => void> = [];
    const members = options.members ?? [];

    util.Guild.findOne = async (query: unknown) => {
        operations.push("guild.findOne");
        assert.deepEqual(query, { where: { owner_id: "user-id" } });
        return options.ownedGuild ?? null;
    };
    util.Guild.decrement = async () => assert.fail("self-delete cleanup must delegate guild member_count changes to Member.removeFromGuild");
    util.Member.find = async (query: unknown) => {
        operations.push("member.find");
        assert.deepEqual(query, { where: { id: "user-id" } });
        return members;
    };
    util.Member.delete = async () => assert.fail("self-delete cleanup must not delete memberships directly");
    util.Member.removeFromGuild = async (userId: string, guildId: string) => {
        operations.push(`member.remove:${guildId}`);
        assert.equal(userId, "user-id");
        if (options.deferMembershipCleanup) {
            await new Promise<void>((resolve) => {
                membershipCleanupResolvers.push(resolve);
            });
        }
        operations.push(`member.removed:${guildId}`);
        return [];
    };
    util.UserSettingsProtos.delete = async (criteria: unknown) => {
        operations.push("settings.delete");
        assert.deepEqual(criteria, { user_id: "user-id" });
        return { affected: 1, raw: [] };
    };
    util.User.delete = async (criteria: unknown) => {
        operations.push("user.delete");
        assert.deepEqual(criteria, { id: "user-id" });
        return { affected: 1, raw: [] };
    };

    return {
        membershipCleanupResolvers,
        operations,
    };
}

describe("POST /users/@me/delete membership cleanup", () => {
    test("route validates the password before running cleanup and returning 204", async () => {
        const password = "correct horse battery staple";
        const harness = installSelfDeleteHarness({ members: [{ id: "user-id", guild_id: "guild-a" }] });
        const { response, statuses } = createRouteResponse();

        util.User.findOneOrFail = async (query: unknown) => {
            harness.operations.push("user.findOneOrFail");
            assert.deepEqual(query, {
                where: { id: "user-id" },
                select: { data: true },
            });
            return { data: { hash: await bcrypt.hash(password, 4) } };
        };

        await deleteSelfUserAccountRoute(createRouteRequest(password), response);

        assert.deepEqual(statuses, [204]);
        assert.deepEqual(harness.operations, [
            "user.findOneOrFail",
            "guild.findOne",
            "member.find",
            "member.remove:guild-a",
            "member.removed:guild-a",
            "settings.delete",
            "user.delete",
        ]);
    });

    test("route rejects an invalid password before cleanup", async () => {
        const { response } = createRouteResponse();
        const harness = installSelfDeleteHarness({ members: [{ id: "user-id", guild_id: "guild-a" }] });

        util.User.findOneOrFail = async () => {
            harness.operations.push("user.findOneOrFail");
            return { data: { hash: await bcrypt.hash("actual password", 4) } };
        };

        await assert.rejects(async () => deleteSelfUserAccountRoute(createRouteRequest("wrong password"), response), /auth:login.INVALID_PASSWORD/);

        assert.deepEqual(harness.operations, ["user.findOneOrFail"]);
    });

    test("rejects self-delete while the user still owns a guild", async () => {
        const harness = installSelfDeleteHarness({ ownedGuild: { id: "owned-guild" } });

        await assert.rejects(() => deleteSelfUserAccount("user-id"), /User owns guilds and cannot be deleted/);

        assert.deepEqual(harness.operations, ["guild.findOne"]);
    });

    test("removes every guild membership through Member.removeFromGuild before deleting the user", async () => {
        const harness = installSelfDeleteHarness({
            deferMembershipCleanup: true,
            members: [
                { id: "user-id", guild_id: "guild-a" },
                { id: "user-id", guild_id: "guild-b" },
            ],
        });

        const deletion = deleteSelfUserAccount("user-id");
        await waitUntil(() => harness.membershipCleanupResolvers.length === 2);

        assert.deepEqual(harness.operations, ["guild.findOne", "member.find", "member.remove:guild-a", "member.remove:guild-b"]);
        assert.equal(harness.operations.includes("user.delete"), false);

        harness.membershipCleanupResolvers[0]();
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
        assert.equal(harness.operations.includes("user.delete"), false);

        harness.membershipCleanupResolvers[1]();
        await deletion;

        assert.deepEqual(harness.operations, [
            "guild.findOne",
            "member.find",
            "member.remove:guild-a",
            "member.remove:guild-b",
            "member.removed:guild-a",
            "member.removed:guild-b",
            "settings.delete",
            "user.delete",
        ]);
    });

    test("Member.removeFromGuild decrements guild member_count and emits removal events", async () => {
        const operations: string[] = [];
        const userEvents: unknown[] = [];
        const guildEvents: unknown[] = [];
        const publicUser = { id: "user-id", username: "deleted-user" };
        const originalEventTransmission = process.env.EVENT_TRANSMISSION;
        const originalEventSocketPath = process.env.EVENT_SOCKET_PATH;
        const collectUserEvent = (payload: unknown) => userEvents.push(payload);
        const collectGuildEvent = (payload: unknown) => guildEvents.push(payload);

        delete process.env.EVENT_TRANSMISSION;
        delete process.env.EVENT_SOCKET_PATH;
        eventUtil.events.on("user-id", collectUserEvent);
        eventUtil.events.on("guild-a", collectGuildEvent);

        util.Guild.findOneOrFail = async (query: unknown) => {
            operations.push("guild.findOneOrFail");
            assert.deepEqual(query, {
                select: { owner_id: true },
                where: { id: "guild-a" },
            });
            return { owner_id: "owner-id" };
        };
        util.Member.findOneOrFail = async (query: unknown) => {
            operations.push("member.findOneOrFail");
            assert.deepEqual(query, {
                where: { id: "user-id", guild_id: "guild-a" },
                relations: { user: true },
            });
            return {
                user: {
                    toPublicUser: () => publicUser,
                },
            };
        };
        util.Member.delete = async (criteria: unknown) => {
            operations.push("member.delete");
            assert.deepEqual(criteria, { id: "user-id", guild_id: "guild-a" });
            return { affected: 1, raw: [] };
        };
        util.Guild.decrement = async (criteria: unknown, property: string, value: number) => {
            operations.push("guild.decrement");
            assert.deepEqual(criteria, { id: "guild-a" });
            assert.equal(property, "member_count");
            assert.equal(value, 1);
            return { affected: 1, raw: [] };
        };

        try {
            await originalMethods.memberRemoveFromGuild("user-id", "guild-a");
        } finally {
            eventUtil.events.off("user-id", collectUserEvent);
            eventUtil.events.off("guild-a", collectGuildEvent);
            if (originalEventTransmission === undefined) delete process.env.EVENT_TRANSMISSION;
            else process.env.EVENT_TRANSMISSION = originalEventTransmission;
            if (originalEventSocketPath === undefined) delete process.env.EVENT_SOCKET_PATH;
            else process.env.EVENT_SOCKET_PATH = originalEventSocketPath;
        }

        assert.deepEqual(operations, ["guild.findOneOrFail", "member.findOneOrFail", "member.delete", "guild.decrement"]);
        assert.deepEqual(userEvents, [
            {
                event: "GUILD_DELETE",
                data: { id: "guild-a" },
                user_id: "user-id",
            },
        ]);
        assert.deepEqual(guildEvents, [
            {
                event: "GUILD_MEMBER_REMOVE",
                data: { guild_id: "guild-a", user: publicUser },
                guild_id: "guild-a",
            },
        ]);
    });

    test("deletes the account after settings cleanup when there are no guild memberships", async () => {
        const harness = installSelfDeleteHarness();

        await deleteSelfUserAccount("user-id");

        assert.deepEqual(harness.operations, ["guild.findOne", "member.find", "settings.delete", "user.delete"]);
    });
});
