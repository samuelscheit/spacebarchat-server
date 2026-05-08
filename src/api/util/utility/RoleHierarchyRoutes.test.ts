import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function getRoleRouteSource() {
    return readFileSync(join(process.cwd(), "src/api/routes/guilds/#guild_id/roles/#role_id/index.ts"), "utf8");
}

function indexOf(source: string, fragment: string) {
    const index = source.indexOf(fragment);
    assert.notEqual(index, -1, `Expected source to contain: ${fragment}`);
    return index;
}

function assertBefore(source: string, first: string, second: string) {
    assert.ok(indexOf(source, first) < indexOf(source, second), `Expected ${first} to appear before ${second}`);
}

function assertFragmentOrder(source: string, fragments: string[]) {
    let previousIndex = -1;
    for (const fragment of fragments) {
        const index = source.indexOf(fragment, previousIndex + 1);
        assert.notEqual(index, -1, `Expected source to contain after index ${previousIndex}: ${fragment}`);
        previousIndex = index;
    }
}

describe("single role route hierarchy guards", () => {
    test("checks hierarchy before deleting or updating a role", () => {
        const source = getRoleRouteSource();

        assert.match(source, /function assertCanManageTargetRole/);
        assert.equal(source.match(/await assertCanManageTargetRole\(req\.user_id, guild_id, role\);/g)?.length, 2);
        assertBefore(source, "await assertCanManageTargetRole(req.user_id, guild_id, role);", "Role.delete({");
        assertFragmentOrder(source, [
            "const role = await Role.findOneOrFail({\n            where: { id: role_id, guild: { id: guild_id } },",
            "await assertCanManageTargetRole(req.user_id, guild_id, role);",
            "role.assign({",
            "role.save()",
            'event: "GUILD_ROLE_UPDATE"',
        ]);
    });
});
