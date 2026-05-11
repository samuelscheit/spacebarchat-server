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
import express from "express";
import { Categories, Guild, GuildFeature } from "@spacebar/util";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import discoveryRouter from "../../src/api/routes/discovery";

type MutableGuild = {
    findAndCount: typeof Guild.findAndCount;
};

type MutableCategories = {
    find: typeof Categories.find;
};

const mutableGuild = Guild as unknown as MutableGuild;
const mutableCategories = Categories as unknown as MutableCategories;

describe("GET /discovery/search", () => {
    test("is public without opening adjacent discovery routes", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/discovery/search?query=spacebar"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/discovery/search?query=spacebar"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/discovery/categories"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/discovery/valid-term?term=spacebar"), false);

        const restore = installSearchStorageMocks();
        try {
            const response = await requestJson(createRouteApp(), "/discovery/search?query=Space%20Guild&limit=1");

            assert.equal(response.status, 200);
            const body = response.body as { hits?: Array<Record<string, unknown>>; nbHits?: number; length?: number; query?: string };
            assert.equal(body.nbHits, 1);
            assert.equal(body.length, 1);
            assert.equal(body.query, "Space Guild");
            assert.equal(body.hits?.[0]?.name, "Space Guild");
            assert.equal(body.hits?.[0]?.objectID, "100000000000002001");
            assert.equal(body.hits?.[0]?.approximate_member_count, 250);
            assert.equal(body.hits?.[0]?.approximate_presence_count, 5);
            assert.equal("discovery_weight" in body.hits![0], false);
            assert.equal("member_count" in body.hits![0], false);
        } finally {
            restore();
        }
    });

    test("returns form-body errors before querying guild storage", async () => {
        const originalFindAndCount = mutableGuild.findAndCount;
        mutableGuild.findAndCount = (async () => {
            throw new Error("guild storage should not be queried for invalid search input");
        }) as typeof Guild.findAndCount;

        try {
            const response = await requestJson(createRouteApp(), "/discovery/search?limit=99");
            const body = response.body as { code?: number; message?: string; errors?: Record<string, unknown> };

            assert.equal(response.status, 400);
            assert.equal(body.code, 50035);
            assert.equal(body.message, "Invalid Form Body");
            assert.ok(body.errors?.limit);
        } finally {
            mutableGuild.findAndCount = originalFindAndCount;
        }
    });

    test("declares public search metadata in generated route artifacts", () => {
        const openapi = readJson<{
            paths?: Record<string, { get?: { parameters?: { name?: string; in?: string; required?: boolean }[]; responses?: Record<string, unknown>; security?: unknown } }>;
        }>("assets/openapi.json");
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>("assets/testing-manifest.json");
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                response_schema_refs?: string[];
            }[]
        >("packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json");

        const route = openapi.paths?.["/discovery/search"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "query" && parameter.required !== true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "limit"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "offset"),
            true,
        );
        assert.ok(route?.responses?.["200"]);
        assert.ok(route?.responses?.["400"]);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/discovery/search");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("DiscoverySearchResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/discovery/search");
        assert.equal(sourceCatalogEntry?.route_name, "GET_DISCOVERY_SEARCH");
        assert.equal(sourceCatalogEntry?.response_schema_refs?.includes("DiscoverySearchResponse"), true);
        assert.equal(sourceCatalogEntry?.response_schema_refs?.includes("APIErrorResponse"), true);
    });
});

function createRouteApp() {
    const app = express();
    app.use(Authentication);
    app.use("/discovery", discoveryRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : null,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function installSearchStorageMocks() {
    const originalFindAndCount = mutableGuild.findAndCount;
    const originalFindCategories = mutableCategories.find;

    mutableGuild.findAndCount = (async () => [[publishedGuildFixture()], 1]) as typeof Guild.findAndCount;
    mutableCategories.find = (async () => [
        {
            id: 1,
            name: "Gaming",
            localizations: { de: "Gaming" },
            is_primary: true,
        },
    ]) as typeof Categories.find;

    return () => {
        mutableGuild.findAndCount = originalFindAndCount;
        mutableCategories.find = originalFindCategories;
    };
}

function publishedGuildFixture(): Guild {
    return {
        id: "100000000000002001",
        name: "Space Guild",
        icon: null,
        banner: null,
        splash: null,
        description: "A public Spacebar discovery guild",
        discovery_splash: "discovery-splash",
        primary_category_id: 1,
        features: [GuildFeature.Discoverable],
        preferred_locale: "en-US",
        premium_subscription_count: 0,
        member_count: 250,
        presence_count: 5,
        discovery_weight: 100,
        discovery_excluded: false,
    } as unknown as Guild;
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}
