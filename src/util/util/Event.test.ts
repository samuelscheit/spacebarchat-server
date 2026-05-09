import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import { type Channel, type ChannelModel } from "amqplib";
import { emitEvent, events, getEventBusRouteId, listenEvent, SPACEBAR_EVENT_ROUTE, type EventOpts } from "./Event.js";
import { RabbitMQ } from "./RabbitMQ.js";

const originalProcessSend = process.send;
const originalEventTransmission = process.env.EVENT_TRANSMISSION;
const originalEventSocketPath = process.env.EVENT_SOCKET_PATH;

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

function emitProcessMessage(message: unknown) {
    process.emit("message", message, undefined);
}

afterEach(() => {
    events.removeAllListeners();
    RabbitMQ.connection = null;
    RabbitMQ.channel = null;
    process.send = originalProcessSend;
    restoreEnv("EVENT_TRANSMISSION", originalEventTransmission);
    restoreEnv("EVENT_SOCKET_PATH", originalEventSocketPath);
});

test("event bus route helper prefers internal Spacebar routes over public Discord routes", () => {
    assert.equal(
        getEventBusRouteId({
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            guild_id: "0",
        }),
        SPACEBAR_EVENT_ROUTE,
    );
    assert.equal(getEventBusRouteId({ guild_id: "guild" }), "guild");
    assert.equal(getEventBusRouteId({ channel_id: "channel" }), "channel");
    assert.equal(getEventBusRouteId({ user_id: "user" }), "user");
    assert.equal(getEventBusRouteId({ session_id: "session" }), "session");
    assert.equal(getEventBusRouteId({}), undefined);
});

test("internal spacebar events are routed to the shared config reload listener route", async () => {
    const received: unknown[] = [];
    const cancel = await listenEvent(SPACEBAR_EVENT_ROUTE, (event) => {
        received.push({
            event: event.event,
            spacebar_event_id: event.spacebar_event_id,
            data: event.data,
            origin: event.origin,
        });
    });

    try {
        await emitEvent({
            event: "SB_RELOAD_CONFIG",
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            data: {},
            origin: "test",
        });
    } finally {
        await cancel();
    }

    assert.deepEqual(received, [
        {
            event: "SB_RELOAD_CONFIG",
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            data: {},
            origin: "test",
        },
    ]);
});

describe("listenEvent process transmission", () => {
    test("delivers well-formed process events for the subscribed id", async () => {
        process.env.EVENT_TRANSMISSION = "process";
        const received: EventOpts[] = [];
        const cancel = await listenEvent("guild-1", (event) => received.push(event));

        try {
            emitProcessMessage({
                type: "event",
                id: "guild-1",
                event: {
                    event: "SB_RELOAD_CONFIG",
                    guild_id: "guild-1",
                    data: { reload: true },
                },
            });

            assert.equal(received.length, 1);
            assert.equal(received[0].event, "SB_RELOAD_CONFIG");
            assert.deepEqual(received[0].data, { reload: true });
            assert.equal(typeof received[0].cancel, "function");
        } finally {
            await cancel();
        }
    });

    test("ignores malformed and unrelated process messages", async () => {
        process.env.EVENT_TRANSMISSION = "process";
        const received: EventOpts[] = [];
        const cancel = await listenEvent("guild-1", (event) => received.push(event));

        try {
            emitProcessMessage(null);
            emitProcessMessage({});
            emitProcessMessage({ type: "event", id: "guild-1" });
            emitProcessMessage({ type: "event", id: "guild-1", event: { data: {} } });
            emitProcessMessage({ type: "event", id: "guild-1", event: { event: "NOT_A_SPACEBAR_EVENT", guild_id: "guild-1" } });
            emitProcessMessage({ type: "event", id: "guild-1", event: [{ event: "SB_RELOAD_CONFIG" }] });
            emitProcessMessage({ type: "spacebar:startupFailure", serviceName: "API server" });
            emitProcessMessage({ type: "event", id: "guild-2", event: { event: "SB_RELOAD_CONFIG", guild_id: "guild-2" } });

            assert.deepEqual(received, []);
        } finally {
            await cancel();
        }
    });

    test("cancel removes the registered process message listener", async () => {
        process.env.EVENT_TRANSMISSION = "process";
        const initialListenerCount = process.listenerCount("message");
        const received: EventOpts[] = [];
        const cancel = await listenEvent("guild-1", (event) => received.push(event));

        assert.equal(process.listenerCount("message"), initialListenerCount + 1);

        await cancel();

        assert.equal(process.listenerCount("message"), initialListenerCount);

        emitProcessMessage({
            type: "event",
            id: "guild-1",
            event: {
                event: "SB_RELOAD_CONFIG",
                guild_id: "guild-1",
                data: { reload: true },
            },
        });

        assert.deepEqual(received, []);
    });
});

test("process transport sends and cancels internal Spacebar route listeners", async () => {
    process.env.EVENT_TRANSMISSION = "process";
    const received: unknown[] = [];
    let sent: unknown;
    const messageListenersBefore = process.listenerCount("message");
    process.send = ((message: unknown) => {
        sent = message;
        return true;
    }) as typeof process.send;

    const cancel = await listenEvent(SPACEBAR_EVENT_ROUTE, (event) => {
        received.push({
            event: event.event,
            spacebar_event_id: event.spacebar_event_id,
            data: event.data,
            origin: event.origin,
        });
    });

    assert.equal(process.listenerCount("message"), messageListenersBefore + 1);

    await emitEvent({
        event: "SB_RELOAD_CONFIG",
        spacebar_event_id: SPACEBAR_EVENT_ROUTE,
        data: {},
        origin: "process-test",
    });

    assert.deepEqual(sent, {
        type: "event",
        id: SPACEBAR_EVENT_ROUTE,
        event: {
            event: "SB_RELOAD_CONFIG",
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            data: {},
            origin: "process-test",
        },
    });

    emitProcessMessage(sent);
    await cancel();

    assert.equal(process.listenerCount("message"), messageListenersBefore);
    assert.deepEqual(received, [
        {
            event: "SB_RELOAD_CONFIG",
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            data: {},
            origin: "process-test",
        },
    ]);
});

test("RabbitMQ transport publishes internal Spacebar events to the shared exchange", async () => {
    const published: unknown[] = [];
    const exchanges: unknown[] = [];
    const fakeChannel = {
        async assertExchange(id: string, type: string, options: unknown) {
            exchanges.push({ id, type, options });
        },
        publish(exchange: string, routingKey: string, body: Buffer, options: unknown) {
            published.push({
                exchange,
                routingKey,
                body: body.toString("utf8"),
                options,
            });
            return true;
        },
    } as unknown as Channel;

    RabbitMQ.connection = {} as ChannelModel;
    RabbitMQ.channel = fakeChannel;

    await emitEvent({
        event: "SB_RELOAD_CONFIG",
        spacebar_event_id: SPACEBAR_EVENT_ROUTE,
        data: {},
        origin: "rabbit-test",
    });

    assert.deepEqual(exchanges, [
        {
            id: SPACEBAR_EVENT_ROUTE,
            type: "fanout",
            options: { durable: false },
        },
    ]);
    assert.deepEqual(published, [
        {
            exchange: SPACEBAR_EVENT_ROUTE,
            routingKey: "",
            body: "{}",
            options: {
                type: "SB_RELOAD_CONFIG",
                contentType: "application/json",
            },
        },
    ]);
});

test("unix socket transport frames internal Spacebar events with the shared route", async () => {
    const code = String.raw`
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function waitFor(predicate, message) {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(message);
}

(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-event-unix-"));
    const configPath = path.join(dir, "config.json");
    await fs.writeFile(
        configPath,
        JSON.stringify({
            general: { serverName: "localhost" },
            api: { endpointPublic: "http://localhost:3001/api/v9" },
            cdn: { endpointPublic: "http://localhost:3001", endpointPrivate: "http://localhost:3001" },
            gateway: { endpointPublic: "ws://localhost:3001" },
        }),
    );
    process.env.EVENT_TRANSMISSION = "unix";
    process.env.EVENT_SOCKET_PATH = dir;
    process.env.CONFIG_PATH = configPath;

    const { emitEvent, initEvent, listenEvent, SPACEBAR_EVENT_ROUTE } = require(process.env.SPACEBAR_EVENT_TEST_MODULE);
    const received = [];
    const cancel = await listenEvent(SPACEBAR_EVENT_ROUTE, (event) => {
        if (event.origin === "unix-test") {
            received.push({
                event: event.event,
                spacebar_event_id: event.spacebar_event_id,
                data: event.data,
                origin: event.origin,
            });
        }
    });

    await waitFor(async () => {
        try {
            await fs.access(path.join(dir, process.pid + ".sock"));
            return true;
        } catch {
            return false;
        }
    }, "unix listener socket was not created");

    await initEvent();
    await new Promise((resolve) => setTimeout(resolve, 100));

    for (let attempt = 0; attempt < 5 && received.length === 0; attempt++) {
        await emitEvent({
            event: "SB_RELOAD_CONFIG",
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            data: {},
            origin: "unix-test",
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await waitFor(() => received.length > 0, "unix listener did not receive internal Spacebar event");
    await cancel();
    await fs.rm(dir, { recursive: true, force: true });
    console.log("RESULT:" + JSON.stringify({ received: received.slice(0, 1) }));
    process.exit(0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    const result = await runNode(code);
    assert.equal(result.code, 0, result.stderr || result.stdout);

    const resultLine = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("RESULT:"));
    assert.ok(resultLine, result.stdout);
    assert.deepEqual(JSON.parse(resultLine.slice("RESULT:".length)), {
        received: [
            {
                event: "SB_RELOAD_CONFIG",
                spacebar_event_id: SPACEBAR_EVENT_ROUTE,
                data: {},
                origin: "unix-test",
            },
        ],
    });
});

async function runNode(code: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return await new Promise((resolve) => {
        const child = spawn(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", code], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                SPACEBAR_EVENT_TEST_MODULE: path.join(__dirname, "Event.js"),
            },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("close", (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}
