import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { Categories } from "@spacebar/util";
import { getDiscoveryCategories, getDiscoveryValidTermResponse, isDiscoverySearchTermValid, localizeDiscoveryCategories, parseDiscoverySearchTerm } from "./discovery";

function category(overrides: Partial<Categories>): Categories {
    return {
        id: 1,
        name: "Gaming",
        localizations: {},
        is_primary: true,
        ...overrides,
    } as Categories;
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
