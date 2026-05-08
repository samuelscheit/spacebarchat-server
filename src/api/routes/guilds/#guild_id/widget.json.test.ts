import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;

interface MockSession {
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

const queryCalls: { method: string; args: unknown[] }[] = [];
const memberFindCalls: unknown[] = [];
let sampledMemberIds: { id: string }[] = [];
let sampledMembers: MockMember[] = [];

const queryBuilder = {
    andWhere(...args: unknown[]) {
        queryCalls.push({ method: "andWhere", args });
        return queryBuilder;
    },
    async getRawMany() {
        queryCalls.push({ method: "getRawMany", args: [] });
        return sampledMemberIds;
    },
    groupBy(...args: unknown[]) {
        queryCalls.push({ method: "groupBy", args });
        return queryBuilder;
    },
    innerJoin(...args: unknown[]) {
        queryCalls.push({ method: "innerJoin", args });
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
    take(...args: unknown[]) {
        queryCalls.push({ method: "take", args });
        return queryBuilder;
    },
    where(...args: unknown[]) {
        queryCalls.push({ method: "where", args });
        return queryBuilder;
    },
};

const mockUtil = {
    Channel: {},
    Config: {
        get() {
            return { cdn: { endpointPublic: "https://cdn.example" } };
        },
    },
    DiscordApiErrors: { EMBED_DISABLED: new Error("embed disabled") },
    Guild: {},
    Invite: {},
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
    Permissions: { FLAGS: { CONNECT: 1n } },
    getMostRelevantSession(sessions: MockSession[]) {
        return sessions[0];
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

const { getWidgetMemberSample, toWidgetMember } = require("./widget.json.js") as {
    getWidgetMemberSample(guildId: string, now?: number): Promise<MockMember[]>;
    toWidgetMember(guildId: string, member: MockMember): { avatar_url: string; id: string; status: string; username: string };
};

after(() => {
    moduleLoader._load = originalLoad;
});

beforeEach(() => {
    queryCalls.length = 0;
    memberFindCalls.length = 0;
    sampledMemberIds = [];
    sampledMembers = [];
});

test("getWidgetMemberSample queries a random capped sample of distinct recently visible members", async () => {
    sampledMemberIds = Array.from({ length: 101 }, (_, index) => ({ id: String(1000 + index) }));
    sampledMembers = Array.from({ length: 101 }, (_, index) => ({
        id: String(1000 + index),
        user: { discriminator: "0001", sessions: [], username: `member-${index}` },
    }));

    const members = await getWidgetMemberSample("guild", Date.parse("2026-05-08T12:00:00Z"));

    assert.equal(members.length, 100);
    assert.deepEqual(
        queryCalls.map((call) => call.method),
        ["createQueryBuilder", "select", "innerJoin", "innerJoin", "where", "andWhere", "groupBy", "orderBy", "take", "getRawMany"],
    );
    assert.deepEqual(queryCalls[0].args, ["member"]);
    assert.deepEqual(queryCalls[1].args, ["member.id", "id"]);
    assert.deepEqual(queryCalls[2].args, ["member.user", "user"]);
    assert.deepEqual(queryCalls[3].args, ["user.sessions", "session", "session.last_seen > :minLastSeen", { minLastSeen: new Date("2026-05-08T11:55:00Z") }]);
    assert.deepEqual(queryCalls[4].args, [{ guild_id: "guild" }]);
    assert.deepEqual(queryCalls[5].args, ["session.status NOT IN (:...hiddenStatuses)", { hiddenStatuses: ["invisible", "offline"] }]);
    assert.deepEqual(queryCalls[6].args, ["member.id"]);
    assert.deepEqual(queryCalls[7].args, ["RANDOM()"]);
    assert.deepEqual(queryCalls[8].args, [100]);
    assert.deepEqual(memberFindCalls, [
        {
            relations: { user: { sessions: true } },
            where: { guild_id: "guild", id: { $in: sampledMemberIds.map((member) => member.id) } },
        },
    ]);
});

test("getWidgetMemberSample skips hydration when the random sample is empty", async () => {
    assert.deepEqual(await getWidgetMemberSample("guild"), []);
    assert.deepEqual(memberFindCalls, []);
});

test("toWidgetMember builds guild avatar URLs", () => {
    const member: MockMember = {
        avatar: "guild-avatar",
        id: "42",
        user: {
            discriminator: "1234",
            sessions: [{ status: "idle", getPublicStatus: () => "idle" }],
            username: "widget-user",
        },
    };

    assert.deepEqual(toWidgetMember("guild", member), {
        avatar: null,
        avatar_url: "https://cdn.example/guilds/guild/users/42/avatars/guild-avatar.png",
        discriminator: "1234",
        id: "42",
        status: "online",
        username: "widget-user",
    });
});

test("toWidgetMember falls back to default avatar and online status", () => {
    const member: MockMember = {
        id: "43",
        user: {
            discriminator: "0001",
            sessions: [{ status: "unknown", getPublicStatus: () => "unknown" }],
            username: "default-avatar-user",
        },
    };

    assert.equal(toWidgetMember("guild", member).status, "online");
    assert.equal(toWidgetMember("guild", member).avatar_url, "https://cdn.example/embed/avatars/1.png");
});
