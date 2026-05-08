import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;
type Range = [number, number];

interface MockSocket {
    user_id: string;
}

interface GuildSubscription {
    channels?: Record<string, Range[]>;
    members?: string[];
    typing?: boolean;
}

interface BulkPayload {
    d: {
        subscriptions: Record<string, GuildSubscription>;
    };
    op: number;
    passthrough: string;
}

interface LazyPayload extends Omit<BulkPayload, "d"> {
    d: GuildSubscription & { guild_id: string };
}

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;
const originalConsoleLog = console.log;
const schema = { type: "GuildSubscriptionsBulkSchema" };

const state: {
    checks: { data: unknown; schema: unknown; thisArg: MockSocket }[];
    lazyRequests: { payload: LazyPayload; thisArg: MockSocket }[];
    logs: string[];
} = {
    checks: [],
    lazyRequests: [],
    logs: [],
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/schemas") return { GuildSubscriptionsBulkSchema: schema };
    if (request === "./instanceOf" && parent?.filename?.endsWith("/GuildSubscriptionsBulk.js")) {
        return {
            check(this: MockSocket, schemaArgument: unknown, data: unknown) {
                state.checks.push({ data, schema: schemaArgument, thisArg: this });
            },
        };
    }
    if (request === "./LazyRequest" && parent?.filename?.endsWith("/GuildSubscriptionsBulk.js")) {
        return {
            async onLazyRequest(this: MockSocket, payload: LazyPayload) {
                state.lazyRequests.push({ payload, thisArg: this });
            },
        };
    }

    return originalLoad(request, parent, isMain);
};

const { onGuildSubscriptionsBulk } = require("./GuildSubscriptionsBulk") as {
    onGuildSubscriptionsBulk(this: MockSocket, payload: BulkPayload): Promise<void>;
};

beforeEach(() => {
    state.checks = [];
    state.lazyRequests = [];
    state.logs = [];
    console.log = (...args: unknown[]) => {
        state.logs.push(args.join(" "));
    };
});

after(() => {
    moduleLoader._load = originalLoad;
    console.log = originalConsoleLog;
});

describe("guild subscriptions bulk", () => {
    test("validates the bulk payload and delegates each guild subscription to lazy requests", async () => {
        const socket = { user_id: "viewer" };
        const guildARanges: Range[] = [[0, 99]];
        const payload: BulkPayload = {
            d: {
                subscriptions: {
                    "guild-a": {
                        channels: {
                            "channel-a": guildARanges,
                        },
                        typing: true,
                    },
                    "guild-b": {
                        members: ["member-b"],
                    },
                },
            },
            op: 37,
            passthrough: "kept",
        };

        await onGuildSubscriptionsBulk.call(socket, payload);

        assert.deepEqual(state.checks, [{ data: payload.d, schema, thisArg: socket }]);
        assert.deepEqual(
            state.lazyRequests.map(({ payload }) => payload),
            [
                {
                    d: {
                        channels: {
                            "channel-a": guildARanges,
                        },
                        guild_id: "guild-a",
                        typing: true,
                    },
                    op: 37,
                    passthrough: "kept",
                },
                {
                    d: {
                        guild_id: "guild-b",
                        members: ["member-b"],
                    },
                    op: 37,
                    passthrough: "kept",
                },
            ],
        );
        assert.deepEqual(
            state.lazyRequests.map(({ thisArg }) => thisArg),
            [socket, socket],
        );
        assert.match(state.logs[0], /GuildSubscriptionsBulk processed 2 subscriptions for user viewer/);
    });
});
