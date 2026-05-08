import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Session, VoiceState } from "@spacebar/util";

import { CLOSECODES } from "./Constants";
import { cleanupOnStartup } from "./Utils";

type HandleOffloadedGatewayRequest = typeof import("./Utils").handleOffloadedGatewayRequest;

function loadUtilsWithStubbedUtil() {
    const moduleCtor = module.constructor as typeof module.constructor & {
        _load(request: string, parent: NodeModule | null, isMain: boolean): unknown;
    };
    const originalLoad = moduleCtor._load;
    const utilsModulePath = require.resolve("./Utils");
    const originalUtilsModule = require.cache[utilsModulePath];

    moduleCtor._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
        if (request === "@spacebar/util") return {};

        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[utilsModulePath];
        return require("./Utils") as { handleOffloadedGatewayRequest: HandleOffloadedGatewayRequest };
    } finally {
        moduleCtor._load = originalLoad;
        if (originalUtilsModule) {
            require.cache[utilsModulePath] = originalUtilsModule;
        } else {
            delete require.cache[utilsModulePath];
        }
    }
}

describe("handleOffloadedGatewayRequest", () => {
    test("closes the gateway socket for offloaded SB_GW_CLOSE responses", async () => {
        const { handleOffloadedGatewayRequest } = loadUtilsWithStubbedUtil();
        const originalFetch = globalThis.fetch;
        const closeCalls: Array<{ code?: number; reason?: string }> = [];
        let request: { url: string; init?: RequestInit } | undefined;

        try {
            globalThis.fetch = (async (url: string, init?: RequestInit) => {
                request = { url, init };
                return new Response(
                    JSON.stringify([
                        {
                            event: "SB_GW_CLOSE",
                            data: { code: CLOSECODES.Invalid_shard, reason: "invalid shard" },
                        },
                    ]),
                    {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    },
                );
            }) as typeof fetch;

            const socket = {
                accessToken: "token",
                session_id: "session",
                sequence: 0,
                close(code?: number, reason?: string) {
                    closeCalls.push({ code, reason });
                },
            };

            await handleOffloadedGatewayRequest(socket as never, "http://offload.example/identify", { token: "token" });

            assert.deepEqual(closeCalls, [{ code: CLOSECODES.Invalid_shard, reason: "invalid shard" }]);
            assert.equal(socket.sequence, 0);
            assert.equal(request?.url, "http://offload.example/identify");
            assert.equal((request?.init?.headers as Record<string, string>)?.Authorization, "Bearer token");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("uses Unknown_error when SB_GW_CLOSE omits a numeric close code", async () => {
        const { handleOffloadedGatewayRequest } = loadUtilsWithStubbedUtil();
        const originalFetch = globalThis.fetch;
        const closeCalls: Array<{ code?: number; reason?: string }> = [];

        try {
            globalThis.fetch = (async () =>
                new Response(JSON.stringify([{ event: "SB_GW_CLOSE", data: { code: "4010" } }]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                })) as typeof fetch;

            await handleOffloadedGatewayRequest(
                {
                    accessToken: "token",
                    session_id: "session",
                    sequence: 0,
                    close(code?: number, reason?: string) {
                        closeCalls.push({ code, reason });
                    },
                } as never,
                "http://offload.example/identify",
                {},
            );

            assert.deepEqual(closeCalls, [{ code: CLOSECODES.Unknown_error, reason: undefined }]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

type StreamedSessionRow = {
    session_last_seen: Date;
    session_session_id: string;
};

function createSessionStreamQuery(rows: StreamedSessionRow[]) {
    return {
        where(condition: string) {
            assert.equal(condition, "last_seen >= '2000/01/01' AND status != 'offline'");
            return this;
        },
        select() {
            return this;
        },
        async *stream() {
            for (const row of rows) yield row;
        },
    };
}

describe("cleanupOnStartup", () => {
    test("expires old presences without wiping voice states", async (t) => {
        const staleSession = {
            session_last_seen: new Date(Date.now() - 31 * 60 * 1000),
            session_session_id: "stale-session",
        };
        const freshSession = {
            session_last_seen: new Date(),
            session_session_id: "fresh-session",
        };

        const voiceStateClear = t.mock.method(VoiceState, "clear", async () => {
            throw new Error("startup must not clear active voice states");
        });
        const createQueryBuilder = t.mock.method(Session, "createQueryBuilder", () => createSessionStreamQuery([staleSession, freshSession]));
        const updateSession = t.mock.method(Session, "update", async () => ({ affected: 1, generatedMaps: [], raw: [] }));

        await cleanupOnStartup();

        assert.equal(voiceStateClear.mock.callCount(), 0);
        assert.equal(createQueryBuilder.mock.callCount(), 1);
        assert.equal(updateSession.mock.callCount(), 1);
        assert.deepEqual(updateSession.mock.calls[0].arguments, [{ session_id: "stale-session" }, { status: "offline" }]);
    });
});
