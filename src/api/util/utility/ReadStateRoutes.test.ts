import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function source(path: string) {
    return readFileSync(join(process.cwd(), path), "utf8");
}

describe("read-state route integrations", () => {
    test("channel message creation routes use the shared channel read-state helper", () => {
        const messageRoute = source("src/api/routes/channels/#channel_id/messages/index.ts");
        const threadRoute = source("src/api/routes/channels/#channel_id/threads.ts");
        const messageThreadRoute = source("src/api/routes/channels/#channel_id/messages/#message_id/threads.ts");

        assert.match(messageRoute, /upsertChannelMessageReadState\(\{\s*user_id:\s*req\.user_id,\s*channel_id\s*\},\s*message\.id\)/);
        assert.match(threadRoute, /upsertChannelMessageReadState\(\{\s*user_id:\s*req\.user_id,\s*channel_id:\s*thread\.id\s*\},\s*message\.id\)/);
        assert.match(messageThreadRoute, /upsertChannelMessageReadState\(\{\s*user_id:\s*req\.user_id,\s*channel_id:\s*thread\.id\s*\},\s*starterMessage\.id\)/);
        assert.doesNotMatch(messageThreadRoute, /TODO: advance-only notification cursor/);
    });

    test("acknowledgement routes use shared read-state cursor helpers", () => {
        const messageAckRoute = source("src/api/routes/channels/#channel_id/messages/#message_id/ack.ts");
        const bulkAckRoute = source("src/api/routes/read-states/ack-bulk.ts");

        assert.match(messageAckRoute, /upsertChannelMessageReadState\(\{\s*user_id:\s*req\.user_id,\s*channel_id\s*\},\s*message_id,\s*body\)/);
        assert.doesNotMatch(messageAckRoute, /TODO: advance-only notification cursor/);
        assert.match(bulkAckRoute, /upsertAckBulkReadState\(req\.user_id,\s*x\)/);
    });

    test("thread post-data route remains read-state neutral", () => {
        const postDataRoute = source("src/api/routes/channels/#channel_id/post-data.ts");

        assert.doesNotMatch(postDataRoute, /TODO: advance-only notification cursor/);
        assert.doesNotMatch(postDataRoute, /ReadState|upsertChannelMessageReadState|upsertAckBulkReadState/);
    });
});
