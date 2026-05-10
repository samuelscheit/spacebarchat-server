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
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { StickerPack, type Sticker } from "@spacebar/util";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import stickerPacksRouter from "../../src/api/routes/sticker-packs";
import stickerPackRouter, { toStickerPackResponse } from "../../src/api/routes/sticker-packs/#sticker_pack_id";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

const coveredManifestIds = ["api:http:GET:/sticker-packs/:sticker_pack_id/"];

type StickerPackEntity = StickerPack & { sku_id?: string | null };

function createSticker(overrides: Partial<Sticker> & { sort_value?: number | null } = {}) {
    return {
        id: "749054660769218631",
        name: "Wave",
        description: "Wumpus waves hello",
        tags: "wumpus, hello",
        type: 1,
        format_type: 3,
        pack_id: "847199849233514549",
        available: true,
        sort_value: 12,
        ...overrides,
    } as Sticker & { sort_value?: number | null };
}

function createStickerPack(overrides: Partial<StickerPackEntity> = {}) {
    return {
        id: "847199849233514549",
        name: "Wumpus Beyond",
        description: "Say hello to Wumpus!",
        banner_asset_id: "761773777976819732",
        cover_sticker_id: "749053689419006003",
        stickers: [createSticker()],
        cover_sticker: { id: "749053689419006003" },
        ...overrides,
    } as StickerPackEntity;
}

function createStickerPackApp(options: { authentication?: boolean } = {}) {
    const app = express();
    if (options.authentication) app.use(Authentication);
    app.use("/sticker-packs/:sticker_pack_id", stickerPackRouter);
    app.use(ErrorHandler);
    return app;
}

function createStickerPacksListApp() {
    const app = express();
    app.use("/sticker-packs", stickerPacksRouter);
    app.use(ErrorHandler);
    return app;
}

describe("GET /sticker-packs/:sticker_pack_id", () => {
    test("declares the assigned manifest route id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/sticker-packs/:sticker_pack_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/sticker-packs/847199849233514549"), false);

        const response = await requestJson(createStickerPackApp({ authentication: true }), "/sticker-packs/847199849233514549");

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
            code: 401,
            message: "Error: Missing Authorization Header",
        });
    });

    test("loads the requested pack with stickers and returns the documented pack response fields", async (t) => {
        let receivedOptions: unknown;
        t.mock.method(StickerPack, "findOneOrFail", async (options: unknown) => {
            receivedOptions = options;
            return createStickerPack({ sku_id: "847199849233514547" });
        });

        const response = await requestJson(createStickerPackApp(), "/sticker-packs/847199849233514549");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            where: { id: "847199849233514549" },
            relations: { stickers: true },
        });
        assert.deepEqual(response.body, {
            id: "847199849233514549",
            stickers: [
                {
                    id: "749054660769218631",
                    name: "Wave",
                    description: "Wumpus waves hello",
                    tags: "wumpus, hello",
                    type: 1,
                    format_type: 3,
                    pack_id: "847199849233514549",
                    available: true,
                    sort_value: 12,
                },
            ],
            name: "Wumpus Beyond",
            sku_id: "847199849233514547",
            cover_sticker_id: "749053689419006003",
            description: "Say hello to Wumpus!",
            banner_asset_id: "761773777976819732",
        });
    });

    test("does not synthesize SKU or relation internals when local persistence lacks those fields", () => {
        assert.deepEqual(
            toStickerPackResponse(
                createStickerPack({
                    banner_asset_id: undefined,
                    cover_sticker_id: undefined,
                    description: undefined,
                    stickers: [
                        createSticker({
                            available: undefined,
                            description: undefined,
                            pack_id: undefined,
                            sort_value: undefined,
                            tags: undefined,
                        }),
                    ],
                }),
            ),
            {
                id: "847199849233514549",
                stickers: [
                    {
                        id: "749054660769218631",
                        name: "Wave",
                        description: null,
                        tags: "",
                        type: 1,
                        format_type: 3,
                    },
                ],
                name: "Wumpus Beyond",
                description: null,
            },
        );
    });

    test("returns APIErrorResponse 404 semantics for an unknown sticker pack", async (t) => {
        t.mock.method(StickerPack, "findOneOrFail", async () => {
            const error = new Error('Could not find any entity of type "StickerPack" matching: {}');
            error.name = "EntityNotFoundError";
            throw error;
        });

        const response = await requestJson(createStickerPackApp(), "/sticker-packs/404000000000000000");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 404,
            message: "StickerPack could not be found",
        });
    });

    test("keeps the adjacent sticker pack list response intact", async (t) => {
        t.mock.method(StickerPack, "find", async () => [createStickerPack({ stickers: [] })]);

        const response = await requestJson(createStickerPacksListApp(), "/sticker-packs");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            sticker_packs: [createStickerPack({ stickers: [] })],
        });
    });

    test("declares generated schemas, route metadata, and regenerated catalog coverage", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: OpenApiOperation }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: ManifestEntry[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as SourceCatalogEntry[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: SourceCatalogEntry[];
        };

        assert.deepEqual(schemas.StickerPackResponse.required, ["description", "id", "name", "stickers"]);
        assert.equal(schemas.StickerPackResponse.properties?.id?.type, "string");
        assert.equal(schemas.StickerPackResponse.properties?.stickers?.items?.$ref, "#/definitions/StickerResponse");
        assert.equal(schemas.StickerPackResponse.properties?.sku_id?.type, "string");
        assert.deepEqual(schemas.StickerPackResponse.properties?.description?.type, ["null", "string"]);
        assert.equal(schemas.StickerPackResponse.properties?.cover_sticker_id?.type, "string");
        assert.equal(schemas.StickerPackResponse.properties?.banner_asset_id?.type, "string");

        const route = openapi.paths?.["/sticker-packs/{sticker_pack_id}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StickerPackResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StickerPackResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.route_name === "GET_STICKER_PACKS_STICKER_PACK_ID");
        assert.equal(catalogEntry?.method, "GET");
        assert.equal(catalogEntry?.route, "/sticker-packs/{sticker_pack_id}");
        assert.equal(catalogEntry?.source, "src/api/routes/sticker-packs/#sticker_pack_id/index.ts");

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/sticker-packs/{param}" && entry.method === "GET"),
            false,
        );
    });
});

type JsonSchema = {
    type?: string | string[];
    $ref?: string;
    items?: { $ref?: string };
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

type OpenApiOperation = {
    responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
    security?: unknown;
};

type ManifestEntry = {
    id?: string;
    authMode?: string;
    routeMetadata?: {
        responseBodies?: string[];
        responseStatuses?: number[];
    };
};

type SourceCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
};
