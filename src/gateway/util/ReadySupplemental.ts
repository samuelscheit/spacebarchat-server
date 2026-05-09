import type { PublicVoiceState } from "@spacebar/schemas";
import { getMostRelevantSession, VoiceState, type Activity, type ClientStatus, type Session, type Status } from "@spacebar/util";

type ReadySupplementalVoiceStateSource = PublicVoiceState | Pick<VoiceState, "toPublicVoiceState">;

type ReadySupplementalGuildCandidate = {
    id: string;
    unavailable?: boolean;
    voice_states?: ReadonlyArray<ReadySupplementalVoiceStateSource>;
};

type ReadySupplementalGuildSource = ReadySupplementalGuildCandidate & { unavailable?: undefined | false };

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

function isAvailableGuild(guild: ReadySupplementalGuildCandidate): guild is ReadySupplementalGuildSource {
    return guild.unavailable != true;
}

function hasVoiceStateSerializer(voiceState: ReadySupplementalVoiceStateSource): voiceState is Pick<VoiceState, "toPublicVoiceState"> {
    return typeof (voiceState as Partial<Pick<VoiceState, "toPublicVoiceState">>).toPublicVoiceState === "function";
}

function serializeVoiceState(voiceState: ReadySupplementalVoiceStateSource): PublicVoiceState {
    if (hasVoiceStateSerializer(voiceState)) return voiceState.toPublicVoiceState();
    return VoiceState.prototype.toPublicVoiceState.apply(voiceState);
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

export function buildReadySupplementalGuilds(guilds: ReadonlyArray<ReadySupplementalGuildCandidate>): ReadySupplementalGuild[] {
    return guilds.filter(isAvailableGuild).map((guild) => ({
        voice_states: (guild.voice_states ?? []).map(serializeVoiceState),
        id: guild.id,
        embedded_activities: [],
        activity_instances: [],
    }));
}

/**
 * Build the user READY_SUPPLEMENTAL dispatch payload.
 *
 * Discord's READY_SUPPLEMENTAL is guild-indexed: fields such as `guilds`,
 * `merged_members`, and `merged_presences.guilds` use the same available-guild
 * ordering. Keep empty guild-indexed placeholders aligned so clients can join
 * future supplemental data by array index without seeing a malformed shape.
 */
export function buildReadySupplementalData(guilds: ReadonlyArray<ReadySupplementalGuildCandidate>, context: ReadySupplementalContext = {}): ReadySupplementalData {
    const supplementalGuilds = buildReadySupplementalGuilds(guilds);

    return {
        merged_presences: {
            guilds: supplementalGuilds.map(() => []),
            friends: serializeFriendPresences(context),
        },
        merged_members: supplementalGuilds.map(() => []),
        lazy_private_channels: [],
        guilds: supplementalGuilds,
        disclose: context.disclose ?? ["pomelo"],
        game_invites: [],
        user_activities: [],
    };
}
