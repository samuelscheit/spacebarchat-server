/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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
import test from "node:test";
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("TeamListResponse schema describes the teams route DTO instead of the Team entity", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const teamListResponse = schemas.TeamListResponse;
    const team = schemas.TeamListTeam;
    const member = schemas.TeamListTeamMember;
    assert.ok(team.properties?.members.items);
    assert.ok(member.properties);

    assert.equal(teamListResponse.type, "array");
    assert.equal(teamListResponse.items?.$ref, "#/definitions/TeamListTeam");
    assert.notEqual(teamListResponse.items?.$ref, "#/definitions/Team");
    assert.equal(team.properties?.owner_user, undefined);
    assert.equal(team.properties.members.items.$ref, "#/definitions/TeamListTeamMember");
    assert.equal(member.properties.team, undefined);
    assert.equal(member.properties.user, undefined);

    assert.deepEqual(team.required, ["id", "members", "name", "owner_user_id"]);
    assert.deepEqual(member.required, ["id", "membership_state", "permissions", "role", "team_id", "user_id"]);
});

test("TeamListResponse remains wired to GET /teams/ in OpenAPI", () => {
    const openapi = readAssetJson<{
        components: { schemas: Record<string, JsonShape> };
        paths: Record<
            string,
            {
                get: {
                    responses: Record<string, { content: Record<string, { schema: Record<string, string> }> }>;
                };
            }
        >;
    }>("openapi.json");

    assert.deepEqual(openapi.paths["/teams/"].get.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/TeamListResponse" });
    assert.equal(openapi.components.schemas.TeamListResponse.items?.$ref, "#/components/schemas/TeamListTeam");
    assert.notEqual(openapi.components.schemas.TeamListResponse.items?.$ref, "#/components/schemas/Team");
});

test("TeamListResponse validates route-shaped teams and rejects unloaded entity relations", () => {
    const routeShapedTeam = [
        {
            id: "100",
            icon: null,
            members: [
                {
                    id: "101",
                    membership_state: 2,
                    permissions: ["*"],
                    role: "admin",
                    team_id: "100",
                    user_id: "200",
                },
            ],
            name: "Example Team",
            owner_user_id: "200",
        },
    ];

    assert.equal(ajv.validate("TeamListResponse", routeShapedTeam), true);
    assert.equal(
        ajv.validate("TeamListResponse", [
            {
                ...routeShapedTeam[0],
                owner_user: { id: "200" },
            },
        ]),
        false,
    );
});
