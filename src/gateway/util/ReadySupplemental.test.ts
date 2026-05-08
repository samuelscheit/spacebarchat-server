import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { buildReadySupplementalData } from "./ReadySupplemental";
import type { Activity, Guild, GuildOrUnavailable, Session, VoiceState } from "@spacebar/util";

function guild(id: string, voiceStates: Partial<VoiceState>[] = []): Guild {
    return {
        id,
        voice_states: voiceStates,
    } as Guild;
}

type Shape = "null" | "boolean" | "number" | "string" | { type: "array"; items: Shape | "unknown"; variants?: Shape[] } | { type: "object"; keys: Record<string, Shape> };

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;

    return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
        .join(",")}}`;
}

function createShape(value: unknown): Shape {
    if (value === null) return "null";
    if (Array.isArray(value)) {
        const variants = uniqueShapes(value.map((item) => createShape(item)));
        if (!variants.length) return { type: "array", items: "unknown" };
        if (variants.length === 1) return { type: "array", items: variants[0] };

        return { type: "array", items: "unknown", variants };
    }

    switch (typeof value) {
        case "boolean":
            return "boolean";
        case "number":
            return "number";
        case "string":
            return "string";
        case "object":
            return {
                type: "object",
                keys: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, createShape(child)])),
            };
        default:
            return "string";
    }
}

function uniqueShapes(shapes: Shape[]): Shape[] {
    const seen = new Set<string>();
    const output: Shape[] = [];

    for (const shape of shapes) {
        const key = JSON.stringify(shape);
        if (seen.has(key)) continue;

        seen.add(key);
        output.push(shape);
    }

    return output;
}

function shapeHash(value: unknown): string {
    return `sha256:${createHash("sha256")
        .update(stableStringify(createShape(value)))
        .digest("hex")}`;
}

function session(userId: string, status: Session["status"], activity: Partial<Activity> = {}): Session {
    return {
        user_id: userId,
        status,
        activities: [activity as Activity],
        client_status: { web: status },
        getPublicStatus() {
            return status === "invisible" ? "offline" : status;
        },
    } as Session;
}

describe("READY_SUPPLEMENTAL payload", () => {
    test("keeps guild-indexed empty placeholders aligned with available guilds", () => {
        const payload = buildReadySupplementalData([guild("available-a"), { id: "unavailable", unavailable: true } as GuildOrUnavailable, guild("available-b")]);

        assert.deepEqual(
            payload.guilds.map((x) => x.id),
            ["available-a", "available-b"],
        );
        assert.deepEqual(payload.merged_members, [[], []]);
        assert.deepEqual(payload.merged_presences.guilds, [[], []]);
        assert.deepEqual(payload.merged_presences.friends, []);
        assert.deepEqual(payload.lazy_private_channels, []);
        assert.deepEqual(payload.disclose, ["pomelo"]);
        assert.deepEqual(payload.game_invites, []);
        assert.deepEqual(payload.user_activities, []);
        assert.deepEqual(payload.guilds[0].embedded_activities, []);
        assert.deepEqual(payload.guilds[0].activity_instances, []);
    });

    test("serializes friend presences from relationship sessions", () => {
        const payload = buildReadySupplementalData([guild("guild")], {
            friendIds: ["friend"],
            processedAt: new Date("2026-05-08T00:00:00.000Z"),
            sessions: [session("friend", "online", { id: "custom", name: "status", state: "samuelscheit.com", type: 4 }), session("blocked", "online")],
        });

        assert.deepEqual(payload.merged_presences.friends, [
            {
                activities: [{ id: "custom", name: "status", state: "samuelscheit.com", type: 4 }],
                client_status: { web: "online" },
                hidden_activities: [],
                processed_at_timestamp: "2026-05-08T00:00:00.000Z",
                restricted_application: null,
                status: "online",
                user_id: "friend",
            },
        ]);
    });

    test("does not expose offline or invisible friend sessions", () => {
        const payload = buildReadySupplementalData([guild("guild")], {
            friendIds: ["offline-friend", "invisible-friend"],
            sessions: [session("offline-friend", "offline", { name: "private", type: 4 }), session("invisible-friend", "invisible", { name: "hidden", type: 4 })],
        });

        assert.deepEqual(payload.merged_presences.friends, []);
    });

    test("matches the captured READY_SUPPLEMENTAL compatibility shape", () => {
        const payload = buildReadySupplementalData([guild("guild")], {
            friendIds: ["friend"],
            processedAt: new Date("2026-05-08T00:00:00.000Z"),
            sessions: [
                session("friend", "idle", {
                    content_classification: { data: null, loaded: true },
                    created_at: "2026-05-08T00:00:00.000Z",
                    id: "custom",
                    name: "status",
                    state: "samuelscheit.com",
                    type: 4,
                } as unknown as Partial<Activity>),
            ],
        });

        assert.equal(shapeHash({ op: 0, s: 2, t: "READY_SUPPLEMENTAL", d: payload }), "sha256:20f7f12876215f9cb7b67726824e3e32e11f0c0b7cd8aab1ce6a44281dddd82b");
    });

    test("serializes known voice states for each available supplemental guild", () => {
        const payload = buildReadySupplementalData([
            guild("guild", [
                {
                    channel_id: "voice",
                    guild_id: "guild",
                    session_id: "session",
                    user_id: "user",
                    toPublicVoiceState() {
                        return {
                            channel_id: this.channel_id,
                            guild_id: this.guild_id,
                            session_id: this.session_id,
                            user_id: this.user_id,
                        };
                    },
                } as VoiceState,
            ]),
        ]);

        assert.deepEqual(payload.guilds[0].voice_states, [
            {
                channel_id: "voice",
                guild_id: "guild",
                session_id: "session",
                user_id: "user",
            },
        ]);
    });
});
