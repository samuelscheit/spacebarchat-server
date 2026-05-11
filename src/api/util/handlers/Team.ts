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

import { type TeamListResponse, type TeamListTeamMember, type TeamResponse } from "@spacebar/schemas";
import { type Team, type TeamMember } from "@spacebar/util";

type TeamListSerializableMember = Pick<TeamMember, "id" | "membership_state" | "permissions" | "role" | "team_id" | "user_id">;

type TeamListSerializableTeam = Pick<Team, "id" | "name" | "owner_user_id"> & {
    icon?: string | null;
    members: TeamListSerializableMember[];
};

function serializeTeamListMember(member: TeamListSerializableMember): TeamListTeamMember {
    return {
        id: member.id,
        membership_state: member.membership_state,
        permissions: member.permissions,
        role: member.role,
        team_id: member.team_id,
        user_id: member.user_id,
    };
}

export function serializeTeamResponse(team: TeamListSerializableTeam): TeamResponse {
    return {
        id: team.id,
        icon: team.icon ?? null,
        members: team.members.map(serializeTeamListMember),
        name: team.name,
        owner_user_id: team.owner_user_id,
    };
}

export function serializeTeamListResponse(teams: TeamListSerializableTeam[]): TeamListResponse {
    return teams.map(serializeTeamResponse);
}
