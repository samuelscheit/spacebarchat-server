import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

const { DiscordApiErrors } = require("@spacebar/util") as typeof import("@spacebar/util");
const { createUserInvite } = require("./UserInvites") as typeof import("./UserInvites");

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
                getPublicUser: async (user_id) => ({ id: user_id }),
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
                max_uses: 0,
                max_age: 0,
                created_at: savedAt,
                inviter_id: "inviter_user",
                flags: 0,
            },
        ]);
        assert.equal(invite.guild_id, undefined);
        assert.equal(invite.channel_id, undefined);
        assert.deepEqual(invite.inviter, { id: "inviter_user" });
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
                        getPublicUser: async (user_id) => ({ id: user_id }),
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
                getPublicUser: async (user_id) => ({ id: user_id }),
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
});
