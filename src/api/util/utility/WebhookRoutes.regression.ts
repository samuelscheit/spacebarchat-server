import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

type Restore = () => void;

const restoreCallbacks: Restore[] = [];

function stub<T extends object, K extends keyof T>(object: T, key: K, value: T[K]) {
    const original = object[key];
    object[key] = value;
    restoreCallbacks.push(() => {
        object[key] = original;
    });
}

afterEach(() => {
    while (restoreCallbacks.length) restoreCallbacks.pop()?.();
});

function getUtil() {
    return require("../../../util/index.js") as typeof import("../../../util/index.js");
}

function getPermissionUtil() {
    return require("../../../util/util/Permissions.js") as typeof import("../../../util/util/Permissions.js");
}

function getEventUtil() {
    return require("../../../util/util/Event.js") as typeof import("../../../util/util/Event.js");
}

function stubWebhookConfig(util: ReturnType<typeof getUtil>) {
    stub(util.Config, "get", (() => ({
        api: { endpointPublic: "https://api.example.test" },
        limits: { message: { maxAttachmentSize: 1024 }, user: { maxUsername: 32 } },
        user: { blockedContains: [], blockedEquals: [] },
    })) as unknown as typeof util.Config.get);
}

function getWebhookRouteHandler(method: "patch", route: "authenticated" | "token") {
    const routeModule = route === "authenticated" ? require("../../routes/webhooks/#webhook_id/index.js") : require("../../routes/webhooks/#webhook_id/#token/index.js");
    let routerCandidate = routeModule;
    while (routerCandidate && !routerCandidate.stack && routerCandidate.default && routerCandidate.default !== routerCandidate) {
        routerCandidate = routerCandidate.default;
    }

    const router: {
        stack: { route?: { methods: Record<string, boolean>; stack: { handle: (req: unknown, res: unknown) => Promise<void> }[] } }[];
    } = routerCandidate;
    const layer = router.stack.find((entry: { route?: { methods: Record<string, boolean> } }) => entry.route?.methods[method]);

    assert.ok(layer?.route, `missing ${route} ${method} route`);
    return layer.route.stack.at(-1)!.handle as (req: unknown, res: unknown) => Promise<void>;
}

function createWebhook(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: "webhook-id",
        type: 1,
        token: "valid-token",
        channel_id: "old-channel-id",
        guild_id: "guild-id",
        name: "webhook",
        avatar: null,
        channel: {
            guild_id: "guild-id",
        },
        assign(props: object) {
            Object.assign(this, props);
            return this;
        },
        async save() {},
        ...overrides,
    };
}

function createResponse() {
    return {
        body: undefined as unknown,
        statusCode: undefined as number | undefined,
        json(body: unknown) {
            this.body = body;
            return this;
        },
        sendStatus(statusCode: number) {
            this.statusCode = statusCode;
            return this;
        },
    };
}

describe("webhook routes", () => {
    test("saves authenticated webhook updates before emitting webhook update events", async () => {
        const util = getUtil();
        const permissions = getPermissionUtil();
        const eventUtil = getEventUtil();
        const actions: string[] = [];
        const webhook = createWebhook({
            async save() {
                actions.push("save");
            },
        });

        stubWebhookConfig(util);
        stub(util.Webhook, "findOneOrFail", (async () => webhook) as typeof util.Webhook.findOneOrFail);
        stub(permissions, "getPermission", (async () => ({ has: () => true })) as unknown as typeof permissions.getPermission);
        stub(eventUtil, "emitEvent", (async (event: { data: { channel_id: string } }) => {
            actions.push(`emit:${event.data.channel_id}`);
        }) as typeof eventUtil.emitEvent);

        const handler = await getWebhookRouteHandler("patch", "authenticated");
        const response = createResponse();

        await handler(
            {
                params: { webhook_id: "webhook-id" },
                body: { name: "renamed" },
                user_id: "user-id",
            },
            response,
        );

        assert.deepEqual(actions, ["save", "emit:old-channel-id"]);
        assert.equal((response.body as { id: string }).id, "webhook-id");
        assert.equal((response.body as { channel_id: string }).channel_id, "old-channel-id");
        assert.match((response.body as { url: string }).url, /\/webhooks\/webhook-id\/valid-token$/);
    });

    test("emits webhook update events for both old and new channels after moving a webhook", async () => {
        const util = getUtil();
        const permissions = getPermissionUtil();
        const eventUtil = getEventUtil();
        const actions: string[] = [];
        const webhook = createWebhook({
            async save() {
                actions.push("save");
            },
        });

        stubWebhookConfig(util);
        stub(util.Webhook, "findOneOrFail", (async () => webhook) as typeof util.Webhook.findOneOrFail);
        stub(util.Channel, "findOneOrFail", (async () => ({
            id: "new-channel-id",
            guild_id: "guild-id",
            type: 0,
            permission_overwrites: [],
        })) as typeof util.Channel.findOneOrFail);
        stub(permissions, "getPermission", (async () => ({ has: () => true })) as unknown as typeof permissions.getPermission);
        stub(eventUtil, "emitEvent", (async (event: { data: { channel_id: string } }) => {
            actions.push(`emit:${event.data.channel_id}`);
        }) as typeof eventUtil.emitEvent);

        const handler = await getWebhookRouteHandler("patch", "authenticated");

        await handler(
            {
                params: { webhook_id: "webhook-id" },
                body: { channel_id: "new-channel-id" },
                user_id: "user-id",
            },
            createResponse(),
        );

        assert.deepEqual(actions, ["save", "emit:old-channel-id", "emit:new-channel-id"]);
    });

    test("rejects token webhook updates before saving or emitting when the token does not match", async () => {
        const util = getUtil();
        const eventUtil = getEventUtil();
        const actions: string[] = [];
        const webhook = createWebhook({
            async save() {
                actions.push("save");
            },
        });

        stubWebhookConfig(util);
        stub(util.Webhook, "findOne", (async () => webhook) as typeof util.Webhook.findOne);
        stub(eventUtil, "emitEvent", (async (event: { data: { channel_id: string } }) => {
            actions.push(`emit:${event.data.channel_id}`);
        }) as typeof eventUtil.emitEvent);

        const handler = await getWebhookRouteHandler("patch", "token");

        await assert.rejects(() =>
            handler(
                {
                    params: { webhook_id: "webhook-id", token: "wrong-token" },
                    body: { name: "renamed" },
                },
                createResponse(),
            ),
        );

        assert.deepEqual(actions, []);
    });

    test("saves token webhook updates before emitting webhook update events", async () => {
        const util = getUtil();
        const eventUtil = getEventUtil();
        const actions: string[] = [];
        const webhook = createWebhook({
            async save() {
                actions.push("save");
            },
        });

        stubWebhookConfig(util);
        stub(util.Webhook, "findOne", (async () => webhook) as typeof util.Webhook.findOne);
        stub(eventUtil, "emitEvent", (async (event: { data: { channel_id: string } }) => {
            actions.push(`emit:${event.data.channel_id}`);
        }) as typeof eventUtil.emitEvent);

        const handler = await getWebhookRouteHandler("patch", "token");
        const response = createResponse();

        await handler(
            {
                params: { webhook_id: "webhook-id", token: "valid-token" },
                body: { name: "renamed", channel_id: "new-channel-id" },
            },
            response,
        );

        assert.deepEqual(actions, ["save", "emit:old-channel-id"]);
        assert.equal(webhook.channel_id, "old-channel-id");
        assert.equal((response.body as { id: string }).id, "webhook-id");
        assert.equal((response.body as { channel_id: string }).channel_id, "old-channel-id");
        assert.match((response.body as { url: string }).url, /\/webhooks\/webhook-id\/valid-token$/);
        assert.equal(response.statusCode, undefined);
    });
});
