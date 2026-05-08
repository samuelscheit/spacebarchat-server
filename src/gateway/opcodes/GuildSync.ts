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

import { Member, Session, Presence, timePromise, Stopwatch, Config, getMostRelevantSession, getDatabase } from "@spacebar/util";
import { WebSocket, Payload, OPCODES, Send, handleOffloadedGatewayRequest } from "@spacebar/gateway";
import { PublicMember } from "@spacebar/schemas";

// TODO: only show roles/members that have access to this channel
// TODO: config: to list all members (even those who are offline) sorted by role, or just those who are online

export async function onGuildSync(this: WebSocket, { d }: Payload) {
    const sw = Stopwatch.startNew();
    if (!Array.isArray(d)) throw new Error("Invalid payload for GUILD_SYNC");

    if (Config.get().offload.gateway.guildSyncUrl !== null) {
        return await handleOffloadedGatewayRequest(this, Config.get().offload.gateway.guildSyncUrl!, d);
    }

    const guild_ids = d as string[];

    const joinedGuildIds = await getJoinedGuildIds(this.user_id, guild_ids);

    // not awaiting lol
    timePromise(async () => handleGuildSync(this, joinedGuildIds))
        .then(({ result, elapsed }) => {
            console.log(`[Gateway/${this.user_id}] GUILD_SYNC processed ${guild_ids.length} guilds in ${sw.elapsed().totalMilliseconds}ms:`, {
                ...Object.fromEntries(result.map((r) => [r.id, `${r.id}: ${r.members.length}U/${r.presences.length}P in ${elapsed.totalMilliseconds}ms`])),
            });
        })
        .catch((err) => {
            console.error(`[Gateway/${this.user_id}] Error processing GUILD_SYNC:`, err);
        });
}

interface GuildSyncResult {
    id: string;
    presences: Presence[];
    members: PublicMember[];
}

async function getJoinedGuildIds(userId: string, guildIds: string[]) {
    if (guildIds.length === 0) return [];

    const db = getDatabase();
    if (!db) throw new Error("Database not initialized");

    const rows = await db
        .getRepository(Member)
        .createQueryBuilder("member")
        .select("member.guild_id", "guild_id")
        .where("member.id = :userId", { userId })
        .andWhere("member.guild_id IN (:...guildIds)", { guildIds })
        .getRawMany<{ guild_id: string }>();

    return rows.map((row) => row.guild_id);
}

async function getGuildMembers(guildIds: string[]) {
    if (guildIds.length === 0) return [];

    const db = getDatabase();
    if (!db) throw new Error("Database not initialized");

    return db
        .getRepository(Member)
        .createQueryBuilder("member")
        .where("member.guild_id IN (:...guildIds)", { guildIds })
        .leftJoinAndSelect("member.user", "user")
        .leftJoinAndSelect("member.roles", "role")
        .leftJoinAndSelect("member.guild", "guild")
        .getMany();
}

async function getSessionsForMembers(members: Member[]) {
    const userIds = [...new Set(members.map((member) => member.id))];
    if (userIds.length === 0) return [];

    const db = getDatabase();
    if (!db) throw new Error("Database not initialized");

    return db.getRepository(Session).createQueryBuilder("session").where("session.user_id IN (:...userIds)", { userIds }).orderBy("session.user_id", "ASC").getMany();
}

function groupByUserId(sessions: Session[]) {
    const sessionsByUserId = new Map<string, Session[]>();
    for (const session of sessions) {
        if (!sessionsByUserId.has(session.user_id)) sessionsByUserId.set(session.user_id, []);
        sessionsByUserId.get(session.user_id)!.push(session);
    }

    return sessionsByUserId;
}

function groupMembersByGuildId(members: Member[]) {
    const membersByGuildId = new Map<string, Member[]>();
    for (const member of members) {
        if (!membersByGuildId.has(member.guild_id)) membersByGuildId.set(member.guild_id, []);
        membersByGuildId.get(member.guild_id)!.push(member);
    }

    return membersByGuildId;
}

function buildGuildSyncResult(guild_id: string, members: Member[], sessionsByUserId: Map<string, Session[]>) {
    const res: GuildSyncResult = { id: guild_id, presences: [], members: [] };

    res.members = members.map((m) => m.toPublicMember());

    for (const member of members) {
        const userSessions = sessionsByUserId.get(member.id) || [];
        if (userSessions.length === 0) continue;

        const mostRelevantSession = getMostRelevantSession(userSessions);
        const presence: Presence = {
            user: member.user.toPublicUser(),
            guild_id: guild_id,
            status: mostRelevantSession.getPublicStatus(),
            activities: mostRelevantSession.activities,
            client_status: mostRelevantSession.client_status,
        };
        res.presences.push(presence);
    }

    return res;
}

async function handleGuildSync(ws: WebSocket, guildIds: string[]) {
    const members = await getGuildMembers(guildIds);
    const sessionsByUserId = groupByUserId(await getSessionsForMembers(members));
    const membersByGuildId = groupMembersByGuildId(members);
    const results = guildIds.map((guildId) => buildGuildSyncResult(guildId, membersByGuildId.get(guildId) ?? [], sessionsByUserId));

    await Promise.all(
        results.map((res) =>
            Send(ws, {
                op: OPCODES.Dispatch,
                t: "GUILD_SYNC",
                s: ws.sequence++,
                d: res,
            }),
        ),
    );

    return results;
}
