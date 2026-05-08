import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildLazyMemberList, buildLazyMemberListOperations } from "./LazyMemberList";
import type { Member, Role, Session, User } from "@spacebar/util";

function role(id: string, position: number, hoist = true, guildId = "guild") {
    return { id, guild_id: guildId, hoist, position } as Role;
}

function session(status: Session["status"]) {
    return {
        session_id: `${status}-session`,
        status,
        activities: [],
        client_status: {},
    } as unknown as Session;
}

function member(id: string, username: string, roles: Role[], sessions: Session[]) {
    return {
        id,
        guild_id: "guild",
        roles,
        user: {
            id,
            username,
            sessions,
            settings: {},
            toPublicUser() {
                return { id, username };
            },
        } as User,
    } as Member;
}

function itemIds(items: ReturnType<typeof buildLazyMemberList>["items"]) {
    return items.map((item) => item.group?.id ?? item.member?.user.id);
}

function groupIds(groups: ReturnType<typeof buildLazyMemberList>["groups"]) {
    return groups.map((group) => group.id);
}

describe("lazy guild member list ordering", () => {
    test("serves online members before offline members even when offline users have higher roles", () => {
        const everyone = role("guild", 0, false);
        const admin = role("admin", 10);

        const result = buildLazyMemberList(
            [member("offline-admin", "Offline Admin", [everyone, admin], [session("offline")]), member("online-member", "Online Member", [everyone], [session("online")])],
            "guild",
            [0, 99],
        );

        assert.deepEqual(itemIds(result.items), ["online", "online-member", "offline", "offline-admin"]);
        assert.equal(result.online_count, 1);
    });

    test("applies ranges after online/offline ordering instead of before list serialization", () => {
        const everyone = role("guild", 0, false);
        const admin = role("admin", 10);

        const result = buildLazyMemberList(
            [member("offline-admin", "Offline Admin", [everyone, admin], [session("offline")]), member("online-member", "Online Member", [everyone], [session("online")])],
            "guild",
            [0, 0],
        );

        assert.deepEqual(itemIds(result.items), ["online"]);
        assert.equal(result.members.length, 0);
        assert.equal(result.online_count, 1);
    });

    test("keeps non-hoisted roles out of visible groups while preserving member roles", () => {
        const everyone = role("guild", 0, false);
        const staff = role("staff", 10);
        const color = role("color", 20, false);

        const result = buildLazyMemberList(
            [
                member("plain-user", "Plain User", [everyone], [session("online")]),
                member("color-user", "Color User", [everyone, color], [session("online")]),
                member("staff-user", "Staff User", [everyone, staff], [session("online")]),
            ],
            "guild",
            [0, 99],
        );

        assert.deepEqual(groupIds(result.groups), ["staff", "online"]);
        assert.deepEqual(itemIds(result.items), ["staff", "staff-user", "online", "color-user", "plain-user"]);
        assert.deepEqual(result.members.find((x) => x.user.id === "color-user")?.roles, ["color"]);
    });

    test("uses the highest hoisted role as display group when a higher role is not hoisted", () => {
        const everyone = role("guild", 0, false);
        const staff = role("staff", 10);
        const color = role("color", 20, false);

        const result = buildLazyMemberList(
            [member("hybrid-user", "Hybrid User", [everyone, staff, color], [session("online")]), member("plain-user", "Plain User", [everyone], [session("online")])],
            "guild",
            [0, 99],
        );

        assert.deepEqual(groupIds(result.groups), ["staff", "online"]);
        assert.deepEqual(itemIds(result.items), ["staff", "hybrid-user", "online", "plain-user"]);
        assert.deepEqual(result.members.find((x) => x.user.id === "hybrid-user")?.roles, ["staff", "color"]);
    });

    test("places online members in the online group even when the everyone role relation is missing", () => {
        const result = buildLazyMemberList([member("online-member", "Online Member", [], [session("online")])], "guild", [0, 99]);

        assert.deepEqual(groupIds(result.groups), ["online"]);
        assert.deepEqual(itemIds(result.items), ["online", "online-member"]);
        assert.equal(result.online_count, 1);
    });

    test("places online members in the online group when role relations are not loaded", () => {
        const missingRolesMember = member("online-member", "Online Member", [], [session("online")]);
        missingRolesMember.roles = undefined as unknown as Role[];

        const result = buildLazyMemberList([missingRolesMember], "guild", [0, 99]);

        assert.deepEqual(groupIds(result.groups), ["online"]);
        assert.deepEqual(itemIds(result.items), ["online", "online-member"]);
        assert.equal(result.online_count, 1);
    });

    test("keeps online count and groups when no ranges are requested", () => {
        const everyone = role("guild", 0, false);

        const result = buildLazyMemberListOperations(
            [member("offline-member", "Offline Member", [everyone], [session("offline")]), member("online-member", "Online Member", [everyone], [session("online")])],
            "guild",
            [],
        );

        assert.deepEqual(result.ops, []);
        assert.deepEqual(groupIds(result.groups), ["online", "offline"]);
        assert.equal(result.online_count, 1);
    });

    test("slices multiple requested ranges from the same final member list", () => {
        const everyone = role("guild", 0, false);
        const admin = role("admin", 10);

        const result = buildLazyMemberListOperations(
            [member("offline-admin", "Offline Admin", [everyone, admin], [session("offline")]), member("online-member", "Online Member", [everyone], [session("online")])],
            "guild",
            [
                [0, 0],
                [1, 2],
            ],
        );

        assert.deepEqual(
            result.ops.map((op) => itemIds(op.items)),
            [["online"], ["online-member", "offline"]],
        );
        assert.equal(result.online_count, 1);
        assert.deepEqual(groupIds(result.groups), ["online", "offline"]);
    });
});
