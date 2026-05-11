import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { Categories, FieldError, Guild, GuildFeature } from "@spacebar/util";
import {
    getDiscoveryCategories,
    getDiscoveryValidTermResponse,
    isDiscoverySearchTermValid,
    localizeDiscoveryCategories,
    parseDiscoverySearchQuery,
    parseDiscoverySearchTerm,
    searchPublishedGuilds,
} from "./discovery";

function category(overrides: Partial<Categories>): Categories {
    return {
        id: 1,
        name: "Gaming",
        localizations: {},
        is_primary: true,
        ...overrides,
    } as Categories;
}

function discoveryGuild(overrides: Partial<Guild>): Guild {
    return {
        id: "100",
        name: "Gaming Hub",
        description: "A public gaming community",
        icon: null,
        splash: null,
        banner: null,
        discovery_splash: null,
        primary_category_id: 1,
        features: [GuildFeature.Discoverable],
        preferred_locale: "en-US",
        premium_subscription_count: 2,
        member_count: 250,
        presence_count: 25,
        discovery_weight: 10,
        discovery_excluded: false,
        ...overrides,
    } as Guild;
}

describe("discovery categories", () => {
    afterEach(() => {
        test.mock.reset();
    });

    test("uses the requested category localization as the display name", () => {
        const categories = [
            category({
                name: "Gaming",
                localizations: {
                    de: "Spiele",
                    fr: "Jeux",
                },
            }),
        ];

        const localized = localizeDiscoveryCategories(categories, "fr");

        assert.equal(localized[0].name, "Jeux");
        assert.deepEqual(localized[0].localizations, categories[0].localizations);
        assert.equal(categories[0].name, "Gaming");
    });

    test("keeps the default name when no matching locale is available", () => {
        const categories = [
            category({
                name: "Gaming",
                localizations: {
                    de: "Spiele",
                },
            }),
        ];

        assert.strictEqual(localizeDiscoveryCategories(categories, "fr")[0], categories[0]);
        assert.strictEqual(localizeDiscoveryCategories(categories, ["de"])[0], categories[0]);
    });

    test("fetches only primary categories when primary_only is true", async () => {
        const categories = [category({ name: "Gaming", localizations: { de: "Spiele" } })];
        const find = test.mock.method(Categories, "find", async () => categories);

        const result = await getDiscoveryCategories({ primary_only: "true", locale: "de" });

        assert.deepEqual(find.mock.calls[0].arguments, [{ order: { id: "ASC" }, where: { is_primary: true } }]);
        assert.equal(result[0].name, "Spiele");
    });

    test("fetches all categories when primary_only is explicitly false", async () => {
        const categories = [category({ name: "Gaming" })];
        const find = test.mock.method(Categories, "find", async () => categories);

        const result = await getDiscoveryCategories({ primary_only: "false", locale: "de" });

        assert.deepEqual(find.mock.calls[0].arguments, [{ order: { id: "ASC" } }]);
        assert.strictEqual(result[0], categories[0]);
    });

    test("fetches all categories when primary_only is absent", async () => {
        const categories = [category({ name: "Gaming" })];
        const find = test.mock.method(Categories, "find", async () => categories);

        const result = await getDiscoveryCategories({ locale: "de" });

        assert.deepEqual(find.mock.calls[0].arguments, [{ order: { id: "ASC" } }]);
        assert.strictEqual(result[0], categories[0]);
    });
});

describe("published discovery search", () => {
    afterEach(() => {
        test.mock.reset();
    });

    test("parses optional search query and bounded pagination", () => {
        assert.deepEqual(parseDiscoverySearchQuery({ query: [" gaming ", "ignored"], limit: "12", offset: "3" }), {
            query: "gaming",
            limit: 12,
            offset: 3,
        });

        assert.deepEqual(parseDiscoverySearchQuery({}), {
            query: "",
            limit: 48,
            offset: 0,
        });
    });

    test("rejects invalid or out-of-range pagination", () => {
        assert.throws(() => parseDiscoverySearchQuery({ limit: "49" }), FieldError);
        assert.throws(() => parseDiscoverySearchQuery({ limit: "0" }), FieldError);
        assert.throws(() => parseDiscoverySearchQuery({ offset: "-1" }), FieldError);
        assert.throws(() => parseDiscoverySearchQuery({ limit: "not-a-number" }), FieldError);
    });

    test("returns an Algolia-compatible published guild search response", async () => {
        const guild = discoveryGuild({
            id: "123",
            name: "Spacebar Gaming",
            discovery_splash: "discovery-splash",
        });
        const findAndCount = test.mock.method(Guild, "findAndCount", async (): Promise<[Guild[], number]> => [[guild], 7]);
        const findCategories = test.mock.method(Categories, "find", async () => [
            category({
                id: 1,
                name: "Gaming",
                localizations: { de: "Gaming" },
                is_primary: true,
            }),
        ]);

        const response = await searchPublishedGuilds({ query: "Gaming", limit: "5", offset: "2" });

        assert.equal(response.nbHits, 7);
        assert.equal(response.totalNbHits, 7);
        assert.equal(response.offset, 2);
        assert.equal(response.length, 5);
        assert.equal(response.query, "Gaming");
        assert.equal(response.exhaustive.nbHits, true);
        assert.equal(response.exhaustive.typo, true);
        assert.equal(typeof response.processingTimeMS, "number");
        assert.match(response.params, /query=Gaming/);
        assert.match(response.params, /length=5/);
        assert.match(response.params, /filters=approximate_member_count/);
        assert.deepEqual(response.aggregateFacets, { "categories.id": {} });
        assert.deepEqual(response.hits, [
            {
                id: "123",
                name: "Spacebar Gaming",
                description: "A public gaming community",
                icon: null,
                splash: null,
                banner: null,
                approximate_presence_count: 25,
                approximate_member_count: 250,
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
                categories: [
                    {
                        id: 1,
                        is_primary: true,
                        name: "Gaming",
                        name_localizations: { de: "Gaming" },
                    },
                ],
                primary_category: {
                    id: 1,
                    is_primary: true,
                    name: "Gaming",
                    name_localizations: { de: "Gaming" },
                },
                objectID: "123",
            },
        ]);

        const findOptions = findAndCount.mock.calls[0].arguments[0] as NonNullable<Parameters<typeof Guild.findAndCount>[0]>;
        assert.equal(findOptions.take, 5);
        assert.equal(findOptions.skip, 2);
        assert.deepEqual(findOptions.order, {
            discovery_weight: "DESC",
            member_count: "DESC",
            id: "ASC",
        });
        assert.equal(Array.isArray(findOptions.where), true);
        assert.equal(((findOptions.where as Record<string, unknown>[])[0].features as { type?: string }).type, "arrayContains");
        assert.equal(((findOptions.where as Record<string, unknown>[])[0].member_count as { type?: string }).type, "moreThan");
        assert.equal(((findOptions.where as Record<string, unknown>[])[0].presence_count as { type?: string }).type, "moreThan");
        assert.equal(((findOptions.where as Record<string, unknown>[])[0].name as { type?: string }).type, "raw");
        assert.ok(findCategories.mock.calls[0].arguments[0]);
    });
});

describe("discovery valid term", () => {
    test("accepts a non-empty search term within the documented search length", () => {
        assert.equal(isDiscoverySearchTermValid("spacebar"), true);
        assert.deepEqual(getDiscoveryValidTermResponse({ term: "spacebar" }), { valid: true });
    });

    test("rejects empty and overlong search terms without external search infrastructure", () => {
        assert.equal(isDiscoverySearchTermValid("   "), false);
        assert.equal(isDiscoverySearchTermValid("a".repeat(101)), false);
        assert.deepEqual(getDiscoveryValidTermResponse({ term: "   " }), { valid: false });
        assert.deepEqual(getDiscoveryValidTermResponse({ term: "a".repeat(101) }), { valid: false });
    });

    test("requires the term query parameter to be a single string", () => {
        assert.throws(
            () => parseDiscoverySearchTerm(undefined),
            (error) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.equal((error as { message?: unknown }).message, "Invalid Form Body");
                assert.ok((error as { errors?: { term?: unknown } }).errors?.term);
                return true;
            },
        );

        assert.throws(
            () => parseDiscoverySearchTerm(["spacebar"]),
            (error) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.ok((error as { errors?: { term?: unknown } }).errors?.term);
                return true;
            },
        );
    });
});
