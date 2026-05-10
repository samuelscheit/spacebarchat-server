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
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import type { TeamListTeam } from "../../src/schemas/responses/TeamListResponse";
import {
    createGuildApplicationsRouter,
    getGuildApplications,
    parseGuildApplicationsQuery,
    type GuildApplicationsApplicationRepository,
    type GuildApplicationSource,
} from "../../src/api/routes/guilds/#guild_id/applications";

const requireModule = require;

function publicUser(id: string, bot = false) {
    return {
        id,
        username: id,
        discriminator: "0001",
        public_flags: 0,
        avatar: `${id}-avatar`,
        bio: "",
        bot,
        premium_type: 0,
        toPublicUser() {
            return {
                id,
                username: id,
                discriminator: "0001",
                public_flags: 0,
                avatar: `${id}-avatar`,
                bio: "",
                bot,
                premium_type: 0,
            } as never;
        },
    };
}

function application(overrides: Partial<GuildApplicationSource> = {}): GuildApplicationSource {
    return {
        id: "app-1",
        name: "Linked App",
        description: "Attached to the guild",
        flags: 0,
        guild_id: "guild-1",
        owner: publicUser("owner"),
        bot: publicUser("bot-1", true),
        ...overrides,
    };
}

async function requestJson(app: express.Express, pathname: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /guilds/:guild_id/applications", () => {
    test("queries applications attached through guild_id and serializes public application data", async (t) => {
        const find = t.mock.fn(async (_options: unknown) => [
            application({
                id: "app-2",
                type: 5 as never,
                owner: { ...publicUser("owner"), email: "owner@example.invalid" } as never,
                bot: publicUser("bot-2", true),
            }),
        ]);
        const applicationRepository: GuildApplicationsApplicationRepository = {
            find,
        };

        const result = await getGuildApplications("guild-1", "manager", { type: "5" }, { applicationRepository });

        assert.equal(find.mock.callCount(), 1);
        const findOptions = find.mock.calls[0].arguments[0] as {
            where: Record<string, unknown>;
            relations: Record<string, unknown>;
            select: Record<string, Record<string, boolean>>;
            order: Record<string, string>;
        };
        assert.deepEqual(findOptions.where, { guild_id: "guild-1", type: 5 });
        assert.deepEqual(findOptions.relations, { bot: true, owner: true });
        assert.equal(findOptions.select.owner.id, true);
        assert.equal(findOptions.select.bot.username, true);
        assert.deepEqual(findOptions.order, { id: "ASC" });
        assert.deepEqual(result, [
            {
                id: "app-2",
                name: "Linked App",
                description: "Attached to the guild",
                flags: 0,
                guild_id: "guild-1",
                type: 5,
                owner: {
                    id: "owner",
                    username: "owner",
                    discriminator: "0001",
                    public_flags: 0,
                    avatar: "owner-avatar",
                    bio: "",
                    bot: false,
                    premium_type: 0,
                },
                bot: {
                    id: "bot-2",
                    username: "bot-2",
                    discriminator: "0001",
                    public_flags: 0,
                    avatar: "bot-2-avatar",
                    bio: "",
                    bot: true,
                    premium_type: 0,
                },
            },
        ]);
    });

    test("includes team data only when requested and visible to the application owner or accepted team member", async (t) => {
        const team: TeamListTeam = {
            id: "team-1",
            icon: null,
            name: "App Team",
            owner_user_id: "team-owner",
            members: [{ id: "member-row", membership_state: TeamMemberState.ACCEPTED, permissions: [], role: TeamMemberRole.DEVELOPER, team_id: "team-1", user_id: "viewer" }],
        };
        const find = t.mock.fn(async (_options: unknown) => [
            application({ id: "owned-app", owner: publicUser("viewer"), team }),
            application({ id: "team-app", owner: publicUser("team-owner"), team }),
            application({ id: "hidden-team-app", owner: publicUser("someone-else"), team: { ...team, members: [] } }),
        ]);
        const applicationRepository: GuildApplicationsApplicationRepository = {
            find,
        };

        const result = await getGuildApplications("guild-1", "viewer", { include_team: "true" }, { applicationRepository });

        const findOptions = find.mock.calls[0].arguments[0] as { relations: Record<string, unknown> };
        assert.deepEqual(findOptions.relations, { bot: true, owner: true, team: { members: true } });
        assert.deepEqual(
            result.map((item) => ({ id: item.id, hasTeam: "team" in item })),
            [
                { id: "owned-app", hasTeam: true },
                { id: "team-app", hasTeam: true },
                { id: "hidden-team-app", hasTeam: false },
            ],
        );
        assert.deepEqual(result[0].team, team);
        assert.deepEqual(result[1].team, team);
    });

    test("returns an empty fail-closed response for unsupported channel filters and malformed type filters", async (t) => {
        const find = t.mock.fn(async (_options: unknown) => {
            throw new Error("unsupported filters should not query applications");
        });
        const applicationRepository: GuildApplicationsApplicationRepository = { find };

        assert.deepEqual(await getGuildApplications("guild-1", "viewer", { channel_id: "channel-1" }, { applicationRepository }), []);
        assert.deepEqual(await getGuildApplications("guild-1", "viewer", { type: "not-a-number" }, { applicationRepository }), []);
        assert.equal(find.mock.callCount(), 0);
        assert.equal(parseGuildApplicationsQuery({ type: "5" })?.applicationType, 5);
    });

    test("returns the mounted route response after MANAGE_GUILD authorization", async (t) => {
        const permissionsModule = requireModule(path.join(process.cwd(), "dist", "util", "util", "Permissions.js")) as typeof import("../../src/util/util/Permissions");
        t.mock.method(permissionsModule, "getPermission", async () => ({ has: () => true }));

        const find = t.mock.fn(async (_options: unknown) => [application({ id: "app-route" })]);
        const applicationRepository: GuildApplicationsApplicationRepository = { find };
        const app = express();
        app.use((req, _res, next) => {
            req.user_id = "viewer";
            next();
        });
        app.use("/guilds/:guild_id/applications", createGuildApplicationsRouter({ applicationRepository }));
        app.use((error: { message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            res.status(500).json({ message: error.message });
        });

        const response = await requestJson(app, "/guilds/guild-1/applications?type=5");

        assert.equal(response.status, 200);
        assert.deepEqual(
            (response.body as Array<{ id: string }>).map((item) => item.id),
            ["app-route"],
        );
        assert.deepEqual((find.mock.calls[0].arguments[0] as { where: Record<string, unknown> }).where, { guild_id: "guild-1", type: 5 });
    });

    test("declares route ownership, authentication, permission, query, and response metadata", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "applications.ts"), "utf8");

        assert.match(source, /router\.get\(\s*["']\/["']/);
        assert.match(source, /summary:\s*"Get Guild Applications"/);
        assert.match(source, /permission:\s*"MANAGE_GUILD"/);
        assert.match(source, /type:\s*\{\s*type:\s*"integer"/);
        assert.match(source, /include_team:\s*\{\s*type:\s*"boolean"/);
        assert.match(source, /channel_id:\s*\{\s*type:\s*"string"/);
        assert.match(source, /200:\s*\{\s*body:\s*"APIApplicationArray"/);
        assert.match(source, /401:\s*\{\s*body:\s*"APIErrorResponse"/);
        assert.match(source, /403:\s*\{\s*body:\s*"APIErrorResponse"/);
    });
});
