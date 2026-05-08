"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
    combineRoutePaths,
    extractApiRateLimitRulesFromSource,
    parseRegexLiteral,
    parseRouteOptions,
    routePathFromFile,
    scanRouterCalls,
    splitTopLevelArguments,
    stripComments,
} = require("./lib");

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

    test("extracts direct emitted events from route handlers", () => {
        const source = `
            router.put(
                "/:user_id",
                route({ responses: { 204: {} } }),
                async (_req, res) => {
                    await emitEvent({
                        event: "CHANNEL_CREATE",
                        data: {},
                    });
                    emitEvent({
                        event: WSEvents.CHANNEL_RECIPIENT_ADD,
                        data: {},
                    });
                    await emitEvent(event);
                    return res.sendStatus(204);
                },
            );
        `;

        const calls = scanRouterCalls(source);

        assert.deepEqual(calls[0].routeMetadata.emittedEvents, ["CHANNEL_CREATE", "CHANNEL_RECIPIENT_ADD"]);
    });

    test("extracts API route rate-limit groups from middleware mounts", () => {
        const source = `
            app.use(rateLimit({ bucket: "global", ...global }));
            app.use("/guilds/:guild_id", rateLimit(routes.guild));
            app.use("/auth/register", rateLimit({ onlyIp: true, success: true, ...routes.auth.register }));
        `;

        assert.deepEqual(extractApiRateLimitRulesFromSource(source), [
            {
                group: "guild",
                configPath: "limits.rate.routes.guild",
                pathPrefix: "/guilds/:guild_id",
                sourceFile: "src/api/middlewares/RateLimit.ts",
                line: 3,
            },
            {
                group: "auth.register",
                configPath: "limits.rate.routes.auth.register",
                pathPrefix: "/auth/register",
                sourceFile: "src/api/middlewares/RateLimit.ts",
                line: 4,
            },
        ]);
    });

    test("expands known spread constants in route metadata arrays", () => {
        const options = parseRouteOptions(`route({ permission: [...PRIVATE_ARCHIVED_THREAD_PERMISSIONS] })`);

        assert.deepEqual(options.permission, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "MANAGE_THREADS"]);
    });

    test("strips comments without dropping the following array entry", () => {
        const source = `
            // public auth routes
            "POST /auth/login",
            "POST /auth/register",
            // token-auth routes
            /^(GET|POST) \\/webhooks\\/\\d+\\/\\w+\\/?/,
            "GET /-/readyz",
        `;

        assert.deepEqual(splitTopLevelArguments(stripComments(source)), [
            '"POST /auth/login"',
            '"POST /auth/register"',
            "/^(GET|POST) \\/webhooks\\/\\d+\\/\\w+\\/?/",
            '"GET /-/readyz"',
        ]);
    });

    test("parses regex literals with slash characters inside character classes", () => {
        const regex = parseRegexLiteral(String.raw`/^(GET|HEAD) \/imageproxy\/[A-Za-z0-9+/]\/\d+x\d+\/.+/,`);

        assert.ok(regex);
        assert.equal(regex.test("GET /imageproxy/+/32x32/https://example.invalid/a.png"), true);
    });
});
