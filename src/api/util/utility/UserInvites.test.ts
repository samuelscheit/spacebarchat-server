import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

const { DiscordApiErrors } = require("@spacebar/util") as typeof import("@spacebar/util");
const { acceptUserInvite, createUserInvite, revokeUserInvite } = require("./UserInvites") as typeof import("./UserInvites");

function publicUser(user_id: string) {
    return {
        id: user_id,
        username: user_id,
        discriminator: "0001",
        public_flags: 0,
        bio: "",
        bot: false,
        premium_since: new Date("2026-05-05T10:00:00.000Z"),
        premium_type: 0,
    };
}

describe("user invite creation", () => {
    test("creates a friend invite without guild or channel fields", async () => {
        const createdInvites: Record<string, unknown>[] = [];
        const savedAt = new Date("2026-05-05T10:00:00.000Z");

        const invite = await createUserInvite(
            "inviter_user",
            {},
            {
                generateCode: () => "friend1",
                now: () => savedAt,
                getPublicUser: async (user_id) => publicUser(user_id),
                inviteRepository: {
                    findOne: async () => undefined,
                    create: (data) => {
                        createdInvites.push(data);
                        return {
                            ...data,
                            save: async () => data,
                        };
                    },
                },
            },
        );

        assert.deepEqual(createdInvites, [
            {
                code: "friend1",
                temporary: false,
                uses: 0,
                max_uses: 5,
                max_age: 604800,
                created_at: savedAt,
                expires_at: new Date("2026-05-12T10:00:00.000Z"),
                inviter_id: "inviter_user",
                flags: 0,
            },
        ]);
        assert.equal(invite.type, 2);
        assert.equal("guild_id" in invite, false);
        assert.equal("channel_id" in invite, false);
        assert.deepEqual(invite.inviter, publicUser("inviter_user"));
    });

    test("rejects invalid custom invite codes before saving", async () => {
        for (const code of ["", "bad code", "bad-code", null]) {
            await assert.rejects(
                () =>
                    createUserInvite("inviter_user", { code } as never, {
                        getPublicUser: async (user_id) => publicUser(user_id),
                        inviteRepository: {
                            findOne: async () => undefined,
                            create: () => {
                                throw new Error("should not save invalid custom code");
                            },
                        },
                    }),
                DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE,
            );
        }
    });

    test("rejects duplicate custom invite codes before saving", async () => {
        await assert.rejects(
            () =>
                createUserInvite(
                    "inviter_user",
                    {
                        code: "taken",
                    },
                    {
                        getPublicUser: async (user_id) => publicUser(user_id),
                        inviteRepository: {
                            findOne: async () => ({ code: "taken" }),
                            create: () => {
                                throw new Error("should not save duplicate custom code");
                            },
                        },
                    },
                ),
            DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE,
        );
    });

    test("retries generated invite code collisions", async () => {
        const codes = ["taken", "fresh"];
        const savedCodes: string[] = [];

        await createUserInvite(
            "inviter_user",
            {},
            {
                generateCode: () => codes.shift()!,
                getPublicUser: async (user_id) => publicUser(user_id),
                inviteRepository: {
                    findOne: async ({ where }) => (where.code === "taken" ? { code: "taken" } : undefined),
                    create: (data) => ({
                        ...data,
                        save: async () => {
                            savedCodes.push(data.code!);
                            return data;
                        },
                    }),
                },
            },
        );

        assert.deepEqual(savedCodes, ["fresh"]);
    });

    test("accepts a user invite by creating a relationship and consuming a use", async () => {
        const relationships: unknown[] = [];
        let savedUses = 0;
        const invite = {
            code: "friend1",
            temporary: false,
            uses: 0,
            max_uses: 5,
            max_age: 604800,
            created_at: new Date("2026-05-05T10:00:00.000Z"),
            expires_at: new Date("2026-05-12T10:00:00.000Z"),
            inviter_id: "inviter_user",
            flags: 0,
            isExpired: () => false,
            save: async () => {
                savedUses = invite.uses;
                return invite;
            },
        };

        const response = await acceptUserInvite("recipient_user", invite as never, {
            getPublicUser: async (user_id) => publicUser(user_id),
            getRelationshipUser: async (user_id) => ({ id: user_id, relationships: [] }) as never,
            updateRelationship: async (user_id, friend, type, options) => {
                relationships.push({ user_id, friend_id: friend.id, type, options });
            },
        });

        assert.deepEqual(relationships, [{ user_id: "recipient_user", friend_id: "inviter_user", type: 1, options: { directFriendship: true } }]);
        assert.equal(savedUses, 1);
        assert.equal(response.uses, 1);
        assert.equal(response.type, 2);
    });

    test("rejects non-user invite rows before accepting them", async () => {
        const invites = [
            {
                code: "guild1",
                guild_id: "guild_id",
                inviter_id: "inviter_user",
                uses: 0,
                max_uses: 5,
                isExpired: () => false,
            },
            {
                code: "channel1",
                channel_id: "channel_id",
                inviter_id: "inviter_user",
                uses: 0,
                max_uses: 5,
                isExpired: () => false,
            },
            {
                code: "missing-inviter",
                inviter_id: undefined,
                uses: 0,
                max_uses: 5,
                isExpired: () => false,
            },
        ];

        for (const invite of invites) {
            await assert.rejects(
                () =>
                    acceptUserInvite("recipient_user", invite as never, {
                        getPublicUser: async (user_id) => publicUser(user_id),
                        getRelationshipUser: async () => {
                            throw new Error("should not resolve relationships for non-user invites");
                        },
                        updateRelationship: async () => {
                            throw new Error("should not create a relationship for non-user invites");
                        },
                    }),
                (error) => (error as { code?: number }).code === DiscordApiErrors.UNKNOWN_INVITE.code,
            );
        }
    });

    test("deletes a user invite after its last use", async () => {
        const deletedCodes: string[] = [];
        const invite = {
            code: "friend1",
            temporary: false,
            uses: 4,
            max_uses: 5,
            max_age: 604800,
            created_at: new Date("2026-05-05T10:00:00.000Z"),
            expires_at: new Date("2026-05-12T10:00:00.000Z"),
            inviter_id: "inviter_user",
            flags: 0,
            isExpired: () => false,
            save: async () => {
                throw new Error("should delete instead of saving last use");
            },
        };

        await acceptUserInvite("recipient_user", invite as never, {
            deleteInvite: async ({ code }) => deletedCodes.push(code),
            getPublicUser: async (user_id) => publicUser(user_id),
            getRelationshipUser: async (user_id) => ({ id: user_id, relationships: [] }) as never,
            updateRelationship: async () => undefined,
        });

        assert.deepEqual(deletedCodes, ["friend1"]);
    });

    test("rejects a user invite when the inviter is already at the friend cap", async () => {
        const invite = {
            code: "friend1",
            temporary: false,
            uses: 0,
            max_uses: 5,
            max_age: 604800,
            created_at: new Date("2026-05-05T10:00:00.000Z"),
            expires_at: new Date("2026-05-12T10:00:00.000Z"),
            inviter_id: "inviter_user",
            flags: 0,
            isExpired: () => false,
            save: async () => {
                throw new Error("should not consume invite when inviter is at the friend cap");
            },
        };

        await assert.rejects(
            () =>
                acceptUserInvite("recipient_user", invite as never, {
                    getMaxFriends: () => 1,
                    getPublicUser: async (user_id) => publicUser(user_id),
                    getRelationshipUser: async (user_id) =>
                        ({
                            id: user_id,
                            relationships: [{ to_id: "someone_else" }],
                        }) as never,
                    updateRelationship: async () => {
                        throw new Error("should not create a relationship when inviter is at the friend cap");
                    },
                }),
            (error) => (error as { code?: number }).code === DiscordApiErrors.MAXIMUM_FRIENDS.code,
        );
        assert.equal(invite.uses, 0);
    });

    test("revokes a user invite owned by the current user", async () => {
        const deletedCodes: string[] = [];
        const invite = {
            code: "friend1",
            guild_id: undefined,
            inviter_id: "inviter_user",
            uses: 0,
        };

        await revokeUserInvite("inviter_user", invite as never, {
            deleteInvite: async ({ code }) => deletedCodes.push(code),
        });

        assert.deepEqual(deletedCodes, ["friend1"]);
        assert.equal(invite.uses, 0);
    });

    test("rejects revoking another user's invite without deleting it", async () => {
        const deletedCodes: string[] = [];
        const invite = {
            code: "friend1",
            guild_id: undefined,
            inviter_id: "inviter_user",
            uses: 0,
        };

        await assert.rejects(
            () =>
                revokeUserInvite("other_user", invite as never, {
                    deleteInvite: async ({ code }) => deletedCodes.push(code),
                }),
            (error) => (error as { code?: number }).code === DiscordApiErrors.UNKNOWN_INVITE.code,
        );

        assert.deepEqual(deletedCodes, []);
        assert.equal(invite.uses, 0);
    });

    test("rejects revoking non-user invite rows through the user-invite path", async () => {
        const deletedCodes: string[] = [];
        const invites = [
            {
                code: "guild1",
                guild_id: "guild_id",
                inviter_id: "inviter_user",
                uses: 0,
            },
            {
                code: "channel1",
                channel_id: "channel_id",
                inviter_id: "inviter_user",
                uses: 0,
            },
            {
                code: "missing-inviter",
                inviter_id: undefined,
                uses: 0,
            },
        ];

        for (const invite of invites) {
            await assert.rejects(
                () =>
                    revokeUserInvite("inviter_user", invite as never, {
                        deleteInvite: async ({ code }) => deletedCodes.push(code),
                    }),
                (error) => (error as { code?: number }).code === DiscordApiErrors.UNKNOWN_INVITE.code,
            );
        }

        assert.deepEqual(deletedCodes, []);
        assert.deepEqual(
            invites.map((invite) => invite.uses),
            [0, 0, 0],
        );
    });
});
