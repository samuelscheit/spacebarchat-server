import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { Session } from "@spacebar/util";
import {
    expireUnusedLegacySessions,
    UNUSED_LEGACY_SESSION_ID_QUERY,
    UNUSED_LEGACY_SESSION_QUERY,
    UNUSED_LEGACY_SESSION_QUERY_PARAMETERS,
} from "../../src/api/util/handlers/Instance";

type LegacySessionRow = {
    session_created_at: Date;
    session_session_id: string;
};

function streamRows(rows: LegacySessionRow[]): AsyncIterable<LegacySessionRow> {
    return {
        async *[Symbol.asyncIterator]() {
            yield* rows;
        },
    };
}

test("legacy session cleanup expires only old non-auth sessions", async (t) => {
    const now = new Date("2026-05-08T12:00:00.000Z");
    const oldTemporarySession = {
        session_created_at: new Date("2026-05-08T10:59:59.000Z"),
        session_session_id: "TEMP_legacy-old",
    };
    const oldAllSession = {
        session_created_at: new Date("2026-05-08T10:30:00.000Z"),
        session_session_id: "all",
    };
    const exactlyOneHourTemporarySession = {
        session_created_at: new Date("2026-05-08T11:00:00.000Z"),
        session_session_id: "TEMP_legacy-boundary",
    };
    const recentTemporarySession = {
        session_created_at: new Date("2026-05-08T11:30:00.000Z"),
        session_session_id: "TEMP_legacy-recent",
    };
    const currentAuthSessionWithEpochLastSeen = {
        session_created_at: new Date("2026-05-08T10:00:00.000Z"),
        session_session_id: "REAL_AUTH_SESSION",
    };

    const queryBuilder = {
        where: t.mock.fn((_query: string, _parameters: Record<string, string>) => queryBuilder),
        andWhere: t.mock.fn((_query: string, _parameters: Record<string, string>) => queryBuilder),
        select: t.mock.fn(() => queryBuilder),
        stream: t.mock.fn(async () =>
            streamRows([oldTemporarySession, oldAllSession, exactlyOneHourTemporarySession, recentTemporarySession, currentAuthSessionWithEpochLastSeen]),
        ),
    };

    const createQueryBuilderMock = t.mock.method(Session, "createQueryBuilder", () => queryBuilder as unknown as ReturnType<typeof Session.createQueryBuilder>);
    const deleteMock = t.mock.method(Session, "delete", async () => ({ affected: 1, raw: [] }));
    const clearMock = t.mock.method(Session, "clear", async () => {
        throw new Error("legacy session cleanup must not clear all sessions");
    });

    await expireUnusedLegacySessions(now);

    assert.equal(createQueryBuilderMock.mock.callCount(), 1);
    assert.deepEqual(createQueryBuilderMock.mock.calls[0].arguments, ["session"]);
    assert.equal(queryBuilder.where.mock.callCount(), 1);
    assert.deepEqual(queryBuilder.where.mock.calls[0].arguments, [UNUSED_LEGACY_SESSION_QUERY, { lastSeen: UNUSED_LEGACY_SESSION_QUERY_PARAMETERS.lastSeen }]);
    assert.equal(queryBuilder.andWhere.mock.callCount(), 1);
    assert.deepEqual(queryBuilder.andWhere.mock.calls[0].arguments, [
        UNUSED_LEGACY_SESSION_ID_QUERY,
        {
            allSessionId: UNUSED_LEGACY_SESSION_QUERY_PARAMETERS.allSessionId,
            temporarySessionPattern: UNUSED_LEGACY_SESSION_QUERY_PARAMETERS.temporarySessionPattern,
        },
    ]);
    assert.equal(queryBuilder.select.mock.callCount(), 1);
    assert.equal(queryBuilder.stream.mock.callCount(), 1);
    assert.equal(clearMock.mock.callCount(), 0);
    assert.deepEqual(
        deleteMock.mock.calls.map((call) => call.arguments),
        [[{ session_id: oldTemporarySession.session_session_id }], [{ session_id: oldAllSession.session_session_id }]],
    );
});

test("instance startup does not clear clustered authentication sessions", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "api", "util", "handlers", "Instance.ts"), "utf8");

    assert.doesNotMatch(source, /Session\.clear\s*\(/);
    assert.doesNotMatch(source, /Like\("TEMP_%"\)/);
    assert.match(source, /isRealGatewaySessionId/);
    assert.match(source, /expireUnusedLegacySessions/);
});
