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
import { describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import {
    APPLICATION_VERIFICATION_MISSING_INSTALL_LINK_MESSAGE,
    APPLICATION_VERIFICATION_MISSING_PRIVACY_POLICY_MESSAGE,
    APPLICATION_VERIFICATION_MISSING_TEAM_MESSAGE,
    APPLICATION_VERIFICATION_MISSING_TOS_MESSAGE,
    APPLICATION_VERIFICATION_TEAM_MEMBERS_MESSAGE,
    buildApplicationVerificationEligibilityErrors,
    createApplicationVerificationRouter,
    getApplicationVerificationEligibility,
    hasApplicationInstallLink,
    type ApplicationVerificationRepositories,
    type ApplicationVerificationTarget,
} from "../../src/api/routes/applications/#application_id/verification";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import { DiscordApiErrors } from "../../src/util";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/verification/"];

type JsonSchema = {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

function createEligibleApplication(overrides: Partial<ApplicationVerificationTarget> = {}): ApplicationVerificationTarget {
    return {
        owner: { id: "owner" },
        team: {
            owner_user_id: "team-owner",
            owner_user: {
                id: "team-owner",
                verified: true,
                mfa_enabled: true,
            },
            members: [
                {
                    user_id: "team-owner",
                    membership_state: TeamMemberState.ACCEPTED,
                    role: TeamMemberRole.ADMIN,
                    user: {
                        id: "team-owner",
                        verified: true,
                        mfa_enabled: true,
                    },
                },
                {
                    user_id: "accepted-member",
                    membership_state: TeamMemberState.ACCEPTED,
                    role: TeamMemberRole.READ_ONLY,
                    user: {
                        id: "accepted-member",
                        verified: true,
                        mfa_enabled: true,
                    },
                },
            ],
        },
        terms_of_service_url: "https://example.com/terms",
        privacy_policy_url: "https://example.com/privacy",
        install_params: {
            scopes: ["bot"],
            permissions: "0",
        },
        ...overrides,
    };
}

function createApp(repositories: ApplicationVerificationRepositories, userId = "team-owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/verification", createApplicationVerificationRouter(repositories));
    app.use(ErrorHandler);
    return app;
}

async function requestRoute(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
        const text = await response.text();
        const body = text ? (JSON.parse(text) as unknown) : undefined;

        return {
            status: response.status,
            body,
            text,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function isDiscordError(error: unknown, expected: typeof DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION) {
    return (error as { code?: unknown; message?: unknown })?.code === expected.code && (error as { code?: unknown; message?: unknown })?.message === expected.message;
}

describe("GET /applications/:application_id/verification", () => {
    test("loads owner, team, verification fields, and account requirements before returning the deprecated empty success", async (t) => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/verification/"]);
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => createEligibleApplication()),
        };

        await getApplicationVerificationEligibility("application-id", "accepted-member", { applicationRepository });

        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "application-id" },
            relations: {
                owner: true,
                team: {
                    owner_user: true,
                    members: {
                        user: true,
                    },
                },
            },
            select: {
                owner: {
                    id: true,
                },
                team: {
                    owner_user_id: true,
                    owner_user: {
                        id: true,
                        verified: true,
                        mfa_enabled: true,
                    },
                    members: {
                        user_id: true,
                        membership_state: true,
                        role: true,
                        user: {
                            id: true,
                            verified: true,
                            mfa_enabled: true,
                        },
                    },
                },
                terms_of_service_url: true,
                privacy_policy_url: true,
                install_params: true,
                custom_install_url: true,
            },
        });
    });

    test("accepts either local install params or a custom install URL", () => {
        assert.equal(hasApplicationInstallLink({ install_params: { scopes: ["bot"], permissions: "0" } }), true);
        assert.equal(hasApplicationInstallLink({ custom_install_url: "https://example.com/install" }), true);
        assert.equal(hasApplicationInstallLink({ install_params: { scopes: [], permissions: "0" } }), false);
        assert.equal(hasApplicationInstallLink({}), false);
    });

    test("fails closed for missing locally verifiable eligibility criteria", () => {
        const errors = buildApplicationVerificationEligibilityErrors({
            owner: { id: "owner" },
            team: {
                owner_user_id: "team-owner",
                owner_user: {
                    id: "team-owner",
                    verified: true,
                    mfa_enabled: false,
                },
                members: [
                    {
                        user_id: "accepted-member",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                        user: {
                            id: "accepted-member",
                            verified: false,
                            mfa_enabled: true,
                        },
                    },
                    {
                        user_id: "invited-member",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.READ_ONLY,
                        user: null,
                    },
                ],
            },
            terms_of_service_url: " ",
            privacy_policy_url: null,
            install_params: null,
        });

        assert.equal(errors.terms_of_service_url?.message, APPLICATION_VERIFICATION_MISSING_TOS_MESSAGE);
        assert.equal(errors.privacy_policy_url?.message, APPLICATION_VERIFICATION_MISSING_PRIVACY_POLICY_MESSAGE);
        assert.equal(errors.install_params?.message, APPLICATION_VERIFICATION_MISSING_INSTALL_LINK_MESSAGE);
        assert.equal(errors.team_members?.message, APPLICATION_VERIFICATION_TEAM_MEMBERS_MESSAGE);
        assert.equal(errors.team_id, undefined);
    });

    test("requires the application to belong to a team", () => {
        const errors = buildApplicationVerificationEligibilityErrors(
            createEligibleApplication({
                team: null,
            }),
        );

        assert.equal(errors.team_id?.message, APPLICATION_VERIFICATION_MISSING_TEAM_MESSAGE);
    });

    test("throws unknown application before checking authorization or eligibility", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getApplicationVerificationEligibility("missing-application", "owner", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
    });

    test("rejects callers who cannot access the owning application or team before eligibility errors", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) =>
                createEligibleApplication({
                    terms_of_service_url: null,
                }),
            ),
        };

        await assert.rejects(
            () => getApplicationVerificationEligibility("application-id", "intruder", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION),
        );
    });

    test("returns the mounted empty 204 response for an eligible owning-team member", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => createEligibleApplication()),
        };

        const response = await requestRoute(createApp({ applicationRepository }, "accepted-member"), "/applications/application-id/verification");

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
        assert.equal(response.body, undefined);
    });

    test("returns the mounted unknown application response", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        const response = await requestRoute(createApp({ applicationRepository }), "/applications/missing-application/verification");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("returns the mounted authorization response for non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => createEligibleApplication()),
        };

        const response = await requestRoute(createApp({ applicationRepository }, "intruder"), "/applications/application-id/verification");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("returns field errors for ineligible applications from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) =>
                createEligibleApplication({
                    privacy_policy_url: null,
                    custom_install_url: undefined,
                    install_params: null,
                }),
            ),
        };

        const response = await requestRoute(createApp({ applicationRepository }), "/applications/application-id/verification");
        const body = response.body as { errors?: { install_params?: { _errors?: { message?: string }[] }; privacy_policy_url?: { _errors?: { message?: string }[] } } };

        assert.equal(response.status, 400);
        assert.equal(body.errors?.privacy_policy_url?._errors?.[0]?.message, APPLICATION_VERIFICATION_MISSING_PRIVACY_POLICY_MESSAGE);
        assert.equal(body.errors?.install_params?._errors?.[0]?.message, APPLICATION_VERIFICATION_MISSING_INSTALL_LINK_MESSAGE);
    });

    test("documents authenticated deprecated route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "verification.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Application Verification Eligibility"/);
        assert.match(routeSource, /description:\s*"Checks if an application is eligible to apply for verification\. This endpoint is deprecated\."/);
        assert.match(routeSource, /204:\s*\{\}/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates source catalog, OpenAPI, testing manifest, contract, and suite coverage metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const contracts = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const suiteCoverage = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "suite-coverage.json"), "utf8")) as unknown;

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/applications/{application_id}/verification");
        assert.equal(sourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_VERIFICATION");
        assert.equal(sourceEntry?.source, "src/api/routes/applications/#application_id/verification.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        const route = openapi.paths?.["/applications/{application_id}/verification/"]?.get;
        assert.equal(route?.summary, "Get Application Verification Eligibility");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["204"]?.content, undefined);
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.ok(openapi.components?.schemas?.APIErrorResponse);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 400, 401, 404]);
        assert.ok(JSON.stringify(suiteCoverage).includes(coveredManifestIds[0]));
    });
});
