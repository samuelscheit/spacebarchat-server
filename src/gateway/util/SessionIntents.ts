import { Intents } from "@spacebar/util";

export type GatewayIntentSession = {
    gateway_intents?: string | number | bigint | Intents | null;
};

export function getSessionGatewayIntents(session: GatewayIntentSession | undefined) {
    return new Intents(session?.gateway_intents ?? 0);
}

export function setSessionGatewayIntents(session: GatewayIntentSession, intents: Intents) {
    session.gateway_intents = intents.bitfield.toString();
}
