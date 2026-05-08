import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FindOneOptions } from "typeorm";
import type { Member as MemberEntity } from "@spacebar/util";

describe("getProfileGuildMember", () => {
    test("requires the requester to share the requested guild before target member lookup", async () => {
        process.env.DATABASE ??= "postgres://localhost/spacebar";

        const [{ Member }, { getProfileGuildMember }] = await Promise.all([import("../../util/index.js"), import("../util/profileGuildMember.js")]);
        const originalIsInGuildOrFail = Member.IsInGuildOrFail;
        const originalFindOneOrFail = Member.findOneOrFail;
        const membershipChecks: string[][] = [];
        let findCalled = false;

        Member.IsInGuildOrFail = async (requesterId: string, guildId: string) => {
            membershipChecks.push([requesterId, guildId]);
            throw new Error("not shared");
        };
        Member.findOneOrFail = (async () => {
            findCalled = true;
            throw new Error("target lookup should not run");
        }) as typeof Member.findOneOrFail;

        try {
            await assert.rejects(() => getProfileGuildMember("viewer-id", "target-id", "guild-id"), { message: "not shared" });
            assert.deepEqual(membershipChecks, [["viewer-id", "guild-id"]]);
            assert.equal(findCalled, false);
        } finally {
            Member.IsInGuildOrFail = originalIsInGuildOrFail;
            Member.findOneOrFail = originalFindOneOrFail;
        }
    });

    test("loads the target guild member only after requester membership is verified", async () => {
        process.env.DATABASE ??= "postgres://localhost/spacebar";

        const [{ Member }, { getProfileGuildMember }] = await Promise.all([import("../../util/index.js"), import("../util/profileGuildMember.js")]);
        const originalIsInGuildOrFail = Member.IsInGuildOrFail;
        const originalFindOneOrFail = Member.findOneOrFail;
        const guildMember = {
            roles: [{ id: "guild-id" }, { id: "role-id" }],
        } as unknown as MemberEntity;
        let findOptions: FindOneOptions<MemberEntity> | undefined;

        Member.IsInGuildOrFail = async () => undefined;
        Member.findOneOrFail = (async (options: FindOneOptions<MemberEntity>) => {
            findOptions = options;
            return guildMember;
        }) as typeof Member.findOneOrFail;

        try {
            const result = await getProfileGuildMember("viewer-id", "target-id", "guild-id");

            assert.equal(result, guildMember);
            assert.deepEqual(findOptions, {
                where: { id: "target-id", guild_id: "guild-id" },
                relations: { roles: true },
            });
            assert.deepEqual(
                guildMember.roles.map((role) => role.id),
                ["role-id"],
            );
        } finally {
            Member.IsInGuildOrFail = originalIsInGuildOrFail;
            Member.findOneOrFail = originalFindOneOrFail;
        }
    });
});
