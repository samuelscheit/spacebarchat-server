import type { PublicVoiceState } from "@spacebar/schemas";
import { getMostRelevantSession, VoiceState, type Activity, type ClientStatus, type Guild, type GuildOrUnavailable, type Session, type Status } from "@spacebar/util";

export type ReadySupplementalGuild = {
    activity_instances: never[];
    embedded_activities: never[];
    id: string;
    voice_states: PublicVoiceState[];
};

export type ReadySupplementalPresence = {
    activities: Activity[];
    client_status: ClientStatus;
    hidden_activities: Activity[];
    processed_at_timestamp: string;
    restricted_application: null;
    status: Status;
    user_id: string;
};

export type ReadySupplementalData = {
    disclose: string[];
    game_invites: never[];
    guilds: ReadySupplementalGuild[];
    lazy_private_channels: never[];
    merged_members: never[][];
    merged_presences: {
        friends: ReadySupplementalPresence[];
        guilds: never[][];
    };
    user_activities: never[];
};

export type ReadySupplementalContext = {
    disclose?: string[];
    friendIds?: string[];
    processedAt?: Date;
    sessions?: Session[];
};

function isAvailableGuild(guild: GuildOrUnavailable): guild is Guild {
    return !("unavailable" in guild && guild.unavailable);
}

function serializeVoiceState(voiceState: VoiceState): PublicVoiceState {
    return typeof voiceState.toPublicVoiceState === "function" ? voiceState.toPublicVoiceState() : VoiceState.prototype.toPublicVoiceState.apply(voiceState);
}

function getPublicStatus(session: Session): Status {
    return typeof session.getPublicStatus === "function" ? session.getPublicStatus() : session.status === "invisible" ? "offline" : session.status;
}

function isPrivatePresenceStatus(session: Session, status: Status): boolean {
    return status === "offline" || status === "invisible" || session.status === "offline" || session.status === "invisible";
}

function serializeFriendPresences({ friendIds = [], processedAt = new Date(), sessions = [] }: ReadySupplementalContext): ReadySupplementalPresence[] {
    if (!friendIds.length) return [];

    const sessionsByUserId = new Map<string, Session[]>();
    for (const session of sessions) {
        if (!friendIds.includes(session.user_id)) continue;

        const userSessions = sessionsByUserId.get(session.user_id);
        if (userSessions) userSessions.push(session);
        else sessionsByUserId.set(session.user_id, [session]);
    }

    return friendIds.flatMap((userId) => {
        const session = getMostRelevantSession([...(sessionsByUserId.get(userId) ?? [])]);
        if (!session) return [];

        const status = getPublicStatus(session);
        if (isPrivatePresenceStatus(session, status)) return [];

        return [
            {
                activities: session.activities ?? [],
                client_status: session.client_status ?? {},
                hidden_activities: [],
                processed_at_timestamp: processedAt.toISOString(),
                restricted_application: null,
                status,
                user_id: userId,
            },
        ];
    });
}

/**
 * Build the user READY_SUPPLEMENTAL dispatch payload.
 *
 * Discord's READY_SUPPLEMENTAL is guild-indexed: fields such as `guilds`,
 * `merged_members`, and `merged_presences.guilds` use the same available-guild
 * ordering. Keep empty guild-indexed placeholders aligned so clients can join
 * future supplemental data by array index without seeing a malformed shape.
 */
export function buildReadySupplementalData(guilds: GuildOrUnavailable[], context: ReadySupplementalContext = {}): ReadySupplementalData {
    const availableGuilds = guilds.filter(isAvailableGuild);

    return {
        merged_presences: {
            guilds: availableGuilds.map(() => []),
            friends: serializeFriendPresences(context),
        },
        merged_members: availableGuilds.map(() => []),
        lazy_private_channels: [],
        guilds: availableGuilds.map((guild) => ({
            voice_states: (guild.voice_states ?? []).map((state) => serializeVoiceState(state)),
            id: guild.id,
            embedded_activities: [],
            activity_instances: [],
        })),
        disclose: context.disclose ?? ["pomelo"],
        game_invites: [],
        user_activities: [],
    };
}
