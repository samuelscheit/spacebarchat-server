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
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import { TeamMemberRole, TeamMemberState } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { QueryRunner } from "typeorm";
import {
    createOAuth2ApplicationAllowlistUserRouter,
    removeApplicationTester,
    type ApplicationTesterRepositories,
    type ApplicationTesterRepository,
} from "../../src/api/routes/oauth2/applications/#application_id/allowlist/#user_id";
import {
    canManageApplicationTesters,
    requireApplicationTesterManagement,
    type ApplicationCommandAuthorizationRepository,
    type ApplicationCommandAuthorizationTarget,
} from "../../src/api/util/utility/ApplicationAuthorization";
import { ApplicationTesters1778511000000 } from "../../src/util/migration/postgres/1778511000000-ApplicationTesters";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const applicationId = "100000000000000001";
const missingApplicationId = "100000000000000002";
const userId = "100000000000000003";

function createApplicationRepository(t: TestContext, application: ApplicationCommandAuthorizationTarget | null) {
    const repository = {
        findOne: t.mock.fn(async (_options: unknown) => application),
    } satisfies ApplicationCommandAuthorizationRepository;

    return repository;
}

function createTesterRepository(t: TestContext, affected = 1) {
    const repository = {
        delete: t.mock.fn(async (_criteria: unknown) => ({ affected })),
    } satisfies ApplicationTesterRepository;

    return repository;
}

function createApp(actorUserId: string, repositories: ApplicationTesterRepositories) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = actorUserId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/oauth2/applications/:application_id/allowlist/:user_id", createOAuth2ApplicationAllowlistUserRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, requestPath: string, init: { method?: string } = {}) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
            method: init.method,
        });
        const responseText = await response.text();
        const body = responseText ? (JSON.parse(responseText) as unknown) : undefined;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function createQueryRunner() {
    const queries: string[] = [];
    const queryRunner = {
        query(sql: string) {
            queries.push(sql);
            return Promise.resolve();
        },
    } as unknown as QueryRunner;

    return { queries, queryRunner };
}

describe("DELETE /oauth2/applications/:application_id/allowlist/:user_id", () => {
    test("declares authenticated DELETE metadata for removing application testers", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "oauth2", "applications", "#application_id", "allowlist", "#user_id.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Remove Application Tester"/);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
    });

    test("removes a stored application tester and returns 204", async (t) => {
        const applicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const testerRepository = createTesterRepository(t);

        const response = await requestJson(createApp("owner", { applicationRepository, testerRepository }), `/oauth2/applications/${applicationId}/allowlist/${userId}`, {
            method: "DELETE",
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(testerRepository.delete.mock.calls[0].arguments[0], {
            application_id: applicationId,
            user_id: userId,
        });
    });

    test("allows accepted team developers to remove testers", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "developer",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.DEVELOPER,
                    },
                ],
            },
        });
        const testerRepository = createTesterRepository(t);

        assert.equal(await removeApplicationTester(applicationId, userId, "developer", { applicationRepository, testerRepository }), true);
        assert.equal(testerRepository.delete.mock.callCount(), 1);
    });

    test("returns 403 before deleting for callers who cannot manage testers", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            bot: { id: "bot" },
            team: {
                members: [
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        });
        const testerRepository = createTesterRepository(t);

        const response = await requestJson(createApp("read-only", { applicationRepository, testerRepository }), `/oauth2/applications/${applicationId}/allowlist/${userId}`, {
            method: "DELETE",
        });

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(testerRepository.delete.mock.callCount(), 0);
    });

    test("returns 404 for unknown applications and missing testers", async (t) => {
        const missingApplicationRepository = createApplicationRepository(t, null);
        const testerRepository = createTesterRepository(t);
        const missingApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository: missingApplicationRepository, testerRepository }),
            `/oauth2/applications/${missingApplicationId}/allowlist/${userId}`,
            { method: "DELETE" },
        );

        const applicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const missingTesterRepository = createTesterRepository(t, 0);
        const missingTesterResponse = await requestJson(
            createApp("owner", { applicationRepository, testerRepository: missingTesterRepository }),
            `/oauth2/applications/${applicationId}/allowlist/${userId}`,
            { method: "DELETE" },
        );

        assert.equal(missingApplicationResponse.status, 404);
        assert.deepEqual(missingApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(testerRepository.delete.mock.callCount(), 0);

        assert.equal(missingTesterResponse.status, 404);
        assert.deepEqual(missingTesterResponse.body, {
            code: DiscordApiErrors.UNKNOWN_USER.code,
            message: DiscordApiErrors.UNKNOWN_USER.message,
        });
        assert.equal(missingTesterRepository.delete.mock.callCount(), 1);
    });

    test("validates malformed ids before authorization or deletion", async (t) => {
        const applicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const testerRepository = createTesterRepository(t);

        const malformedApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository, testerRepository }),
            `/oauth2/applications/not-a-snowflake/allowlist/${userId}`,
            { method: "DELETE" },
        );
        const malformedUserResponse = await requestJson(
            createApp("owner", { applicationRepository, testerRepository }),
            `/oauth2/applications/${applicationId}/allowlist/not-a-snowflake`,
            { method: "DELETE" },
        );

        assert.equal(malformedApplicationResponse.status, 404);
        assert.deepEqual(malformedApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(malformedUserResponse.status, 404);
        assert.deepEqual(malformedUserResponse.body, {
            code: DiscordApiErrors.UNKNOWN_USER.code,
            message: DiscordApiErrors.UNKNOWN_USER.message,
        });
        assert.equal(applicationRepository.findOne.mock.callCount(), 0);
        assert.equal(testerRepository.delete.mock.callCount(), 0);
    });
});

describe("application tester authorization", () => {
    test("allows owners, team owners, accepted admins, and accepted developers", async (t) => {
        const application = {
            owner: { id: "owner" },
            team: {
                owner_user_id: "team-owner",
                members: [
                    {
                        user_id: "admin",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.ADMIN,
                    },
                    {
                        user_id: "developer",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.DEVELOPER,
                    },
                ],
            },
        };
        const repository = createApplicationRepository(t, application);

        assert.equal(canManageApplicationTesters(application, "owner"), true);
        assert.equal(canManageApplicationTesters(application, "team-owner"), true);
        assert.equal(canManageApplicationTesters(application, "admin"), true);
        assert.equal(canManageApplicationTesters(application, "developer"), true);
        await requireApplicationTesterManagement("app", "developer", repository);
    });

    test("rejects bot users, invited members, read-only members, strangers, and unknown applications", async (t) => {
        const application = {
            owner: { id: "owner" },
            bot: { id: "application" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        };

        assert.equal(canManageApplicationTesters(application, "application"), false);
        assert.equal(canManageApplicationTesters(application, "invited"), false);
        assert.equal(canManageApplicationTesters(application, "read-only"), false);
        assert.equal(canManageApplicationTesters(application, "stranger"), false);
        await assert.rejects(
            () => requireApplicationTesterManagement("app", "stranger", createApplicationRepository(t, application)),
            (error) => (error as { code?: unknown }).code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        );
        await assert.rejects(
            () => requireApplicationTesterManagement("missing", "owner", createApplicationRepository(t, null)),
            (error) => (error as { code?: unknown }).code === DiscordApiErrors.UNKNOWN_APPLICATION.code,
        );
    });
});

describe("ApplicationTesters1778511000000", () => {
    test("creates application tester storage for allowlist removal", async () => {
        const migration = new ApplicationTesters1778511000000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepEqual(queries, [
            `
            CREATE TABLE application_testers (
                id int8 NOT NULL,
                application_id int8 NOT NULL,
                user_id int8 NOT NULL,
                state integer NOT NULL DEFAULT 1,
                CONSTRAINT "PK_application_testers_id" PRIMARY KEY (id),
                CONSTRAINT "FK_application_testers_application_id" FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
                CONSTRAINT "FK_application_testers_user_id" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT "UQ_application_testers_application_id_user_id" UNIQUE (application_id, user_id)
            );
        `,
            `CREATE INDEX "IDX_application_testers_application_id" ON application_testers (application_id);`,
            `CREATE INDEX "IDX_application_testers_user_id" ON application_testers (user_id);`,
        ]);
    });

    test("drops application tester storage on rollback", async () => {
        const migration = new ApplicationTesters1778511000000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [`DROP INDEX "IDX_application_testers_user_id";`, `DROP INDEX "IDX_application_testers_application_id";`, `DROP TABLE application_testers;`]);
    });
});
