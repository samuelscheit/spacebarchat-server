import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildGuildSyncResult } from "./GuildSync";
import type { Member, Role, Session, User } from "@spacebar/util";

function role(id: string, position: number, guildId = "guild") {
    return { id, guild_id: guildId, position } as Role;
}

function session(userId: string, status: Session["status"]) {
    return {
        user_id: userId,
        session_id: `${userId}-${status}`,
        status,
        activities: [],
        client_status: {},
        getPublicStatus() {
            return status === "invisible" ? "offline" : status;
        },
    } as unknown as Session;
}

function member(id: string, username: string, roles: Role[]) {
    return {
        id,
        guild_id: "guild",
        roles,
        user: {
            id,
            username,
            toPublicUser() {
                return { id, username };
            },
        } as User,
        toPublicMember() {
            return { user: { id, username }, roles: roles.filter((role) => role.id !== "guild").map((role) => role.id) };
        },
    } as Member;
}

function memberIds(result: ReturnType<typeof buildGuildSyncResult>) {
    return result.members.map((publicMember) => publicMember.user?.id);
}

describe("buildGuildSyncResult", () => {
    test("keeps all members by default while sorting by highest role", () => {
        const everyone = role("guild", 0);
        const admin = role("admin", 10);
        const moderator = role("moderator", 5);
        const members = [member("plain", "Plain", [everyone]), member("admin", "Admin", [everyone, admin]), member("mod", "Moderator", [everyone, moderator])];

        const result = buildGuildSyncResult("guild", members, [session("plain", "online"), session("admin", "offline"), session("mod", "idle")]);

        assert.deepEqual(memberIds(result), ["admin", "mod", "plain"]);
        assert.deepEqual(
            result.presences.map((presence) => presence.user.id),
            ["mod", "plain"],
        );
    });

    test("can limit members to users with public online sessions", () => {
        const everyone = role("guild", 0);
        const admin = role("admin", 10);
        const members = [member("offline-admin", "Offline Admin", [everyone, admin]), member("online-user", "Online User", [everyone])];

        const result = buildGuildSyncResult("guild", members, [session("offline-admin", "invisible"), session("online-user", "online")], "online");

        assert.deepEqual(memberIds(result), ["online-user"]);
        assert.deepEqual(
            result.presences.map((presence) => [presence.user.id, presence.status]),
            [["online-user", "online"]],
        );
    });
});
