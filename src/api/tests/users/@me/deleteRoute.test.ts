import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

function readSelfDeleteRouteSource() {
    return fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "delete.ts"), "utf8");
}

function readMemberEntitySource() {
    return fs.readFileSync(path.join(process.cwd(), "src", "util", "entities", "Member.ts"), "utf8");
}

describe("POST /users/@me/delete membership cleanup", () => {
    test("delegates guild removal to Member.removeFromGuild, which maintains guild member_count", () => {
        const routeSource = readSelfDeleteRouteSource();
        const memberSource = readMemberEntitySource();

        assert.ok(routeSource.includes("Member.removeFromGuild(member.id, member.guild_id)"));
        assert.doesNotMatch(routeSource, /TODO:\s*decrement guild member count/);
        assert.doesNotMatch(routeSource, /Member\.delete\(\{\s*id:\s*req\.user_id[\s\S]*?guild_id/);
        assert.match(memberSource, /static async removeFromGuild[\s\S]*Guild\.decrement\(\{ id: guild_id \}, "member_count", 1\)/);
    });

    test("deletes the user only after guild membership cleanup has completed", () => {
        const routeSource = readSelfDeleteRouteSource();
        const membershipCleanup = "await Promise.all(members.map((member) => Member.removeFromGuild(member.id, member.guild_id)));";
        const userDeletion = "await User.delete({ id: req.user_id });";

        assert.ok(routeSource.includes(membershipCleanup));
        assert.ok(routeSource.includes(userDeletion));
        assert.ok(routeSource.indexOf(membershipCleanup) < routeSource.indexOf(userDeletion));
        assert.doesNotMatch(routeSource, /Promise\.all\(\[[^\]]*User\.delete\(\{ id: req\.user_id \}\)[\s\S]*Member\.removeFromGuild/);
    });
});
