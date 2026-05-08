import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DataSource, EntitySchema } from "typeorm";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../../../test/fixtures/database";
import { ReadStateFlags } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import {
    advanceOnlyNotificationCursorSql,
    applyMessageAcknowledgeToReadState,
    getAdvanceOnlyNotificationCursorCondition,
    shouldAdvanceNotificationCursor,
    type AcknowledgeableReadState,
} from "./ReadStateAck";

interface ReadStateAckSqlEntity {
    id: string;
    notifications_cursor?: string | null;
}

const readStateAckSqlEntity = new EntitySchema<ReadStateAckSqlEntity>({
    name: "ReadStateAckSqlEntity",
    tableName: "read_states",
    columns: {
        id: {
            type: String,
            primary: true,
        },
        notifications_cursor: {
            type: String,
            nullable: true,
        },
    },
});

async function buildAdvanceOnlyNotificationCursorUpdateSql(): Promise<string> {
    const dataSource = new DataSource({
        type: "postgres",
        entities: [readStateAckSqlEntity],
    });
    await (dataSource as DataSource & { buildMetadatas(): Promise<void> }).buildMetadatas();

    return dataSource
        .createQueryBuilder()
        .update(readStateAckSqlEntity)
        .set({ notifications_cursor: "1000" })
        .where(getAdvanceOnlyNotificationCursorCondition("read-state-id", "1000"))
        .getQuery();
}

async function createReadStateAckDataSource(databaseUrl: string): Promise<DataSource> {
    const dataSource = new DataSource({
        type: "postgres",
        url: databaseUrl,
        entities: [readStateAckSqlEntity],
        synchronize: true,
    });

    return dataSource.initialize();
}

describe("message ACK read-state updates", () => {
    test("persists modern ACK cursor fields used by READY read_state", () => {
        const readState = {
            last_message_id: "1000",
            mention_count: 4,
            last_viewed: 1,
            flags: 0,
        };

        applyMessageAcknowledgeToReadState(readState, "2000", {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });

        assert.deepEqual(readState, {
            last_message_id: "2000",
            mention_count: 0,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });
    });

    test("preserves existing optional ACK cursor fields when the client omits them", () => {
        const readState = {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        };

        applyMessageAcknowledgeToReadState(readState, "2000", {});

        assert.deepEqual(readState, {
            last_message_id: "2000",
            mention_count: 0,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        });
    });

    test("defaults sparse read states to modern READY-compatible cursor values", () => {
        const readState: AcknowledgeableReadState = {};

        applyMessageAcknowledgeToReadState(readState, "2000", {});

        assert.deepEqual(readState, {
            last_message_id: "2000",
            mention_count: 0,
            last_viewed: 0,
            flags: 0,
        });
    });

    test("detects notification cursor initialization and advancement", () => {
        assert.equal(shouldAdvanceNotificationCursor(undefined, "1000"), true);
        assert.equal(shouldAdvanceNotificationCursor(null, "1000"), true);
        assert.equal(shouldAdvanceNotificationCursor("999", "1000"), true);
    });

    test("detects equal or older notification cursors as non-advancing", () => {
        assert.equal(shouldAdvanceNotificationCursor("1000", "1000"), false);
        assert.equal(shouldAdvanceNotificationCursor("1001", "1000"), false);
    });

    test("builds an atomic advance-only notification cursor update condition", () => {
        const condition = getAdvanceOnlyNotificationCursorCondition("read-state-id", "1000");

        assert.equal(condition.id, "read-state-id");
        assert.equal(typeof condition.notifications_cursor, "object");
        assert.equal(
            condition.notifications_cursor.getSql?.("notifications_cursor"),
            "(notifications_cursor IS NULL OR CAST(notifications_cursor AS bigint) < CAST(:messageId AS bigint))",
        );
        assert.deepEqual(condition.notifications_cursor.objectLiteralParameters, { messageId: "1000" });
        assert.equal(
            advanceOnlyNotificationCursorSql("notifications_cursor"),
            "(notifications_cursor IS NULL OR CAST(notifications_cursor AS bigint) < CAST(:messageId AS bigint))",
        );
    });

    test("keeps the notification cursor OR condition scoped to the read-state id", async () => {
        const sql = await buildAdvanceOnlyNotificationCursorUpdateSql();

        assert.match(sql, /WHERE \("id" = :orm_param_\d+ AND \("notifications_cursor" IS NULL OR CAST\("notifications_cursor" AS bigint\) < CAST\(:messageId AS bigint\)\)\)/);
        assert.doesNotMatch(sql, /AND "notifications_cursor" IS NULL OR/);
    });

    test("updates the notification cursor only for the target read-state and never rewinds it", { skip: !hasPostgresAdminUrl() }, async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_ack_cursor" });
        let dataSource: DataSource | undefined;

        try {
            dataSource = await createReadStateAckDataSource(database.url);
            const readStates = dataSource.getRepository(readStateAckSqlEntity);

            await readStates.insert([
                { id: "target-read-state", notifications_cursor: "1000" },
                { id: "other-read-state", notifications_cursor: "1500" },
            ]);

            const advance = await readStates.update(getAdvanceOnlyNotificationCursorCondition("target-read-state", "2000"), { notifications_cursor: "2000" });
            assert.equal(advance.affected, 1);

            assert.equal((await readStates.findOneByOrFail({ id: "target-read-state" })).notifications_cursor, "2000");
            assert.equal((await readStates.findOneByOrFail({ id: "other-read-state" })).notifications_cursor, "1500");

            const rewind = await readStates.update(getAdvanceOnlyNotificationCursorCondition("target-read-state", "1200"), { notifications_cursor: "1200" });
            assert.equal(rewind.affected, 0);
            assert.equal((await readStates.findOneByOrFail({ id: "target-read-state" })).notifications_cursor, "2000");
        } finally {
            if (dataSource?.isInitialized) await dataSource.destroy();
            await database.close();
        }
    });
});
