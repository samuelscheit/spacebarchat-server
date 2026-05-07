import { CLOSECODES } from "./Constants";
import type { WebSocket } from "./WebSocket";
import type { RawData } from "ws";

export type GatewayMessageLimits = {
    maxMessageSize: number;
    rateLimitCount: number;
    rateLimitWindow: number;
};

export type GatewayMessageHandler = (data: RawData) => unknown;

const DEFAULT_GATEWAY_MESSAGE_LIMITS: GatewayMessageLimits = {
    maxMessageSize: 15 * 1024,
    rateLimitCount: 120,
    rateLimitWindow: 60_000,
};

const messageTimestamps = new WeakMap<WebSocket, number[]>();

export function getGatewayRawDataByteLength(data: RawData | string): number {
    if (typeof data === "string") return Buffer.byteLength(data);
    if (Buffer.isBuffer(data)) return data.byteLength;
    if (data instanceof ArrayBuffer) return data.byteLength;
    return data.reduce((total, item) => total + item.byteLength, 0);
}

export function normalizeGatewayMessageLimits(limits?: Partial<GatewayMessageLimits>): GatewayMessageLimits {
    return {
        maxMessageSize: limits?.maxMessageSize ?? DEFAULT_GATEWAY_MESSAGE_LIMITS.maxMessageSize,
        rateLimitCount: limits?.rateLimitCount ?? DEFAULT_GATEWAY_MESSAGE_LIMITS.rateLimitCount,
        rateLimitWindow: limits?.rateLimitWindow ?? DEFAULT_GATEWAY_MESSAGE_LIMITS.rateLimitWindow,
    };
}

export function getGatewayTransportMaxPayload(limits?: Partial<GatewayMessageLimits>) {
    return normalizeGatewayMessageLimits(limits).maxMessageSize;
}

export function createGatewayMessageGuard(limits?: Partial<GatewayMessageLimits>) {
    const normalized = normalizeGatewayMessageLimits(limits);

    return (socket: WebSocket, data: RawData | string, now = Date.now()) => {
        if (getGatewayRawDataByteLength(data) > normalized.maxMessageSize) {
            socket.close(CLOSECODES.Decode_error, "Gateway message exceeds maximum size");
            return false;
        }

        const windowStart = now - normalized.rateLimitWindow;
        const timestamps = (messageTimestamps.get(socket) ?? []).filter((timestamp) => timestamp > windowStart);
        if (timestamps.length >= normalized.rateLimitCount) {
            socket.close(CLOSECODES.Rate_limited, "Gateway message rate limit exceeded");
            return false;
        }

        timestamps.push(now);
        messageTimestamps.set(socket, timestamps);
        return true;
    };
}

export function createGatewayMessageHandler(socket: WebSocket, handler: GatewayMessageHandler, limits?: Partial<GatewayMessageLimits>) {
    const guard = createGatewayMessageGuard(limits);
    return async (data: RawData) => {
        if (!guard(socket, data)) return;
        return await handler(data);
    };
}
