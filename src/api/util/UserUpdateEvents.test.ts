import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FindManyOptions } from "typeorm";
import type { Member as MemberEntity, User as UserEntity } from "@spacebar/util";

process.env.DATABASE ??= "postgres://localhost/spacebar";

type EmittedEvent = Parameters<typeof import("../../util/index.js").emitEvent>[0];

function createUser(): Omit<UserEntity, "data"> & Pick<UserEntity, "id" | "toPublicUser"> {
    const publicUser = {
        id: "user-id",
        username: "profile-user",
        discriminator: "0001",
        avatar: null,
        public_flags: 0,
        pronouns: "they/them",
    };

    return {
        id: "user-id",
        toPublicUser: () => publicUser,
    } as unknown as Omit<UserEntity, "data"> & Pick<UserEntity, "id" | "toPublicUser">;
}

function createMember(guildId: string, roleIds: string[]): MemberEntity {
    return {
        guild_id: guildId,
        joined_at: new Date("2026-01-01T00:00:00.000Z"),
        nick: `${guildId}-nick`,
        pending: false,
        premium_since: undefined,
        roles: roleIds.map((id) => ({ id })),
    } as MemberEntity;
}

describe("emitUserUpdateEvents", () => {
    test("emits a user update plus one guild member update per membership", async () => {
        const { emitUserUpdateEvents } = await import("./UserUpdateEvents.js");
        const emitted: EmittedEvent[] = [];
        const findCalls: FindManyOptions<MemberEntity>[] = [];

        const user = createUser();
        await emitUserUpdateEvents(user, {
            emit: async (event: EmittedEvent) => {
                emitted.push(event);
            },
            findMemberships: async (options: FindManyOptions<MemberEntity>) => {
                findCalls.push(options);
                return [createMember("guild-a", ["guild-a", "role-a"]), createMember("guild-b", ["role-b"])] as MemberEntity[];
            },
        });

        assert.equal(emitted.length, 3);
        assert.deepEqual(emitted[0], {
            event: "USER_UPDATE",
            user_id: "user-id",
            data: user,
        });
        assert.deepEqual(emitted.slice(1), [
            {
                event: "GUILD_MEMBER_UPDATE",
                guild_id: "guild-a",
                data: {
                    guild_id: "guild-a",
                    joined_at: new Date("2026-01-01T00:00:00.000Z"),
                    nick: "guild-a-nick",
                    pending: false,
                    premium_since: undefined,
                    roles: ["role-a"],
                    user: user.toPublicUser(),
                },
            },
            {
                event: "GUILD_MEMBER_UPDATE",
                guild_id: "guild-b",
                data: {
                    guild_id: "guild-b",
                    joined_at: new Date("2026-01-01T00:00:00.000Z"),
                    nick: "guild-b-nick",
                    pending: false,
                    premium_since: undefined,
                    roles: ["role-b"],
                    user: user.toPublicUser(),
                },
            },
        ]);
        assert.deepEqual(findCalls, [
            {
                where: { id: "user-id" },
                relations: { roles: true },
            },
        ]);
    });

    test("emits only USER_UPDATE when the user has no guild memberships", async () => {
        const { emitUserUpdateEvents } = await import("./UserUpdateEvents.js");
        const emitted: EmittedEvent[] = [];

        const user = createUser();
        await emitUserUpdateEvents(user, {
            emit: async (event: EmittedEvent) => {
                emitted.push(event);
            },
            findMemberships: async () => [] as MemberEntity[],
        });

        assert.deepEqual(emitted, [
            {
                event: "USER_UPDATE",
                user_id: "user-id",
                data: user,
            },
        ]);
    });
});
