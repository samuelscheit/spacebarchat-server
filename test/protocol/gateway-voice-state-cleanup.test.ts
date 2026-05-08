import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Session, VoiceState } from "@spacebar/util";
import { cleanupOnStartup } from "../../src/gateway/util/Utils";

describe("gateway voice-state startup cleanup", () => {
    test("expires stale presences without clearing voice-state rows", async (t) => {
        const staleSession = {
            session_last_seen: new Date(Date.now() - 31 * 60 * 1000),
            session_session_id: "stale-session",
        };
        const freshSession = {
            session_last_seen: new Date(),
            session_session_id: "fresh-session",
        };

        const voiceStateClear = t.mock.method(VoiceState, "clear", async () => {
            throw new Error("startup cleanup must not clear voice-state rows");
        });
        t.mock.method(Session, "createQueryBuilder", () => ({
            where(condition: string) {
                assert.equal(condition, "last_seen >= '2000/01/01' AND status != 'offline'");
                return this;
            },
            select() {
                return this;
            },
            async *stream() {
                yield staleSession;
                yield freshSession;
            },
        }));
        const updateSession = t.mock.method(Session, "update", async () => ({ affected: 1, generatedMaps: [], raw: [] }));

        await cleanupOnStartup();

        assert.equal(voiceStateClear.mock.callCount(), 0);
        assert.equal(updateSession.mock.callCount(), 1);
        assert.deepEqual(updateSession.mock.calls[0].arguments, [{ session_id: "stale-session" }, { status: "offline" }]);
    });
});
