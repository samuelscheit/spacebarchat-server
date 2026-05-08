import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function readSource(path: string) {
    return readFileSync(join(process.cwd(), path), "utf8");
}

describe("user direct-message route", () => {
    test("delegates POST sends to the shared channel message creation handlers", () => {
        const source = readSource("src/api/routes/users/#user_id/messages.ts");

        assert.match(source, /import \{ createMessageRouteHandlers \} from "\.\.\/\.\.\/channels\/#channel_id\/messages\/index";/);
        assert.match(source, /Channel\.createDMChannel\(\[targetUser\.id\], req\.user_id\)/);
        assert.match(source, /req\.params\.channel_id = dmChannel\.id;/);
        assert.match(source, /router\.post\([\s\S]*\.\.\.createMessageRouteHandlers,[\s\S]*\);/);
        assert.doesNotMatch(source, /handleMessage\(/, "user route must not duplicate message creation internals");
        assert.doesNotMatch(source, /postHandleMessage\(/, "user route must not duplicate post-send side effects");
    });

    test("channel message route keeps canonical POST handlers exported and mounted", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/index.ts");

        assert.match(source, /export const createMessageRouteHandlers: RequestHandler\[\] = \[/);
        assert.match(source, /router\.post\("\/", \.\.\.createMessageRouteHandlers\);/);
    });
});
