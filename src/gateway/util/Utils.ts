import { Event, Session, TimeSpan } from "@spacebar/util";
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

export async function cleanupOnStartup(): Promise<void> {
    console.log("[Gateway] Starting presence expiry...");
    await expireOldPresenceStates()
        .then(() => console.log("[Gateway] Successfully cleaned expired presence states"))
        .catch((e) => console.error("[Gateway] Error cleaning expired presence states:", e));
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
