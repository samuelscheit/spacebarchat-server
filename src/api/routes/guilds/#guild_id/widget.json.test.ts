import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;

interface MockSession {
    activities?: unknown[];
    last_seen?: Date;
    status: string;
    getPublicStatus(): string;
}

interface MockMember {
    avatar?: string;
    id: string;
    user: {
        avatar?: string;
        discriminator: string;
        sessions: MockSession[];
        username: string;
    };
}

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;
const fixedNow = Date.parse("2026-05-08T12:00:00Z");

const queryCalls: { method: string; args: unknown[] }[] = [];
const memberFindCalls: unknown[] = [];
const guildFindCalls: unknown[] = [];
let sampledMemberIds: { id: string }[] = [];
let sampledMembers: MockMember[] = [];
let sampledMemberCount: number | string | undefined;
let guild = {
    id: "guild",
    name: "Widget Guild",
    widget_channel_id: null as string | null,
    widget_enabled: true,
};

const queryBuilder = {
    andWhere(...args: unknown[]) {
        queryCalls.push({ method: "andWhere", args });
        return queryBuilder;
    },
    async getRawMany() {
        queryCalls.push({ method: "getRawMany", args: [] });
        return sampledMemberIds;
    },
    async getRawOne() {
        queryCalls.push({ method: "getRawOne", args: [] });
        return sampledMemberCount === undefined ? undefined : { count: sampledMemberCount };
    },
    groupBy(...args: unknown[]) {
        queryCalls.push({ method: "groupBy", args });
        return queryBuilder;
    },
    innerJoin(...args: unknown[]) {
        queryCalls.push({ method: "innerJoin", args });
        return queryBuilder;
    },
    limit(...args: unknown[]) {
        queryCalls.push({ method: "limit", args });
        return queryBuilder;
    },
    orderBy(...args: unknown[]) {
        queryCalls.push({ method: "orderBy", args });
        return queryBuilder;
    },
    select(...args: unknown[]) {
        queryCalls.push({ method: "select", args });
        return queryBuilder;
    },
    take() {
        throw new Error("widget member raw sampling must use limit() so the SQL is capped before hydration");
    },
    where(...args: unknown[]) {
        queryCalls.push({ method: "where", args });
        return queryBuilder;
    },
};

const statusPriority: Record<string, number> = {
    online: 0,
    idle: 1,
    dnd: 2,
    invisible: 3,
    offline: 4,
    unknown: 5,
};

const mockUtil = {
    Channel: {
        async getOrderedChannels() {
            return [];
        },
    },
    Config: {
        get() {
            return { cdn: { endpointPublic: "https://cdn.example" } };
        },
    },
    DiscordApiErrors: { EMBED_DISABLED: new Error("embed disabled") },
    Guild: {
        async findOneOrFail(options: unknown) {
            guildFindCalls.push(options);
            return guild;
        },
    },
    Invite: {
        async findOne() {
            return null;
        },
    },
    Member: {
        createQueryBuilder(...args: unknown[]) {
            queryCalls.push({ method: "createQueryBuilder", args });
            return queryBuilder;
        },
        async find(options: unknown) {
            memberFindCalls.push(options);
            return sampledMembers;
        },
    },
    Permissions: { FLAGS: { CONNECT: 1n }, channelPermission: () => 1n },
    getMostRelevantSession(sessions: MockSession[]) {
        return [...sessions].sort((a, b) => (statusPriority[a.status] ?? statusPriority.unknown) - (statusPriority[b.status] ?? statusPriority.unknown))[0];
    },
    normalizeInviteCreateOptions(input: unknown) {
        return input;
    },
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/api") return { randomString: () => "invite", route: () => (_req: unknown, _res: unknown, next: () => void) => next() };
    if (request === "@spacebar/util") return mockUtil;
    if (request === "@spacebar/schemas") return { ChannelType: { GUILD_VOICE: 2 } };
    if (request === "express") return { Router: () => ({ get: () => undefined }) };
    if (request === "typeorm") return { In: (ids: string[]) => ({ $in: ids }) };

    return originalLoad(request, parent, isMain);
};

const { getWidgetJsonData, getWidgetMemberSample, getWidgetOnlineMemberCount, toWidgetMember } = require("./widget.json.js") as {
    getWidgetJsonData(guildId: string): Promise<{ members: unknown[]; presence_count: number }>;
    getWidgetMemberSample(guildId: string, now?: number): Promise<MockMember[]>;
    getWidgetOnlineMemberCount(guildId: string, now?: number): Promise<number>;
    toWidgetMember(guildId: string, member: MockMember, now?: number): { avatar_url: string; id: string; status: string; username: string };
};

after(() => {
    moduleLoader._load = originalLoad;
});

beforeEach(() => {
    queryCalls.length = 0;
    memberFindCalls.length = 0;
    guildFindCalls.length = 0;
    sampledMemberIds = [];
    sampledMembers = [];
    sampledMemberCount = undefined;
    guild = {
        id: "guild",
        name: "Widget Guild",
        widget_channel_id: null,
        widget_enabled: true,
    };
});

test("getWidgetMemberSample queries a random capped sample of distinct recently visible members before hydration", async () => {
    sampledMemberIds = Array.from({ length: 101 }, (_, index) => ({ id: String(1000 + index) }));
    sampledMembers = Array.from({ length: 101 }, (_, index) => ({
        id: String(1000 + index),
        user: { discriminator: "0001", sessions: [], username: `member-${index}` },
    }));

    const members = await getWidgetMemberSample("guild", fixedNow);

    assert.equal(members.length, 100);
    assert.deepEqual(
        queryCalls.map((call) => call.method),
        ["createQueryBuilder", "innerJoin", "innerJoin", "where", "andWhere", "select", "groupBy", "orderBy", "limit", "getRawMany"],
    );
    assert.deepEqual(queryCalls[0].args, ["member"]);
    assert.deepEqual(queryCalls[1].args, ["member.user", "user"]);
    assert.deepEqual(queryCalls[2].args, ["user.sessions", "session", "session.last_seen > :minLastSeen", { minLastSeen: new Date("2026-05-08T11:55:00Z") }]);
    assert.deepEqual(queryCalls[3].args, [{ guild_id: "guild" }]);
    assert.deepEqual(queryCalls[4].args, ["session.status IN (:...visibleStatuses)", { visibleStatuses: ["online", "idle", "dnd"] }]);
    assert.deepEqual(queryCalls[5].args, ["member.id", "id"]);
    assert.deepEqual(queryCalls[6].args, ["member.id"]);
    assert.deepEqual(queryCalls[7].args, ["RANDOM()"]);
    assert.deepEqual(queryCalls[8].args, [100]);
    assert.deepEqual(memberFindCalls, [
        {
            relations: { user: { sessions: true } },
            where: { guild_id: "guild", id: { $in: sampledMemberIds.slice(0, 100).map((member) => member.id) } },
        },
    ]);
});

test("getWidgetMemberSample skips hydration when the random sample is empty", async () => {
    assert.deepEqual(await getWidgetMemberSample("guild"), []);
    assert.deepEqual(memberFindCalls, []);
});

test("getWidgetOnlineMemberCount counts distinct recently visible members without capping", async () => {
    sampledMemberCount = "123";

    assert.equal(await getWidgetOnlineMemberCount("guild", fixedNow), 123);
    assert.deepEqual(
        queryCalls.map((call) => call.method),
        ["createQueryBuilder", "innerJoin", "innerJoin", "where", "andWhere", "select", "getRawOne"],
    );
    assert.deepEqual(queryCalls[0].args, ["member"]);
    assert.deepEqual(queryCalls[1].args, ["member.user", "user"]);
    assert.deepEqual(queryCalls[2].args, ["user.sessions", "session", "session.last_seen > :minLastSeen", { minLastSeen: new Date("2026-05-08T11:55:00Z") }]);
    assert.deepEqual(queryCalls[3].args, [{ guild_id: "guild" }]);
    assert.deepEqual(queryCalls[4].args, ["session.status IN (:...visibleStatuses)", { visibleStatuses: ["online", "idle", "dnd"] }]);
    assert.deepEqual(queryCalls[5].args, ["COUNT(DISTINCT member.id)", "count"]);
});

test("getWidgetJsonData uses the uncapped online member count for presence_count", async () => {
    sampledMemberIds = [{ id: "42" }, { id: "43" }];
    sampledMembers = [
        {
            id: "42",
            user: { discriminator: "1234", sessions: [{ status: "online", last_seen: new Date(fixedNow), getPublicStatus: () => "online" }], username: "widget-user" },
        },
        {
            id: "43",
            user: { discriminator: "0001", sessions: [{ status: "idle", last_seen: new Date(fixedNow), getPublicStatus: () => "idle" }], username: "default-avatar-user" },
        },
    ];
    sampledMemberCount = 123;

    const data = await getWidgetJsonData("guild");

    assert.equal(data.presence_count, 123);
    assert.equal(data.members.length, 2);
    assert.deepEqual(guildFindCalls, [
        {
            select: {
                channel_ordering: true,
                id: true,
                name: true,
                widget_channel_id: true,
                widget_enabled: true,
            },
            where: { id: "guild" },
        },
    ]);
});

test("toWidgetMember builds guild avatar URLs and preserves the visible session status", () => {
    const member: MockMember = {
        avatar: "guild-avatar",
        id: "42",
        user: {
            discriminator: "1234",
            sessions: [{ status: "idle", last_seen: new Date(fixedNow), getPublicStatus: () => "idle" }],
            username: "widget-user",
        },
    };

    assert.deepEqual(toWidgetMember("guild", member, fixedNow), {
        avatar: null,
        avatar_url: "https://cdn.example/guilds/guild/users/42/avatars/guild-avatar.png",
        discriminator: "1234",
        id: "42",
        status: "idle",
        username: "widget-user",
    });
});

test("toWidgetMember ignores hidden and stale sessions when selecting status", () => {
    const member: MockMember = {
        id: "43",
        user: {
            discriminator: "0001",
            sessions: [
                { status: "online", last_seen: new Date(fixedNow - 10 * 60 * 1000), getPublicStatus: () => "online" },
                { status: "invisible", last_seen: new Date(fixedNow), getPublicStatus: () => "offline" },
                { status: "offline", last_seen: new Date(fixedNow), getPublicStatus: () => "offline" },
                { status: "dnd", last_seen: new Date(fixedNow), getPublicStatus: () => "dnd" },
            ],
            username: "default-avatar-user",
        },
    };

    assert.equal(toWidgetMember("guild", member, fixedNow).status, "dnd");
    assert.equal(toWidgetMember("guild", member, fixedNow).avatar_url, "https://cdn.example/embed/avatars/1.png");
});

test("toWidgetMember falls back to online for members without a schema-visible recent status", () => {
    const member: MockMember = {
        id: "44",
        user: {
            discriminator: "0001",
            sessions: [{ status: "unknown", last_seen: new Date(fixedNow), getPublicStatus: () => "unknown" }],
            username: "unknown-status-user",
        },
    };

    assert.equal(toWidgetMember("guild", member, fixedNow).status, "online");
});
