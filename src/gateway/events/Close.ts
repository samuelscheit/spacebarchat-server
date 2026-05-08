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

import type { WebSocket } from "@spacebar/gateway";
import {
    emitEvent,
    getMostRelevantSession,
    Member,
    VoiceStateMemberRelations,
    memberToVoiceStateMember,
    PresenceUpdateEvent,
    Session,
    SessionsReplace,
    User,
    VoiceState,
    VoiceStateUpdateEvent,
    distributePresenceUpdate,
    serializePrivateGatewaySessions,
} from "@spacebar/util";
import { randomString } from "@spacebar/api";
import { runDelayedGatewayCloseCleanup } from "../util/Shutdown";

export interface CloseSessionRecord {
    session_id?: string;
    last_seen?: Date;
    activities: PresenceUpdateEvent["data"]["activities"];
    client_status: PresenceUpdateEvent["data"]["client_status"];
    status: PresenceUpdateEvent["data"]["status"];
    getPublicStatus(): PresenceUpdateEvent["data"]["status"];
    toPrivateGatewayDeviceInfo(): SessionsReplace["data"][number];
}

export interface CloseSessionCleanupDependencies {
    findSessions(userId: string): Promise<CloseSessionRecord[]>;
    markSessionOffline(userId: string, sessionId: string, closedAt: number): Promise<boolean>;
    findPublicUser(userId: string): Promise<unknown | undefined>;
    emitSessionsReplace(userId: string, sessions: CloseSessionRecord[]): Promise<void>;
    distributePresenceUpdate(userId: string, event: PresenceUpdateEvent): Promise<void>;
    getMostRelevantSession(sessions: CloseSessionRecord[]): CloseSessionRecord | undefined;
    createTransactionId(userId: string): string;
}

const closeSessionCleanupDependencies: CloseSessionCleanupDependencies = {
    findSessions: (userId) =>
        Session.find({
            where: { user_id: userId, is_admin_session: false },
        }),
    markSessionOffline: async (userId, sessionId, closedAt) => {
        const result = await Session.createQueryBuilder()
            .update(Session)
            .set({ status: "offline", activities: [], client_status: {} })
            .where("user_id = :userId", { userId })
            .andWhere("session_id = :sessionId", { sessionId })
            .andWhere("(last_seen IS NULL OR last_seen <= :closedAt)", { closedAt: new Date(closedAt) })
            .execute();

        return (result.affected ?? 0) > 0;
    },
    findPublicUser: async (userId) => User.getPublicUser(userId).catch(() => undefined),
    emitSessionsReplace: async (userId, sessions) => {
        await emitEvent({
            event: "SESSIONS_REPLACE",
            user_id: userId,
            data: serializePrivateGatewaySessions(sessions),
        } as SessionsReplace);
    },
    distributePresenceUpdate,
    getMostRelevantSession: (sessions) => getMostRelevantSession(sessions as Session[]),
    createTransactionId: (userId) => `IDENT_${userId}_${randomString()}`,
};

export async function cleanupClosedSessionPresence(
    userId: string | undefined,
    authSessionId: string | undefined,
    closedAt: number,
    deps: CloseSessionCleanupDependencies = closeSessionCleanupDependencies,
) {
    if (!userId || !authSessionId) return false;

    if (!(await deps.markSessionOffline(userId, authSessionId, closedAt))) return false;

    const sessions = await deps.findSessions(userId);
    const relevantSession = deps.getMostRelevantSession(sessions) ?? {
        activities: [],
        client_status: {},
        status: "offline",
        getPublicStatus: () => "offline",
    };
    await deps.emitSessionsReplace(userId, sessions);

    const user = await deps.findPublicUser(userId);
    if (user === undefined) return true;

    await deps.distributePresenceUpdate(userId, {
        event: "PRESENCE_UPDATE",
        data: {
            user: user as PresenceUpdateEvent["data"]["user"],
            status: relevantSession.getPublicStatus(),
            client_status: relevantSession.client_status,
            activities: relevantSession.activities,
        },
        origin: "GATEWAY_CLOSE",
        transaction_id: deps.createTransactionId(userId),
    } satisfies PresenceUpdateEvent);

    return true;
}

export async function Close(this: WebSocket, code: number, reason: Buffer) {
    console.log("[WebSocket] closed", code, reason.toString());
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    if (this.readyTimeout) clearTimeout(this.readyTimeout);
    this.deflate?.close();
    this.inflate?.close();
    this.removeAllListeners();

    let delayedSessionCleanup: Promise<void> | undefined;

    try {
        if (this.session_id) {
            const authSessionId = this.session?.session_id;
            const closedAt = Date.now();

            delayedSessionCleanup = runDelayedGatewayCloseCleanup(async () => {
                try {
                    console.log("Handling presence update after disconnect");
                    const updated = await cleanupClosedSessionPresence(this.user_id, authSessionId, closedAt);
                    if (updated) console.log("... done!");
                    else console.log("... Discarding presence update as the session reactivated");
                } catch (e) {
                    console.error("[WebSocket] Close session cleanup failed", code, e);
                }
            });

            const voiceState = await VoiceState.findOne({
                where: { user_id: this.user_id },
            });

            // clear the voice state for this session if user was in voice channel
            if (voiceState && voiceState.session_id === this.session_id && voiceState.channel_id) {
                const prevGuildId = voiceState.guild_id;
                const prevChannelId = voiceState.channel_id;

                // @ts-expect-error channel_id is nullable
                voiceState.channel_id = null;
                // @ts-expect-error guild_id is nullable
                voiceState.guild_id = null;
                voiceState.self_stream = false;
                voiceState.self_video = false;
                await voiceState.save();

                const member = prevGuildId
                    ? await Member.findOne({
                          where: {
                              id: voiceState.user_id,
                              guild_id: prevGuildId,
                          },
                          relations: VoiceStateMemberRelations,
                      })
                    : undefined;
                // let the users in previous guild/channel know that user disconnected
                await emitEvent({
                    event: "VOICE_STATE_UPDATE",
                    data: {
                        ...voiceState.toPublicVoiceState(),
                        guild_id: prevGuildId, // have to send the previous guild_id because that's what client expects for disconnect messages
                        member: member ? memberToVoiceStateMember(member) : undefined,
                    },
                    guild_id: prevGuildId,
                    channel_id: prevChannelId,
                } satisfies VoiceStateUpdateEvent);
            }
        }
    } finally {
        await delayedSessionCleanup;
    }
}
