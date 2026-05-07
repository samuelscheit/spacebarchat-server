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
import test from "node:test";
import { TeamMemberRole, TeamMemberState } from "../../../schemas/api/developers/Team";
import { serializeTeamListResponse } from "./Team";

test("serializeTeamListResponse returns the GET /teams/ DTO without unloaded relations", () => {
    const teamsWithRelations = [
        {
            id: "100",
            icon: undefined,
            members: [
                {
                    id: "101",
                    membership_state: TeamMemberState.ACCEPTED,
                    permissions: ["*"],
                    role: TeamMemberRole.ADMIN,
                    team: { id: "100" },
                    team_id: "100",
                    user: { id: "200" },
                    user_id: "200",
                },
            ],
            name: "Example Team",
            owner_user: { id: "200" },
            owner_user_id: "200",
        },
    ] as unknown as Parameters<typeof serializeTeamListResponse>[0];

    const response = serializeTeamListResponse(teamsWithRelations);

    assert.deepEqual(response, [
        {
            id: "100",
            icon: null,
            members: [
                {
                    id: "101",
                    membership_state: TeamMemberState.ACCEPTED,
                    permissions: ["*"],
                    role: TeamMemberRole.ADMIN,
                    team_id: "100",
                    user_id: "200",
                },
            ],
            name: "Example Team",
            owner_user_id: "200",
        },
    ]);
});
