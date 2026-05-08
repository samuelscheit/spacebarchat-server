"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { combineRoutePaths, parseRouteOptions, routePathFromFile, scanHashImageRouterCalls, scanRouterCalls } = require("./lib");

describe("testing manifest route helpers", () => {
    test("derives mounted paths with Spacebar route filename conventions", () => {
        const root = path.join("src", "api", "routes");

        assert.equal(routePathFromFile(root, path.join("src", "api", "routes", "channels", "#channel_id", "messages", "index.ts")), "/channels/:channel_id/messages");
        assert.equal(routePathFromFile(root, path.join("src", "api", "routes", "users", "@me", "index.ts")), "/users/@me");
        assert.equal(routePathFromFile(root, path.join("src", "api", "routes", "_spacebar", "cdn", "attachments.ts")), "/_spacebar/cdn/attachments");
    });

    test("combines filesystem route prefixes and local router paths", () => {
        assert.equal(combineRoutePaths("/channels/:channel_id/messages", "/:message_id"), "/channels/:channel_id/messages/:message_id");
        assert.equal(combineRoutePaths("/ping", "/"), "/ping/");
        assert.equal(combineRoutePaths("/", "/readyz"), "/readyz");
    });

    test("extracts router methods and route metadata without executing route modules", () => {
        const source = `
            const shared = route({ permission: "MANAGE_MESSAGES", requestBody: "MessageCreateSchema", responses: { 200: { body: "MessageResponse" } } });
            router.post("/", shared, handler);
            router.delete("/:message_id", route({ right: "MANAGE_MESSAGES", responses: { 204: {} } }), handler);
        `;

        const calls = scanRouterCalls(source);

        assert.deepEqual(
            calls.map((call) => [call.method, call.localPath]),
            [
                ["POST", "/"],
                ["DELETE", "/:message_id"],
            ],
        );
        assert.equal(calls[0].routeMetadata.permission, "MANAGE_MESSAGES");
        assert.equal(calls[0].routeMetadata.requestBody, "MessageCreateSchema");
        assert.deepEqual(calls[0].routeMetadata.responseBodies, ["MessageResponse"]);
        assert.equal(calls[1].routeMetadata.right, "MANAGE_MESSAGES");
        assert.deepEqual(calls[1].routeMetadata.responseStatuses, [204]);
    });

    test("parses array-valued route options", () => {
        const options = parseRouteOptions(`route({ permission: ["VIEW_CHANNEL", "SEND_MESSAGES"], event: [EVENT.MESSAGE_CREATE, EVENT.MESSAGE_UPDATE] })`);

        assert.deepEqual(options.permission, ["VIEW_CHANNEL", "SEND_MESSAGES"]);
        assert.deepEqual(options.event, ["EVENT.MESSAGE_CREATE", "EVENT.MESSAGE_UPDATE"]);
    });

    test("expands shared CDN image routers without executing route modules", () => {
        const source = `
            export default createHashImageRouter({
                pathPrefix: "role-icons",
                resourceParam: "role_id",
                allowedMimeTypes: STATIC_IMAGE_MIME_TYPES,
            });
        `;

        const calls = scanHashImageRouterCalls(source);

        assert.deepEqual(
            calls.map((call) => [call.method, call.localPath]),
            [
                ["POST", "/:role_id"],
                ["GET", "/:role_id"],
                ["GET", "/:role_id/:hash"],
                ["DELETE", "/:role_id/:id"],
            ],
        );
        assert.deepEqual(
            calls.map((call) => call.routeMetadata),
            [{ present: false }, { present: false }, { present: false }, { present: false }],
        );
    });
});
