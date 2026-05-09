import type { GatewaySession } from "../interfaces";

type SerializableGatewaySession = {
    session_id?: string;
    toPrivateGatewayDeviceInfo(showCurrentGame?: boolean | null): GatewaySession;
};

export function isRealGatewaySessionId(session_id: string | undefined) {
    return !!session_id && session_id !== "all" && !session_id.startsWith("TEMP_");
}

export function serializePrivateGatewaySessions(sessions: SerializableGatewaySession[], showCurrentGame?: boolean | null): GatewaySession[] {
    const serialized = new Map<string, GatewaySession>();
    const shouldShowCurrentGame = showCurrentGame ?? true;

    for (const session of sessions) {
        if (!isRealGatewaySessionId(session.session_id)) continue;
        serialized.set(session.session_id!, session.toPrivateGatewayDeviceInfo(shouldShowCurrentGame));
    }

    return [...serialized.values()];
}
