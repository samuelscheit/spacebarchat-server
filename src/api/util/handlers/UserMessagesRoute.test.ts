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

        assert.match(
            source,
            /import \{ createMessageBodyRouteHandlers, createMessageResolvedChannelRouteHandlers \} from "\.\.\/\.\.\/\.\.\/util\/handlers\/ChannelMessageCreateRoute";/,
        );
        assert.doesNotMatch(source, /channels\/#channel_id\/messages\/index/, "user route must not import a route module with router registration side effects");
        assert.match(source, /Channel\.createDMChannel\(\[targetUser\.id\], req\.user_id\)/);
        assert.match(source, /req\.params\.channel_id = dmChannel\.id;/);
        assert.match(
            source,
            /router\.post\([\s\S]*\.\.\.createMessageBodyRouteHandlers,[\s\S]*Channel\.createDMChannel\(\[targetUser\.id\], req\.user_id\)[\s\S]*\.\.\.createMessageResolvedChannelRouteHandlers,[\s\S]*\);/,
            "user route must validate the message body and rights before creating/reopening the DM, then delegate send handling with permission hydration",
        );
        assert.doesNotMatch(source, /createMessageChannelRouteHandlers/, "user route must not expose canonical channel permission metadata for a dynamic DM route");
        assert.doesNotMatch(source, /handleMessage\(/, "user route must not duplicate message creation internals");
        assert.doesNotMatch(source, /postHandleMessage\(/, "user route must not duplicate post-send side effects");
    });

    test("shared message helper keeps canonical POST handlers exported and mounted by the channel route", () => {
        const helperSource = readSource("src/api/util/handlers/ChannelMessageCreateRoute.ts");
        const routeSource = readSource("src/api/routes/channels/#channel_id/messages/index.ts");

        assert.match(
            helperSource,
            /export const createMessageBodyRouteHandlers: RequestHandler\[\] = \[[\s\S]*createMessageUploadHandler,[\s\S]*normalizeMessageCreateRequestBody,[\s\S]*createMessageBodyRoute,[\s\S]*validateMessagePayloadLimits,[\s\S]*\];/,
        );
        assert.match(helperSource, /export const loadMessageChannelPermissions: RequestHandler = async/);
        assert.match(helperSource, /export const createMessageChannelRouteHandlers: RequestHandler\[\] = \[createMessagePermissionRoute, createMessageHandler\];/);
        assert.match(helperSource, /export const createMessageResolvedChannelRouteHandlers: RequestHandler\[\] = \[loadMessageChannelPermissions, createMessageHandler\];/);
        assert.match(
            helperSource,
            /export const createMessageRouteHandlers: RequestHandler\[\] = \[\.\.\.createMessageBodyRouteHandlers, \.\.\.createMessageChannelRouteHandlers\];/,
        );
        assert.match(routeSource, /import \{ createMessageRouteHandlers \} from "\.\.\/\.\.\/\.\.\/\.\.\/util\/handlers\/ChannelMessageCreateRoute";/);
        assert.match(routeSource, /router\.post\("\/", \.\.\.createMessageRouteHandlers\);/);
    });
});
