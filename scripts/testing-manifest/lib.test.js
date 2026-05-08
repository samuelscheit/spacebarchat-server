"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const {
    collectExternalHelperEventMap,
    combineRoutePaths,
    extractApiRateLimitRulesFromSource,
    extractNoAuthorizationRulesFromSource,
    extractSourceHelperEventMap,
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

    test("extracts emitted events from same-file route helpers", () => {
        const source = `
            router.put(
                "/:user_id",
                route({ responses: { 204: {} } }),
                async (req, res) => updateRelationship(req, res),
            );

            async function updateRelationship(_req, res) {
                await Promise.all([
                    emitEvent({
                        event: "RELATIONSHIP_ADD",
                        data: {},
                    }),
                    emitEvent({
                        event: "RELATIONSHIP_REMOVE",
                        data: {},
                    }),
                ]);
                return res.sendStatus(204);
            }
        `;

        const calls = scanRouterCalls(source);

        assert.deepEqual(calls[0].routeMetadata.emittedEvents, ["RELATIONSHIP_ADD", "RELATIONSHIP_REMOVE"]);
    });

    test("extracts emitted events from imported entity and handler helpers", () => {
        const helpers = `
            export class Member {
                static async addRole() {
                    await emitEvent({ event: "GUILD_MEMBER_UPDATE", data: {} });
                }
            }

            export const executeWebhookWithOptions = async () => {
                await emitEvent({ event: "MESSAGE_CREATE", data: {} });
            };

            export const executeWebhook = executeWebhookWithOptions;
        `;
        const source = `
            router.put(
                "/roles/:role_id",
                route({ responses: { 204: {} } }),
                async (_req, res) => {
                    await Member.addRole("1", "2", "3");
                    return res.sendStatus(204);
                },
                executeWebhook,
            );
        `;

        const calls = scanRouterCalls(source, extractSourceHelperEventMap(helpers));

        assert.deepEqual(calls[0].routeMetadata.emittedEvents, ["GUILD_MEMBER_UPDATE", "MESSAGE_CREATE"]);
    });

    test("collects emitted events from imported utility helpers", () => {
        const repoRoot = mkdtempSync(path.join(tmpdir(), "spacebar-manifest-helpers-"));
        try {
            const utilityDir = path.join(repoRoot, "src", "api", "util", "utility");
            mkdirSync(utilityDir, { recursive: true });
            writeFileSync(
                path.join(utilityDir, "Messages.ts"),
                `
                    export function buildMessageDeleteBulkEvent() {
                        return {
                            event: "MESSAGE_DELETE_BULK",
                            data: {},
                        };
                    }

                    export async function deleteMessagesAndEmitBulkEvents() {
                        const emit = emitEvent;
                        await emit(buildMessageDeleteBulkEvent());
                    }
                `,
            );

            assert.deepEqual(collectExternalHelperEventMap(repoRoot).get("deleteMessagesAndEmitBulkEvents"), ["MESSAGE_DELETE_BULK"]);
        } finally {
            rmSync(repoRoot, { recursive: true, force: true });
        }
    });

    test("skips imported helper events when route call disables helper event emission", () => {
        const helpers = `
            export class Channel {
                static async createThreadChannel() {
                    await emitEvent({ event: "THREAD_CREATE", data: {} });
                    await emitEvent({ event: "THREAD_MEMBERS_UPDATE", data: {} });
                }
            }
        `;
        const source = `
            router.post(
                "/threads",
                route({ responses: { 200: {} } }),
                async (_req, res) => {
                    await Channel.createThreadChannel({}, {}, "1", { skipEventEmit: true });
                    await emitEvent({ event: "MESSAGE_CREATE", data: {} });
                    return res.json({});
                },
            );
        `;

        const calls = scanRouterCalls(source, extractSourceHelperEventMap(helpers));

        assert.deepEqual(calls[0].routeMetadata.emittedEvents, ["MESSAGE_CREATE"]);
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

    test("extracts no-authorization rules from the split middleware source", () => {
        const source = `
            export const NO_AUTHORIZATION_ROUTES = [
                "POST /auth/login",
                /^POST \\/interactions\\/\\d+\\/[A-Za-z0-9_-]+\\/callback/,
                "GET /-/readyz",
            ];
        `;

        const rules = extractNoAuthorizationRulesFromSource(source);

        assert.deepEqual(rules[0], { type: "string", value: "POST /auth/login" });
        assert.equal(rules[1].type, "regex");
        assert.equal(rules[1].value.test("POST /interactions/123/token_value/callback"), true);
        assert.deepEqual(rules[2], { type: "string", value: "GET /-/readyz" });
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
