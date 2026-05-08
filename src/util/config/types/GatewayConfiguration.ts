import { EndpointConfiguration } from "./EndpointConfiguration";

export const GATEWAY_HEARTBEAT_INTERVAL = 30_000;
export const DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT = 45_000;
export const DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS = 10_000;

export type PrivilegedIntentsConfiguration = number | string | null;

export function isValidGatewayHeartbeatTimeout(timeout: unknown): timeout is number {
    return typeof timeout === "number" && Number.isFinite(timeout) && timeout > GATEWAY_HEARTBEAT_INTERVAL;
}

export function isValidGatewayDisconnectedSessionCleanupDelay(delay: unknown): delay is number {
    return typeof delay === "number" && Number.isFinite(delay) && delay >= 0;
}

export class GatewayConfiguration extends EndpointConfiguration {
    heartbeatTimeout: number = DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT;
    disconnectedSessionCleanupDelayMs: number = DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS;
    /**
     * Bitmask of privileged gateway intents that should require bot application approval.
     *
     * Leave unset/null to preserve the historical Spacebar behavior of not enforcing
     * privileged intent approval during IDENTIFY. JSON configuration may use either
     * a number or a decimal/hex string for masks that exceed JavaScript's safe integer
     * range.
     */
    privilegedIntents: PrivilegedIntentsConfiguration = null;
}
