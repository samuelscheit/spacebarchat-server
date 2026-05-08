import assert from "node:assert/strict";
import { test } from "node:test";
import { Session, VoiceState } from "@spacebar/util";
import { cleanupOnStartup } from "./Utils";

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

test("cleanupOnStartup expires old presences without wiping voice states", async (t) => {
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
