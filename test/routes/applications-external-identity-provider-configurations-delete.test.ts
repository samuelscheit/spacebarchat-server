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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import {
    createApplicationExternalIdentityProviderConfigurationsRouter,
    deleteApplicationExternalIdentityProviderConfiguration,
    parseApplicationExternalIdentityProviderType,
    UNKNOWN_APPLICATION_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATION,
    type ApplicationExternalIdentityProviderConfigurationRepository,
    type ApplicationExternalIdentityProviderConfigurationsRepositories,
} from "../../src/api/routes/applications/#application_id/external-identity-provider-configurations";
import { type ApplicationCommandAuthorizationRepository, type ApplicationCommandAuthorizationTarget } from "../../src/api/util/utility/ApplicationAuthorization";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import { DiscordApiErrors } from "../../src/util";

const coveredManifestId = "api:http:DELETE:/applications/:application_id/external-identity-provider-configurations/:identity_provider_type";
const applicationId = "100000000000000001";

function createApplicationRepository(t: TestContext, application: ApplicationCommandAuthorizationTarget | null = { owner: { id: "owner" } }) {
    return {
        findOne: t.mock.fn(async (_options: unknown) => application),
    } satisfies ApplicationCommandAuthorizationRepository;
}

function createProviderConfigurationRepository(t: TestContext, deleted = true) {
    return {
        deleteConfiguration: t.mock.fn(async (_options: unknown) => deleted),
    } satisfies ApplicationExternalIdentityProviderConfigurationRepository;
}

function createApp(userId: string, repositories: ApplicationExternalIdentityProviderConfigurationsRepositories) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/external-identity-provider-configurations", createApplicationExternalIdentityProviderConfigurationsRouter(repositories));
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

describe("DELETE /applications/:application_id/external-identity-provider-configurations/:identity_provider_type", () => {
    test("declares authenticated DELETE metadata for the assigned route only", () => {
        assert.equal(coveredManifestId, "api:http:DELETE:/applications/:application_id/external-identity-provider-configurations/:identity_provider_type");
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "external-identity-provider-configurations.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Remove Application External Identity Provider Configuration"/);
        assert.match(routeSource, /router\.delete\(\s*"\/:identity_provider_type"/);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("normalizes documented external provider types and rejects non-external providers", () => {
        assert.equal(parseApplicationExternalIdentityProviderType("unity"), "UNITY");
        assert.equal(parseApplicationExternalIdentityProviderType("EPIC_ONLINE_SERVICES"), "EPIC_ONLINE_SERVICES");
        assert.equal(parseApplicationExternalIdentityProviderType("playstation_network"), "PLAYSTATION_NETWORK");

        assert.throws(
            () => parseApplicationExternalIdentityProviderType("DISCORD_BOT"),
            (error) =>
                (error as { code?: unknown; message?: unknown }).code === DiscordApiErrors.UNKNOWN_PROVIDER.code &&
                (error as { code?: unknown; message?: unknown }).message === DiscordApiErrors.UNKNOWN_PROVIDER.message,
        );
        assert.throws(
            () => parseApplicationExternalIdentityProviderType("not-a-provider"),
            (error) =>
                (error as { code?: unknown; message?: unknown }).code === DiscordApiErrors.UNKNOWN_PROVIDER.code &&
                (error as { code?: unknown; message?: unknown }).message === DiscordApiErrors.UNKNOWN_PROVIDER.message,
        );
    });

    test("deletes a locally persisted configuration for application owners", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const providerConfigurationRepository = createProviderConfigurationRepository(t);

        assert.equal(
            await deleteApplicationExternalIdentityProviderConfiguration(applicationId, "owner", "UNITY", {
                applicationRepository,
                providerConfigurationRepository,
            }),
            true,
        );
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(providerConfigurationRepository.deleteConfiguration.mock.calls[0].arguments[0], {
            applicationId,
            providerType: "UNITY",
        });
    });

    test("allows accepted owning-team developers and rejects read-only team members before deletion", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "developer",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.DEVELOPER,
                    },
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        });
        const providerConfigurationRepository = createProviderConfigurationRepository(t);

        assert.equal(
            await deleteApplicationExternalIdentityProviderConfiguration(applicationId, "developer", "OIDC", {
                applicationRepository,
                providerConfigurationRepository,
            }),
            true,
        );
        await assert.rejects(
            () =>
                deleteApplicationExternalIdentityProviderConfiguration(applicationId, "read-only", "OIDC", {
                    applicationRepository,
                    providerConfigurationRepository,
                }),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
        assert.equal(providerConfigurationRepository.deleteConfiguration.mock.callCount(), 1);
    });

    test("fails closed when no durable provider configuration storage is present", async (t) => {
        const applicationRepository = createApplicationRepository(t);

        assert.equal(await deleteApplicationExternalIdentityProviderConfiguration(applicationId, "owner", "STEAM", { applicationRepository }), false);
    });

    test("returns 204 without a response body when a stored configuration is deleted", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const providerConfigurationRepository = createProviderConfigurationRepository(t);

        const response = await requestJson(
            createApp("owner", { applicationRepository, providerConfigurationRepository }),
            `/applications/${applicationId}/external-identity-provider-configurations/UNITY`,
            { method: "DELETE" },
        );

        assert.deepEqual(response, { status: 204, body: undefined });
        assert.deepEqual(providerConfigurationRepository.deleteConfiguration.mock.calls[0].arguments[0], {
            applicationId,
            providerType: "UNITY",
        });
    });

    test("returns 404 instead of fabricating deletion success without local backing state", async (t) => {
        const applicationRepository = createApplicationRepository(t);

        const response = await requestJson(createApp("owner", { applicationRepository }), `/applications/${applicationId}/external-identity-provider-configurations/STEAM`, {
            method: "DELETE",
        });

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_APPLICATION_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATION.code,
            message: UNKNOWN_APPLICATION_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATION.message,
        });
    });

    test("returns 400 for invalid provider path values after application authorization", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const providerConfigurationRepository = createProviderConfigurationRepository(t);

        const response = await requestJson(
            createApp("owner", { applicationRepository, providerConfigurationRepository }),
            `/applications/${applicationId}/external-identity-provider-configurations/not-a-provider`,
            { method: "DELETE" },
        );

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_PROVIDER.code,
            message: DiscordApiErrors.UNKNOWN_PROVIDER.message,
        });
        assert.equal(providerConfigurationRepository.deleteConfiguration.mock.callCount(), 0);
    });

    test("returns 403 before provider deletion for callers who cannot manage the application", async (t) => {
        const applicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const providerConfigurationRepository = createProviderConfigurationRepository(t);

        const response = await requestJson(
            createApp("attacker", { applicationRepository, providerConfigurationRepository }),
            `/applications/${applicationId}/external-identity-provider-configurations/UNITY`,
            { method: "DELETE" },
        );

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(providerConfigurationRepository.deleteConfiguration.mock.callCount(), 0);
    });
});
