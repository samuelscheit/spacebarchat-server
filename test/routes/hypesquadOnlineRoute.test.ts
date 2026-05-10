/*
  Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
  Copyright (C) 2026 Spacebar and Spacebar Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published
  by the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import { ErrorHandler } from "@spacebar/api";
import { HypeSquadOnlineHouse, PrivateUserProjection, UserFlags } from "@spacebar/schemas";
import { events, Member, User } from "@spacebar/util";
import express from "express";
import hypesquadOnlineRouter, { clearHypeSquadOnlineHouse, setHypeSquadOnlineHouse, updateHypeSquadOnlineFlags } from "../../src/api/routes/hypesquad/online";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:DELETE:/hypesquad/online/", "api:http:POST:/hypesquad/online/"];
const originalFindOneOrFail = User.findOneOrFail;
const originalMemberFind = Member.find;

type JsonSchema = {
    $ref?: string;
    type?: string;
    enum?: number[];
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, JsonSchema>;
};

type TestUser = User & {
    saveCalls: number;
};

afterEach(() => {
    User.findOneOrFail = originalFindOneOrFail;
    Member.find = originalMemberFind;
});

describe("/hypesquad/online", () => {
    test("declares the HypeSquad Online manifest route ids covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:DELETE:/hypesquad/online/", "api:http:POST:/hypesquad/online/"]);
    });

    test("declares source-backed route metadata and authenticated error responses", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "hypesquad", "online.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Join HypeSquad Online"/);
        assert.match(routeSource, /summary:\s*"Leave HypeSquad Online"/);
        assert.match(routeSource, /requestBody:\s*"HypeSquadOnlineCreateSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /event:\s*\[\s*"USER_UPDATE",\s*"GUILD_MEMBER_UPDATE"\s*\]/);
        assert.match(routeSource, /204:\s*\{\s*\}/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates the documented HypeSquad house request schema", () => {
        const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf-8")) as Record<string, JsonSchema>;

        assert.deepEqual(schemas.HypeSquadOnlineCreateSchema, {
            type: "object",
            properties: {
                house_id: {
                    $ref: "#/definitions/HypeSquadOnlineHouse",
                },
            },
            additionalProperties: false,
            required: ["house_id"],
            $schema: "http://json-schema.org/draft-07/schema#",
        });
        assert.deepEqual(schemas.HypeSquadOnlineHouse, {
            type: "number",
            enum: [1, 2, 3],
            $schema: "http://json-schema.org/draft-07/schema#",
        });
    });

    test("updates only HypeSquad house bits while preserving unrelated flags", () => {
        const activeDeveloper = UserFlags.FLAGS.ACTIVE_DEVELOPER;
        const startingFlags = Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BRAVERY);

        assert.equal(updateHypeSquadOnlineFlags(startingFlags, UserFlags.FLAGS.HOUSE_BRILLIANCE), Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BRILLIANCE));

        const user = createUser(startingFlags, Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BALANCE));
        setHypeSquadOnlineHouse(user, HypeSquadOnlineHouse.Balance);

        assert.equal(user.flags, Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BALANCE));
        assert.equal(user.public_flags, Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BALANCE));

        clearHypeSquadOnlineHouse(user);
        assert.equal(user.flags, Number(activeDeveloper));
        assert.equal(user.public_flags, Number(activeDeveloper));
    });

    test("rejects invalid house ids before loading the user", async () => {
        const harness = setupRoute({ user: createUser() });
        const response = await requestJson(harness.app, "/hypesquad/online", {
            method: "POST",
            body: { house_id: 4 },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.equal(harness.userFindOptions.length, 0);
        assert.equal(harness.user.saveCalls, 0);
    });

    test("joins a HypeSquad Online house, saves once, and emits user updates", async () => {
        const activeDeveloper = UserFlags.FLAGS.ACTIVE_DEVELOPER;
        const user = createUser(Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BRAVERY), Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BRAVERY));
        const harness = setupRoute({ user, members: [createMember("guild-id", ["guild-id", "role-id"])] });
        const emitted = captureEvents(["viewer", "guild-id"]);

        try {
            const response = await requestText(harness.app, "/hypesquad/online", {
                method: "POST",
                body: { house_id: HypeSquadOnlineHouse.Brilliance },
            });

            assert.equal(response.status, 204);
            assert.equal(response.body, "");
            assert.equal(user.saveCalls, 1);
            assert.equal(user.flags, Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BRILLIANCE));
            assert.equal(user.public_flags, Number(activeDeveloper | UserFlags.FLAGS.HOUSE_BRILLIANCE));
            assert.deepEqual(harness.userFindOptions, [
                {
                    where: { id: "viewer" },
                    select: expectPrivateUserProjection(),
                },
            ]);
            assert.deepEqual(harness.memberFindOptions, [
                {
                    where: { id: "viewer" },
                    relations: { roles: true },
                },
            ]);
            assert.equal(emitted.events.length, 2);
            assert.equal(emitted.events[0]?.event, "USER_UPDATE");
            assert.equal(emitted.events[0]?.user_id, "viewer");
            assert.equal(emitted.events[0]?.data, user);
            assert.deepEqual(emitted.events[1], {
                event: "GUILD_MEMBER_UPDATE",
                guild_id: "guild-id",
                data: {
                    guild_id: "guild-id",
                    joined_at: new Date("2026-01-01T00:00:00.000Z"),
                    nick: null,
                    pending: false,
                    premium_since: undefined,
                    roles: ["role-id"],
                    user: user.toPublicUser(),
                },
            });
        } finally {
            emitted.close();
        }
    });

    test("leaves HypeSquad Online and clears only house bits", async () => {
        const earlySupporter = UserFlags.FLAGS.EARLY_SUPPORTER;
        const user = createUser(Number(earlySupporter | UserFlags.FLAGS.HOUSE_BALANCE), Number(earlySupporter | UserFlags.FLAGS.HOUSE_BALANCE));
        const harness = setupRoute({ user });
        const emitted = captureEvents(["viewer"]);

        try {
            const response = await requestText(harness.app, "/hypesquad/online", {
                method: "DELETE",
            });

            assert.equal(response.status, 204);
            assert.equal(response.body, "");
            assert.equal(user.saveCalls, 1);
            assert.equal(user.flags, Number(earlySupporter));
            assert.equal(user.public_flags, Number(earlySupporter));
            assert.equal(emitted.events.length, 1);
            assert.equal(emitted.events[0]?.event, "USER_UPDATE");
        } finally {
            emitted.close();
        }
    });
});

function setupRoute(options: { user: TestUser; members?: Member[] }) {
    const userFindOptions: unknown[] = [];
    const memberFindOptions: unknown[] = [];
    const app = express();

    User.findOneOrFail = (async (findOptions: unknown) => {
        userFindOptions.push(findOptions);
        return options.user;
    }) as typeof User.findOneOrFail;
    Member.find = (async (findOptions: unknown) => {
        memberFindOptions.push(findOptions);
        return options.members ?? [];
    }) as typeof Member.find;

    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/hypesquad/online", hypesquadOnlineRouter);
    app.use(ErrorHandler);

    return {
        app,
        user: options.user,
        userFindOptions,
        memberFindOptions,
    };
}

function createUser(flags = 0, publicFlags = flags): TestUser {
    const user = {
        id: "viewer",
        username: "viewer",
        discriminator: "0001",
        avatar: null,
        public_flags: publicFlags,
        flags,
        saveCalls: 0,
        async save() {
            user.saveCalls += 1;
            return user;
        },
        toPublicUser() {
            return {
                id: user.id,
                username: user.username,
                discriminator: user.discriminator,
                avatar: user.avatar,
                public_flags: user.public_flags,
                pronouns: "",
            };
        },
    } as unknown as TestUser;

    return user;
}

function createMember(guildId: string, roleIds: string[]): Member {
    return {
        id: "viewer",
        guild_id: guildId,
        joined_at: new Date("2026-01-01T00:00:00.000Z"),
        nick: null,
        pending: false,
        premium_since: undefined,
        roles: roleIds.map((id) => ({ id })),
    } as unknown as Member;
}

function expectPrivateUserProjection() {
    return PrivateUserProjection;
}

function captureEvents(routeIds: string[]) {
    const captured: Record<string, unknown>[] = [];
    const listener = (event: Record<string, unknown>) => {
        captured.push(event);
    };

    for (const routeId of routeIds) events.on(routeId, listener);

    return {
        events: captured,
        close() {
            for (const routeId of routeIds) events.off(routeId, listener);
        },
    };
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}) {
    const response = await requestText(app, requestPath, options);
    return {
        status: response.status,
        body: JSON.parse(response.body) as Record<string, unknown>,
    };
}

async function requestText(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: ReturnType<express.Express["listen"]>) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
