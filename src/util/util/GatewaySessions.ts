import type { GatewaySession } from "../interfaces";

type SerializableGatewaySession = {
    session_id?: string;
    toPrivateGatewayDeviceInfo(): GatewaySession;
};

export function isRealGatewaySessionId(session_id: string | undefined) {
    return !!session_id && session_id !== "all" && !session_id.startsWith("TEMP_");
}

export function serializePrivateGatewaySessions(sessions: SerializableGatewaySession[]): GatewaySession[] {
    const serialized = new Map<string, GatewaySession>();

    for (const session of sessions) {
        if (!isRealGatewaySessionId(session.session_id)) continue;
        serialized.set(session.session_id!, session.toPrivateGatewayDeviceInfo());
    }

    return [...serialized.values()];
}
