import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import EventEmitter from "node:events";
import amqp, { type Channel, type ChannelModel } from "amqplib";

type RabbitMQInternals = {
    connection: ChannelModel | null;
    channel: Channel | null;
    on(event: "reconnected" | "disconnected", listener: () => void): void;
    off(event: "reconnected" | "disconnected", listener: () => void): void;
    connect(host: string): Promise<void>;
    isConnected(): boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
    BASE_RECONNECT_DELAY_MS: number;
    reconnectTimer: NodeJS.Timeout | null;
};

class FakeConnection extends EventEmitter {
    channel = new EventEmitter() as Channel;
    closeCalls = 0;

    constructor(private readonly createChannelError?: Error) {
        super();
    }

    async createChannel() {
        if (this.createChannelError) throw this.createChannelError;
        return this.channel;
    }

    async close() {
        this.closeCalls++;
        this.emit("close");
    }
}

let rabbit: RabbitMQInternals | undefined;
const originalConnect = amqp.connect;

function resetRabbitMQ() {
    if (!rabbit) return;

    if (rabbit.reconnectTimer) {
        clearTimeout(rabbit.reconnectTimer);
    }

    rabbit.connection = null;
    rabbit.channel = null;
    rabbit.isReconnecting = false;
    rabbit.reconnectAttempts = 0;
    rabbit.BASE_RECONNECT_DELAY_MS = 1;
    rabbit.reconnectTimer = null;
    amqp.connect = originalConnect;
    rabbit = undefined;
}

async function loadRabbitMQ() {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1/spacebar";
    const module = await import("./RabbitMQ.js");
    rabbit = module.RabbitMQ as unknown as RabbitMQInternals;
    resetRabbitMQ();
    rabbit = module.RabbitMQ as unknown as RabbitMQInternals;
    rabbit.BASE_RECONNECT_DELAY_MS = 1;
    return {
        RabbitMQ: module.RabbitMQ,
        rabbit,
    };
}

async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 500;

    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 5);
        });
    }

    assert.equal(predicate(), true);
}

afterEach(() => {
    resetRabbitMQ();
});

describe("RabbitMQ reconnect", () => {
    test("continues retrying until startup connection succeeds", async () => {
        const { RabbitMQ, rabbit } = await loadRabbitMQ();
        const successfulConnection = new FakeConnection() as unknown as ChannelModel;
        let attempts = 0;
        let reconnects = 0;
        const onReconnect = () => reconnects++;

        amqp.connect = async () => {
            attempts++;
            if (attempts < 3) throw new Error("broker unavailable");
            return successfulConnection;
        };

        RabbitMQ.on("reconnected", onReconnect);

        try {
            await rabbit.connect("amqp://spacebar");
            await waitFor(() => rabbit.connection === successfulConnection);

            assert.equal(attempts, 3);
            assert.equal(reconnects, 1);
            assert.equal(rabbit.isConnected(), true);
        } finally {
            RabbitMQ.off("reconnected", onReconnect);
        }
    });

    test("retries after an established connection closes", async () => {
        const { rabbit } = await loadRabbitMQ();
        const firstConnection = new FakeConnection() as unknown as ChannelModel;
        const secondConnection = new FakeConnection() as unknown as ChannelModel;
        let attempts = 0;

        amqp.connect = async () => {
            attempts++;
            if (attempts === 1) return firstConnection;
            if (attempts < 4) throw new Error("broker restarting");
            return secondConnection;
        };

        await rabbit.connect("amqp://spacebar");
        assert.equal(rabbit.connection, firstConnection);

        firstConnection.emit("close");
        await waitFor(() => rabbit.connection === secondConnection);

        assert.equal(attempts, 4);
        assert.equal(rabbit.isConnected(), true);
    });

    test("recovered connections still reconnect after channel setup fails once", async () => {
        const { rabbit } = await loadRabbitMQ();
        const channelFailureConnection = new FakeConnection(new Error("channel unavailable"));
        const recoveredConnection = new FakeConnection();
        const reconnectedAfterClose = new FakeConnection();
        let attempts = 0;

        amqp.connect = async () => {
            attempts++;
            if (attempts === 1) return channelFailureConnection as unknown as ChannelModel;
            if (attempts === 2) return recoveredConnection as unknown as ChannelModel;
            if (attempts === 3) return reconnectedAfterClose as unknown as ChannelModel;
            throw new Error(`unexpected connection attempt ${attempts}`);
        };

        await rabbit.connect("amqp://spacebar");
        await waitFor(() => rabbit.connection === (recoveredConnection as unknown as ChannelModel));

        assert.equal(attempts, 2);
        assert.equal(channelFailureConnection.closeCalls, 1);
        assert.equal(recoveredConnection.listenerCount("close"), 1);
        assert.equal(recoveredConnection.listenerCount("error"), 1);
        assert.equal(rabbit.isConnected(), true);

        channelFailureConnection.emit("close");
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 5);
        });

        assert.equal(rabbit.connection, recoveredConnection as unknown as ChannelModel);
        assert.equal(attempts, 2);

        recoveredConnection.emit("close");
        await waitFor(() => rabbit.connection === (reconnectedAfterClose as unknown as ChannelModel));

        assert.equal(attempts, 3);
        assert.equal(rabbit.isConnected(), true);
    });
});
