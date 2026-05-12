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
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import {
    createCurrentUserGravityAttachmentsRouter,
    getCurrentUserGravityAttachmentsResponse,
    type GravityAttachmentSource,
    type GravityAttachmentsDependencies,
} from "../../src/api/routes/users/@me/gravity-attachments";

const coveredManifestIds = ["api:http:GET:/users/@me/gravity-attachments/"];
const assignedSourcePath = "/users/@me/gravity-attachments";
const assignedRouteName = "GET_USERS__ME_GRAVITY_ATTACHMENTS";
const sourceFile = "src/api/routes/users/@me/gravity-attachments.ts";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    minimum?: number;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /users/@me/gravity-attachments", () => {
    test("documents the assigned route identity and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/gravity-attachments/"]);
        assert.equal(assignedSourcePath, "/users/@me/gravity-attachments");
        assert.equal(assignedRouteName, "GET_USERS__ME_GRAVITY_ATTACHMENTS");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/gravity-attachments"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/gravity-attachments/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/users/@me/gravity-attachments"), false);

        const response = await requestJson(createAuthenticatedApp(createThrowingDependencies()), "/users/@me/gravity-attachments");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns only current-user durable cloud attachment metadata", async () => {
        const calls: string[] = [];
        const dependencies: GravityAttachmentsDependencies = {
            findCurrentUserAttachments: async (userId) => {
                calls.push(userId);
                return [
                    gravityAttachment({
                        id: "cloud-row-1",
                        userAttachmentId: "client-file-1",
                        userFilename: "status-image.png",
                        uploadFilename: "100000000000000010/CLOUD_batch/0/status-image.png",
                        userFileSize: 1234,
                        userOriginalContentType: "image/png",
                        contentType: "image/png",
                        height: 320,
                        width: 640,
                        userIsClip: false,
                    }),
                    gravityAttachment({
                        id: "cloud-row-2",
                        userFilename: "clip.mp4",
                        uploadFilename: "100000000000000010/CLOUD_batch/1/clip.mp4",
                        size: 4096,
                    }),
                ];
            },
            getCdnEndpoint: () => "https://cdn.example",
        };

        const response = await requestJson(createRouteApp(dependencies), "/users/@me/gravity-attachments");

        assert.equal(response.status, 200);
        assert.deepEqual(calls, ["viewer"]);
        assert.deepEqual(response.body, {
            attachments: [
                {
                    id: "client-file-1",
                    filename: "status-image.png",
                    upload_filename: "100000000000000010/CLOUD_batch/0/status-image.png",
                    upload_url: "https://cdn.example/_spacebar/cdn/attachments/100000000000000010/CLOUD_batch/0/status-image.png",
                    file_size: 1234,
                    original_content_type: "image/png",
                    content_type: "image/png",
                    height: 320,
                    width: 640,
                    is_clip: false,
                },
                {
                    id: "cloud-row-2",
                    filename: "clip.mp4",
                    upload_filename: "100000000000000010/CLOUD_batch/1/clip.mp4",
                    upload_url: "https://cdn.example/_spacebar/cdn/attachments/100000000000000010/CLOUD_batch/1/clip.mp4",
                    file_size: 4096,
                },
            ],
        });

        const firstAttachment = (response.body as { attachments: Record<string, unknown>[] }).attachments[0];
        assert.equal("user_id" in firstAttachment, false);
        assert.equal("channel_id" in firstAttachment, false);
        assert.equal("message_id" in firstAttachment, false);
    });

    test("returns an empty wrapper when there is no local current-user attachment state", async () => {
        const response = await getCurrentUserGravityAttachmentsResponse("viewer", {
            findCurrentUserAttachments: async () => [],
            getCdnEndpoint: () => undefined,
        });

        assert.deepEqual(response, { attachments: [] });
    });

    test("declares source-backed metadata and generated artifacts without taking adjacent routes", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "gravity-attachments.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Current User Gravity Attachments"/);
        assert.match(
            routeSource,
            /description:\s*"Returns the current user's locally persisted cloud attachment metadata for Discord gravity attachment compatibility without fabricating recommendation, upload, media, channel, or message state\."/,
        );
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GravityAttachmentsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.post|gravity-attachments-upload|gravity-icymi|message_id|ranking/i);

        assert.equal(schemas.GravityAttachmentsResponse.type, "object");
        assert.deepEqual(schemas.GravityAttachmentsResponse.required, ["attachments"]);
        assert.equal(schemas.GravityAttachmentsResponse.properties?.attachments?.type, "array");
        assert.equal(schemas.GravityAttachmentsResponse.properties?.attachments?.items?.$ref, "#/definitions/GravityAttachment");
        assert.equal(schemas.GravityAttachment.type, "object");
        assert.deepEqual(schemas.GravityAttachment.required?.sort(), ["filename", "id", "upload_filename", "upload_url"]);
        assert.equal(schemas.GravityAttachment.properties?.file_size?.minimum, 0);
        assert.equal(schemas.GravityAttachment.properties?.height?.minimum, 0);
        assert.equal(schemas.GravityAttachment.properties?.width?.minimum, 0);

        const route = openapi.paths?.["/users/@me/gravity-attachments/"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GravityAttachmentsResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.post, undefined);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(sourceEntry?.route_name, assignedRouteName);
        assert.equal(sourceEntry?.source, sourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GravityAttachmentsResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/users/@me/gravity-attachments-upload"),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/users/@me/gravity-icymi"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/users/@me/gravity-attachments/");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GravityAttachmentsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/gravity-attachments/");
        assert.equal(contract?.sourceFile, sourceFile);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "GravityAttachmentsResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === "GRAVITY_ATTACHMENTS"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath && entry.route_name === "GRAVITY_ATTACHMENTS"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/gravity-attachments-upload"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/gravity-icymi"),
            true,
        );
    });
});

function gravityAttachment(overrides: Partial<GravityAttachmentSource>): GravityAttachmentSource {
    return {
        id: "cloud-row",
        userFilename: "file.bin",
        uploadFilename: "channel/CLOUD_batch/0/file.bin",
        ...overrides,
    };
}

function createRouteApp(dependencies: GravityAttachmentsDependencies) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/gravity-attachments", createCurrentUserGravityAttachmentsRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp(dependencies: GravityAttachmentsDependencies) {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/gravity-attachments", createCurrentUserGravityAttachmentsRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createThrowingDependencies(): GravityAttachmentsDependencies {
    return {
        findCurrentUserAttachments: async () => {
            throw new Error("route should not load attachment state before authentication");
        },
        getCdnEndpoint: () => {
            throw new Error("route should not load CDN config before authentication");
        },
    };
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}
