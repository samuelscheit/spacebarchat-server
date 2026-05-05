import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createTemplateRoleIdMap, remapTemplateChannelPermissionOverwrites } from "./GuildTemplates";

const ROLE_PERMISSION_OVERWRITE_TYPE = 0;
const MEMBER_PERMISSION_OVERWRITE_TYPE = 1;

describe("guild template role remapping", () => {
    test("maps template role ids to new guild role ids", () => {
        const generatedIds = ["new-role-1", "new-role-2"];
        const roleIdMap = createTemplateRoleIdMap([{ id: "source-guild" }, { id: "old-role-1" }, { id: "old-role-2" }], "source-guild", "new-guild", () => {
            const id = generatedIds.shift();
            assert.ok(id);
            return id;
        });

        assert.equal(roleIdMap.get("source-guild"), "new-guild");
        assert.equal(roleIdMap.get("0"), "new-guild");
        assert.equal(roleIdMap.get("old-role-1"), "new-role-1");
        assert.equal(roleIdMap.get("old-role-2"), "new-role-2");
    });

    test("remaps role permission overwrites and leaves member overwrites unchanged", () => {
        const roleIdMap = new Map([
            ["source-guild", "new-guild"],
            ["old-role", "new-role"],
        ]);

        const channels = remapTemplateChannelPermissionOverwrites(
            [
                {
                    id: "channel",
                    permission_overwrites: [
                        { id: "source-guild", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1", deny: "0" },
                        { id: "old-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2", deny: "0" },
                        { id: "user-id", type: MEMBER_PERMISSION_OVERWRITE_TYPE, allow: "4", deny: "0" },
                    ],
                },
            ],
            roleIdMap,
        );

        assert.deepEqual(channels[0].permission_overwrites, [
            { id: "new-guild", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1", deny: "0" },
            { id: "new-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2", deny: "0" },
            { id: "user-id", type: MEMBER_PERMISSION_OVERWRITE_TYPE, allow: "4", deny: "0" },
        ]);
    });
});
