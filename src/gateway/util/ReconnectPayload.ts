import { OPCODES, Payload } from "./Constants";

export function createReconnectPayload(reconnectDelay: number = 1000, sequence?: number): Payload {
    return {
        op: OPCODES.Reconnect,
        ...(sequence === undefined ? {} : { s: sequence }),
        d: reconnectDelay,
    };
}
