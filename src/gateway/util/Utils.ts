import { Event, Session, TimeSpan, VoiceState } from "@spacebar/util";
import { WebSocket } from "./WebSocket";
import { OPCODES } from "./Constants";
import { Send } from "./Send";

export function parseStreamKey(streamKey: string): {
    type: "guild" | "call";
    channelId: string;
    guildId?: string;
    userId: string;
} {
    const streamKeyArray = streamKey.split(":");

    const type = streamKeyArray.shift();

    if (type !== "guild" && type !== "call") {
        throw new Error(`Invalid stream key type: ${type}`);
    }

    if ((type === "guild" && streamKeyArray.length < 3) || (type === "call" && streamKeyArray.length < 2)) throw new Error(`Invalid stream key: ${streamKey}`); // invalid stream key

    let guildId: string | undefined;
    if (type === "guild") {
        guildId = streamKeyArray.shift();
    }
    const channelId = streamKeyArray.shift();
    const userId = streamKeyArray.shift();

    if (!channelId || !userId) {
        throw new Error(`Invalid stream key: ${streamKey}`);
    }
    return { type, channelId, guildId, userId };
}

export function generateStreamKey(type: "guild" | "call", guildId: string | undefined, channelId: string, userId: string): string {
    const streamKey = `${type}${type === "guild" ? `:${guildId}` : ""}:${channelId}:${userId}`;

    return streamKey;
}

type VoiceStateCleanupRepository = {
    clear(): Promise<void>;
};

const voiceStateCleanupRepository: VoiceStateCleanupRepository = {
    clear: () => VoiceState.clear(),
};

export async function cleanupStaleVoiceStates(voiceStateRepository: VoiceStateCleanupRepository = voiceStateCleanupRepository): Promise<void> {
    // Voice states are tied to in-memory gateway connections and voice session tokens.
    // If rows are still present when the gateway starts, they are stale leftovers from
    // an ungraceful shutdown. Delete them instead of nulling channel/guild fields so
    // reconnecting clients cannot reuse stale session/token or voice flag state.
    await voiceStateRepository.clear();
}

// Temporary cleanup function until shutdown cleanup function is fixed.
// Currently when server is shut down the voice states are not cleared
// TODO: remove this when Server.stop() is fixed so that it waits for all websocket connections to run their
// respective Close event listener function for session cleanup
export async function cleanupOnStartup(): Promise<void> {
    console.log("[Gateway] Starting voice state wipe...");
    const clearVoiceStates = cleanupStaleVoiceStates()
        .then(() => console.log("[Gateway] Successfully cleaned voice states"))
        .catch((e) => console.error("[Gateway] Error cleaning voice states on startup:", e));

    console.log("[Gateway] Starting presence expiry...");
    const expirePresences = expireOldPresenceStates()
        .then(() => console.log("[Gateway] Successfully cleaned expired presence states"))
        .catch((e) => console.error("[Gateway] Error cleaning expired presence states:", e));

    await Promise.all([clearVoiceStates, expirePresences]);
}

async function expireOldPresenceStates() {
    for await (const session of await Session.createQueryBuilder("session").where("last_seen >= '2000/01/01' AND status != 'offline'").select().stream()) {
        // session object has all fields prefixed with `session_`... thanks typeorm
        if (TimeSpan.fromDates((session.session_last_seen as Date).getTime(), new Date().getTime()).totalMinutes > 30) {
            console.log(`[Gateway/util/Utils.ts] Expiring presence for session ${session.session_session_id} last seen at ${session.session_last_seen}`);
            await Session.update({ session_id: session.session_session_id }, { status: "offline" });
        }
    }
}

export async function handleOffloadedGatewayRequest(socket: WebSocket, url: string, body: unknown) {
    // TODO: async json object streaming
    const resp = await fetch(url, {
        body: JSON.stringify(body),
        method: "POST",
        headers: {
            Authorization: `Bearer ${socket.accessToken}`,
            // because the session may not have an id in the token!
            "X-Session-Id": socket.session_id,
            "Content-Type": "application/json",
        },
    });

    if (!resp.ok) {
        const text = await resp.text();
        console.error(`[Gateway] Offloaded request to ${url} failed with status ${resp.status}: ${text}`);
        if (resp.status === 415) console.log(typeof body, body);
        throw new Error(`Offloaded request failed with status ${resp.status}: ${text}`);
    }

    const data = ((await resp.json()) as Event[]).toReversed();
    while (data.length > 0) {
        const event = data.pop()!;
        if (process.env.WS_VERBOSE) console.log(`[Gateway] Received offloaded event: ${JSON.stringify(event)}`);
        await Send(socket, {
            op: OPCODES.Dispatch,
            s: socket.sequence++,
            t: event.event,
            d: event.data,
        });
    }
}
