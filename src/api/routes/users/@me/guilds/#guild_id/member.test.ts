/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { PublicMember, PublicUser } from "@spacebar/schemas";
import type { GuildMemberUpdateEvent } from "@spacebar/util";
import {
    acknowledgeDmSettingsUpsell,
    buildDmSettingsUpsellAckMemberUpdateEvent,
    DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG,
    type DmSettingsUpsellAckMember,
} from "./member/ack-dm-upsell-settings";

function createAckMember(flags: number): DmSettingsUpsellAckMember & { saveCalls: number } {
    const publicUser = {
        id: "user-1",
        username: "current-user",
        discriminator: "0",
        avatar: null,
        public_flags: 0,
    } as unknown as PublicUser;
    const member = {
        flags,
        roles: [{ id: "guild-1" }, { id: "role-1" }],
        saveCalls: 0,
        user: {
            toPublicUser: () => publicUser,
        },
        async save() {
            member.saveCalls += 1;
        },
        toPublicMember: () =>
            ({
                id: "user-1",
                guild_id: "guild-1",
                roles: ["guild-1", "role-1"],
                joined_at: new Date("2026-01-01T00:00:00.000Z"),
                pending: false,
                deaf: false,
                mute: false,
                banner: "",
                bio: "",
                communication_disabled_until: null,
                flags: member.flags,
                user: publicUser,
            }) as PublicMember,
    };

    return member;
}

test("GET /users/@me/guilds/{guild_id}/member declares current guild member response metadata", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "guilds", "#guild_id", "member.ts"), "utf-8");

    assert.match(routeSource, /router\.get\(/);
    assert.match(routeSource, /200:\s*{\s*body:\s*"CurrentGuildMemberResponse"/);
    assert.match(routeSource, /401:\s*{\s*body:\s*"APIErrorResponse"/);
    assert.match(routeSource, /404:\s*{\s*body:\s*"APIErrorResponse"/);
    assert.match(routeSource, /findCurrentGuildMember\(req\.user_id,\s*guild_id\)/);
});

test("GET /users/@me/guilds/{guild_id}/member OpenAPI documents bearer auth and responses", () => {
    const openapi = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8")) as {
        paths?: Record<
            string,
            {
                get?: {
                    security?: unknown;
                    responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
                };
            }
        >;
    };
    const operation = openapi.paths?.["/users/@me/guilds/{guild_id}/member/"]?.get;

    assert.ok(operation, "expected generated OpenAPI operation");
    assert.deepEqual(operation.security, [{ bearer: [] }]);
    assert.equal(operation.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CurrentGuildMemberResponse");
    assert.equal(operation.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
    assert.equal(operation.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
});

test("POST /users/@me/guilds/{guild_id}/member/ack-dm-upsell-settings declares no-content metadata", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "guilds", "#guild_id", "member", "ack-dm-upsell-settings.ts"), "utf-8");

    assert.match(routeSource, /router\.post\(/);
    assert.match(routeSource, /204:\s*{}/);
    assert.match(routeSource, /401:\s*{\s*body:\s*"APIErrorResponse"/);
    assert.match(routeSource, /404:\s*{\s*body:\s*"APIErrorResponse"/);
    assert.match(routeSource, /Member\.findOneOrFail\(\s*{\s*where:\s*{\s*id:\s*req\.user_id,\s*guild_id\s*}/);
    assert.match(routeSource, /relations:\s*{\s*roles:\s*true,\s*user:\s*true\s*}/);
    assert.match(routeSource, /acknowledgeDmSettingsUpsell\(member,\s*guild_id\)/);
    assert.match(routeSource, /res\.sendStatus\(204\)/);
});

test("acknowledgeDmSettingsUpsell sets member flag, saves, and emits member update", async () => {
    const member = createAckMember(4);
    const events: GuildMemberUpdateEvent[] = [];

    const changed = await acknowledgeDmSettingsUpsell(member, "guild-1", (event) => events.push(event));

    assert.equal(changed, true);
    assert.equal(member.flags, 4 | DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG);
    assert.equal(member.saveCalls, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "GUILD_MEMBER_UPDATE");
    assert.equal(events[0].guild_id, "guild-1");
    assert.deepEqual(events[0].data.roles, ["role-1"]);
    assert.equal((events[0].data as { flags?: number }).flags, member.flags);
    assert.equal(events[0].data.user.id, "user-1");
});

test("acknowledgeDmSettingsUpsell is idempotent when the flag is already set", async () => {
    const member = createAckMember(DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG);
    const events: GuildMemberUpdateEvent[] = [];

    const changed = await acknowledgeDmSettingsUpsell(member, "guild-1", (event) => events.push(event));

    assert.equal(changed, false);
    assert.equal(member.flags, DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG);
    assert.equal(member.saveCalls, 0);
    assert.deepEqual(events, []);
});

test("buildDmSettingsUpsellAckMemberUpdateEvent serializes updated public member data", () => {
    const member = createAckMember(DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG);

    const event = buildDmSettingsUpsellAckMemberUpdateEvent(member, "guild-1");

    assert.equal(event.event, "GUILD_MEMBER_UPDATE");
    assert.equal(event.guild_id, "guild-1");
    assert.equal(event.data.guild_id, "guild-1");
    assert.deepEqual(event.data.roles, ["role-1"]);
    assert.equal((event.data as { flags?: number }).flags, DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG);
});

test("POST /users/@me/guilds/{guild_id}/member/ack-dm-upsell-settings OpenAPI documents bearer auth and responses", () => {
    const openapi = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8")) as {
        paths?: Record<
            string,
            {
                post?: {
                    security?: unknown;
                    responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
                };
            }
        >;
    };
    const operation = openapi.paths?.["/users/@me/guilds/{guild_id}/member/ack-dm-upsell-settings/"]?.post;

    assert.ok(operation, "expected generated OpenAPI operation");
    assert.deepEqual(operation.security, [{ bearer: [] }]);
    assert.ok(operation.responses?.["204"]);
    assert.equal(operation.responses?.["204"]?.content, undefined);
    assert.equal(operation.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
    assert.equal(operation.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
});
