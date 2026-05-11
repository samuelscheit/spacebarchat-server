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
