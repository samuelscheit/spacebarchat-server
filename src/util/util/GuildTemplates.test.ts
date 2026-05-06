import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createTemplateRoleIdMap, getMappedTemplateRoleId, remapTemplateChannelPermissionOverwrites } from "./GuildTemplates";

const ROLE_PERMISSION_OVERWRITE_TYPE = 0;
const MEMBER_PERMISSION_OVERWRITE_TYPE = 1;
const GROUP_PERMISSION_OVERWRITE_TYPE = 2;

describe("guild template role remapping", () => {
    test("maps template role ids to new guild role ids and normalizes Discord numeric ids", () => {
        const generatedIds = ["new-role-1", "new-role-2"];
        const roleIdMap = createTemplateRoleIdMap([{ id: "source-guild" }, { id: 0 }, { id: 1 }, { id: "old-role-2" }], "source-guild", "new-guild", () => {
            const id = generatedIds.shift();
            assert.ok(id);
            return id;
        });

        assert.equal(roleIdMap.get("source-guild"), "new-guild");
        assert.equal(roleIdMap.get("0"), "new-guild");
        assert.equal(roleIdMap.get("1"), "new-role-1");
        assert.equal(roleIdMap.get("old-role-2"), "new-role-2");
        assert.equal(getMappedTemplateRoleId(0, roleIdMap), "new-guild");
        assert.equal(getMappedTemplateRoleId(1, roleIdMap), "new-role-1");
        assert.equal(getMappedTemplateRoleId("source-guild", roleIdMap), "new-guild");
    });

    test("remaps known role permission overwrites and strips unsafe overwrites", () => {
        const roleIdMap = new Map([
            ["0", "new-guild"],
            ["source-guild", "new-guild"],
            ["old-role", "new-role"],
        ]);

        const channels = remapTemplateChannelPermissionOverwrites(
            [
                {
                    id: "channel",
                    permission_overwrites: [
                        { id: 0, type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1", deny: "0" },
                        { id: "old-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2", deny: "0" },
                        { id: "missing-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "4", deny: "0" },
                        { id: "user-id", type: MEMBER_PERMISSION_OVERWRITE_TYPE, allow: "8", deny: "0" },
                        { id: "group-id", type: GROUP_PERMISSION_OVERWRITE_TYPE, allow: "16", deny: "0" },
                    ],
                },
            ],
            roleIdMap,
        );

        assert.deepEqual(channels[0].permission_overwrites, [
            { id: "new-guild", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1", deny: "0" },
            { id: "new-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2", deny: "0" },
        ]);
    });
});
