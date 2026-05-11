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
import path from "node:path";
import test from "node:test";
import { GuildFeature } from "../../util/util/GuildFeatures";
import { ajv } from "../Validator";
import { toDiscoverySearchCategory, toDiscoverySearchGuild } from "./DiscoverySearchResponse";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("toDiscoverySearchGuild maps guild entities to published discovery search hits", () => {
    const category = toDiscoverySearchCategory({
        id: 1,
        is_primary: true,
        name: "Gaming",
        localizations: { de: "Gaming" },
    });

    assert.deepEqual(
        toDiscoverySearchGuild(
            {
                id: "100",
                name: "Discovery guild",
                icon: undefined,
                banner: "banner-hash",
                splash: null,
                description: undefined,
                discovery_splash: "discovery-splash",
                primary_category_id: 1,
                features: [GuildFeature.Discoverable],
                preferred_locale: "en-US",
                premium_subscription_count: 2,
                member_count: 42,
                presence_count: 5,
            },
            new Map([[1, category]]),
        ),
        {
            id: "100",
            name: "Discovery guild",
            icon: null,
            banner: "banner-hash",
            splash: null,
            description: null,
            approximate_presence_count: 5,
            approximate_member_count: 42,
            premium_subscription_count: 2,
            preferred_locale: "en-US",
            auto_removed: false,
            discovery_splash: "discovery-splash",
            primary_category_id: 1,
            vanity_url_code: null,
            is_published: true,
            keywords: [],
            nsfw_properties: null,
            features: [GuildFeature.Discoverable],
            categories: [category],
            primary_category: category,
            objectID: "100",
        },
    );
});

test("DiscoverySearchResponse uses search hit DTOs instead of Guild entities", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.DiscoverySearchResponse;
    const hit = schemas.DiscoverySearchGuild;

    assert.equal(response.properties?.hits?.type, "array");
    assert.equal(response.properties?.hits?.items?.$ref, "#/definitions/DiscoverySearchGuild");
    assert.notEqual(response.properties?.hits?.items?.$ref, "#/definitions/Guild");
    assert.ok(hit.properties);
    assert.equal(hit.properties.discovery_weight, undefined);
    assert.equal(hit.properties.discovery_excluded, undefined);
    assert.equal(hit.properties.member_count, undefined);
    assert.equal(hit.properties.presence_count, undefined);
    assert.equal(hit.properties.objectID?.type, "string");
});

test("DiscoverySearchResponse validates the Algolia-style envelope and rejects entity internals", () => {
    const response = {
        hits: [
            {
                id: "100",
                name: "Discovery guild",
                icon: null,
                banner: null,
                splash: null,
                description: null,
                approximate_presence_count: 5,
                approximate_member_count: 42,
                premium_subscription_count: 0,
                preferred_locale: "en-US",
                auto_removed: false,
                discovery_splash: null,
                primary_category_id: null,
                vanity_url_code: null,
                is_published: true,
                keywords: [],
                nsfw_properties: null,
                features: [GuildFeature.Discoverable],
                categories: [],
                objectID: "100",
            },
        ],
        nbHits: 1,
        offset: 0,
        length: 48,
        exhaustiveNbHits: true,
        exhaustiveTypo: true,
        exhaustive: {
            nbHits: true,
            typo: true,
        },
        query: "discovery",
        params: "query=discovery&offset=0&length=48",
        processingTimeMS: 0,
        processingTimingsMS: {
            total: 0,
        },
        serverTimeMS: 0,
        aggregateFacets: {
            "categories.id": {},
        },
        totalNbHits: 1,
    };

    assert.equal(ajv.validate("DiscoverySearchResponse", response), true);
    assert.equal(
        ajv.validate("DiscoverySearchResponse", {
            ...response,
            hits: [{ ...response.hits[0], discovery_weight: 100 }],
        }),
        false,
    );
});
