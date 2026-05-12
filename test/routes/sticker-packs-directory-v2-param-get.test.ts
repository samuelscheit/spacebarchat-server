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
import stickerPackRouter from "../../src/api/routes/sticker-packs/#sticker_pack_id";
import { createStickerPacksDirectoryV2Router, getStickerPacksDirectory, type StickerPacksDirectoryProvider } from "../../src/api/routes/sticker-packs/directory-v2/#param";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

const coveredManifestIds = ["api:http:GET:/sticker-packs/directory-v2/:param/"];

type StickerPackEntity = StickerPack & { sku_id?: string | null };

function readJson<T>(...parts: string[]): T {
    return JSON.parse(readFileSync(join(process.cwd(), ...parts), "utf8")) as T;
}

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

function createStickerPacksDirectoryApp(options: { authentication?: boolean; provider?: StickerPacksDirectoryProvider } = {}) {
    const app = express();
    if (options.authentication) app.use(Authentication);
    app.use("/sticker-packs/directory-v2/:param", createStickerPacksDirectoryV2Router(options.provider));
    app.use(ErrorHandler);
    return app;
}

function createAdjacentStickerPackApp() {
    const app = express();
    app.use(
        "/sticker-packs/directory-v2/:param",
        createStickerPacksDirectoryV2Router(async () => []),
    );
    app.use("/sticker-packs/:sticker_pack_id", stickerPackRouter);
    app.use("/sticker-packs", stickerPacksRouter);
    app.use(ErrorHandler);
    return app;
}

describe("GET /sticker-packs/directory-v2/:param", () => {
    test("declares the assigned manifest route id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/sticker-packs/directory-v2/:param/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/sticker-packs/directory-v2/featured"), false);

        const response = await requestJson(createStickerPacksDirectoryApp({ authentication: true }), "/sticker-packs/directory-v2/featured");

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
            code: 401,
            message: "Error: Missing Authorization Header",
        });
    });

    test("returns only serialized local sticker packs for the requested directory parameter", async () => {
        let receivedParam: string | undefined;
        const provider: StickerPacksDirectoryProvider = async (param) => {
            receivedParam = param;
            return [createStickerPack({ sku_id: "847199849233514547" })];
        };

        const response = await requestJson(createStickerPacksDirectoryApp({ provider }), "/sticker-packs/directory-v2/featured");
        const body = response.body as Record<string, unknown>;

        assert.equal(receivedParam, "featured");
        assert.equal(response.status, 200);
        assert.deepEqual(Object.keys(body).sort(), ["sticker_packs"]);
        assert.deepEqual(body, {
            sticker_packs: [
                {
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
                },
            ],
        });
    });

    test("default provider loads local sticker packs with stickers and no directory ranking state", async (t) => {
        let receivedOptions: unknown;
        t.mock.method(StickerPack, "find", async (options: unknown) => {
            receivedOptions = options;
            return [createStickerPack()];
        });

        const stickerPacks = await getStickerPacksDirectory("featured");

        assert.deepEqual(receivedOptions, {
            relations: { stickers: true },
        });
        assert.deepEqual(stickerPacks, [createStickerPack()]);
    });

    test("keeps adjacent sticker-pack detail and list routes intact", async (t) => {
        t.mock.method(StickerPack, "findOneOrFail", async () => createStickerPack({ stickers: [] }));
        t.mock.method(StickerPack, "find", async () => [createStickerPack({ stickers: [] })]);

        const detailResponse = await requestJson(createAdjacentStickerPackApp(), "/sticker-packs/847199849233514549");
        const listResponse = await requestJson(createAdjacentStickerPackApp(), "/sticker-packs");

        assert.equal(detailResponse.status, 200);
        assert.equal((detailResponse.body as { id?: string }).id, "847199849233514549");
        assert.deepEqual(listResponse.body, {
            sticker_packs: [createStickerPack({ stickers: [] })],
        });
    });

    test("declares generated schemas, route metadata, contract coverage, and missing-route removal", () => {
        const schemas = readJson<Record<string, JsonSchema>>("assets", "schemas.json");
        const openapi = readJson<{ paths?: Record<string, { get?: OpenApiOperation }> }>("assets", "openapi.json");
        const manifest = readJson<{ entries?: ManifestEntry[] }>("assets", "testing-manifest.json");
        const contracts = readJson<{ contracts?: ManifestEntry[] }>("test", "generated", "http-contracts.json");
        const sourceCatalog = readJson<SourceCatalogEntry[]>("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const missingRoutes = readJson<{ routes?: string[]; missing_entries?: SourceCatalogEntry[] }>("packages", "missing-routes", "missing.json");

        assert.deepEqual(schemas.StickerPacksDirectoryResponse.required, ["sticker_packs"]);
        assert.equal(schemas.StickerPacksDirectoryResponse.properties?.sticker_packs?.items?.$ref, "#/definitions/StickerPackResponse");

        const route = openapi.paths?.["/sticker-packs/directory-v2/{param}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StickerPacksDirectoryResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/sticker-packs/directory-v2/#param/index.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StickerPacksDirectoryResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contractEntry?.authMode, "bearer");
        assert.equal(contractEntry?.sourceFile, "src/api/routes/sticker-packs/directory-v2/#param/index.ts");

        const catalogEntry = sourceCatalog.find((entry) => entry.route_name === "GET_STICKER_PACKS_DIRECTORY_V2_PARAM");
        assert.equal(catalogEntry?.method, "GET");
        assert.equal(catalogEntry?.route, "/sticker-packs/directory-v2/{param}");
        assert.equal(catalogEntry?.source, "src/api/routes/sticker-packs/directory-v2/#param/index.ts");

        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/sticker-packs" && entry.method === "GET"),
            true,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/sticker-packs/{sticker_pack_id}" && entry.method === "GET"),
            true,
        );
        assert.equal(missingRoutes.routes?.includes("/sticker-packs/directory-v2/{param}"), false);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/sticker-packs/directory-v2/{param}" && entry.method === "GET"),
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
    manifestId?: string;
    authMode?: string;
    sourceFile?: string;
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
