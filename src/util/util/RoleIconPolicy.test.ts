import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Rights } from "@spacebar/util";
import { assertGuildCreateRolePolicy, assertRoleIconPolicy, usesRoleIconPerk } from "./RoleIconPolicy";

describe("role icon policy", () => {
    test("detects custom role icon and unicode emoji payloads", () => {
        assert.equal(usesRoleIconPerk({}), false);
        assert.equal(usesRoleIconPerk({ icon: "" }), false);
        assert.equal(usesRoleIconPerk({ unicode_emoji: "" }), false);
        assert.equal(usesRoleIconPerk({ icon: "data:image/png;base64,abc" }), true);
        assert.equal(usesRoleIconPerk({ unicode_emoji: "✨" }), true);
    });

    test("requires ROLE_ICONS for uploaded icons", () => {
        assert.throws(() => assertRoleIconPolicy({ guildFeatures: [], body: { icon: "data:image/png;base64,abc" } }), /ROLE_ICONS/);

        assert.doesNotThrow(() => assertRoleIconPolicy({ guildFeatures: ["ROLE_ICONS"], body: { icon: "data:image/png;base64,abc" } }));
    });

    test("requires ROLE_ICONS for unicode role emoji", () => {
        assert.throws(() => assertRoleIconPolicy({ guildFeatures: [], body: { unicode_emoji: "🔥" } }), /ROLE_ICONS/);

        assert.doesNotThrow(() => assertRoleIconPolicy({ guildFeatures: ["ROLE_ICONS"], body: { unicode_emoji: "🔥" } }));
    });

    test("requires CREATE_ROLES only for role creation", () => {
        assert.throws(() => assertRoleIconPolicy({ guildFeatures: ["ROLE_ICONS"], body: {}, creating: true }), /CREATE_ROLES/);
        assert.throws(() => assertRoleIconPolicy({ guildFeatures: ["ROLE_ICONS"], body: {}, creating: true, rights: new Rights(0) }), /CREATE_ROLES/);

        assert.doesNotThrow(() => assertRoleIconPolicy({ guildFeatures: ["ROLE_ICONS"], body: {}, creating: true, rights: new Rights("CREATE_ROLES") }));
        assert.doesNotThrow(() => assertRoleIconPolicy({ guildFeatures: ["ROLE_ICONS"], body: { icon: "data:image/png;base64,abc" }, rights: new Rights(0) }));
    });

    test("requires CREATE_ROLES for custom roles created with a guild or template", () => {
        assert.throws(() => assertGuildCreateRolePolicy({ guildFeatures: [], roles: [{ name: "moderator" }], creatingCustomRoles: true }), /CREATE_ROLES/);

        assert.doesNotThrow(() =>
            assertGuildCreateRolePolicy({
                guildFeatures: [],
                roles: [{ name: "moderator" }],
                creatingCustomRoles: true,
                rights: new Rights("CREATE_ROLES"),
            }),
        );
    });

    test("requires ROLE_ICONS for role icon fields in guild and template creation payloads", () => {
        assert.throws(
            () =>
                assertGuildCreateRolePolicy({
                    guildFeatures: [],
                    roles: [{ name: "emoji role", unicode_emoji: "🔥" }],
                    rights: new Rights("CREATE_ROLES"),
                }),
            /ROLE_ICONS/,
        );

        assert.doesNotThrow(() =>
            assertGuildCreateRolePolicy({
                guildFeatures: ["ROLE_ICONS"],
                roles: [{ name: "emoji role", unicode_emoji: "🔥" }],
                rights: new Rights("CREATE_ROLES"),
            }),
        );
    });

    test("allows no-op role edits without role-icon guild perks", () => {
        assert.doesNotThrow(() => assertRoleIconPolicy({ guildFeatures: [], body: { name: "moderator" } }));
    });
});
