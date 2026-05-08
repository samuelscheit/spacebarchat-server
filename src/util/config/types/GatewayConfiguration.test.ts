import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
    DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS,
    DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT,
    GATEWAY_HEARTBEAT_INTERVAL,
    GatewayConfiguration,
    isValidGatewayDisconnectedSessionCleanupDelay,
    isValidGatewayHeartbeatTimeout,
    isValidGuildSyncMemberMode,
} from "./GatewayConfiguration";

describe("GatewayConfiguration", () => {
    it("keeps endpoint settings and adds heartbeat timeout defaults", () => {
        const config = new GatewayConfiguration();

        assert.equal(config.endpointPrivate, null);
        assert.equal(config.endpointPublic, null);
        assert.equal(config.heartbeatTimeout, DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT);
        assert.equal(config.lazyMemberListIncludeOffline, true);
        assert.equal(config.disconnectedSessionCleanupDelayMs, DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS);
        assert.equal(config.guildSyncMemberMode, "all");
        assert.equal(config.privilegedIntents, null);
        assert.equal(DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT, 45_000);
        assert.equal(GATEWAY_HEARTBEAT_INTERVAL, 30_000);
        assert.equal(DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS, 10_000);
    });

    it("documents the lazy member list offline default in the example config", () => {
        const config = JSON.parse(readFileSync("config.example.json", "utf8")) as {
            gateway?: {
                lazyMemberListIncludeOffline?: unknown;
            };
        };

        assert.equal(config.gateway?.lazyMemberListIncludeOffline, true);
    });

    it("rejects timeout values that would close before the advertised heartbeat interval", () => {
        assert.equal(isValidGatewayHeartbeatTimeout(GATEWAY_HEARTBEAT_INTERVAL + 1), true);
        assert.equal(isValidGatewayHeartbeatTimeout(GATEWAY_HEARTBEAT_INTERVAL), false);
        assert.equal(isValidGatewayHeartbeatTimeout(0), false);
        assert.equal(isValidGatewayHeartbeatTimeout(-1), false);
        assert.equal(isValidGatewayHeartbeatTimeout(null), false);
        assert.equal(isValidGatewayHeartbeatTimeout(Number.NaN), false);
        assert.equal(isValidGatewayHeartbeatTimeout(Number.POSITIVE_INFINITY), false);
        assert.equal(isValidGatewayHeartbeatTimeout("45000"), false);
    });

    it("allows immediate or delayed disconnected session cleanup", () => {
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay(0), true);
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay(10_000), true);
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay(-1), false);
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay(null), false);
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay(Number.NaN), false);
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay(Number.POSITIVE_INFINITY), false);
        assert.equal(isValidGatewayDisconnectedSessionCleanupDelay("0"), false);
    });

    it("accepts only supported guild sync member modes", () => {
        assert.equal(isValidGuildSyncMemberMode("all"), true);
        assert.equal(isValidGuildSyncMemberMode("online"), true);
        assert.equal(isValidGuildSyncMemberMode("offline"), false);
        assert.equal(isValidGuildSyncMemberMode(null), false);
    });

    it("keeps generated config schemas in sync with supported guild sync member modes", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8")) as Record<string, { enum?: string[]; properties?: Record<string, { $ref?: string }> }>;
        const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8")) as {
            components: { schemas: Record<string, { enum?: string[]; properties?: Record<string, { $ref?: string }> }> };
        };

        assert.deepEqual(schemas.GuildSyncMemberMode.enum, ["all", "online"]);
        assert.equal(schemas.GatewayConfiguration.properties?.guildSyncMemberMode?.$ref, "#/definitions/GuildSyncMemberMode");
        assert.deepEqual(openapi.components.schemas.GuildSyncMemberMode.enum, ["all", "online"]);
        assert.equal(openapi.components.schemas.GatewayConfiguration.properties?.guildSyncMemberMode?.$ref, "#/components/schemas/GuildSyncMemberMode");
    });
});
