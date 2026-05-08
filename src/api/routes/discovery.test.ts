import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { Categories } from "@spacebar/util";
import { getDiscoveryCategories, localizeDiscoveryCategories } from "./discovery";

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

    test("fetches only primary categories when primary_only is present", async () => {
        const categories = [category({ name: "Gaming", localizations: { de: "Spiele" } })];
        const find = test.mock.method(Categories, "find", async () => categories);

        const result = await getDiscoveryCategories({ primary_only: "true", locale: "de" });

        assert.deepEqual(find.mock.calls[0].arguments, [{ where: { is_primary: true } }]);
        assert.equal(result[0].name, "Spiele");
    });

    test("fetches all categories when primary_only is absent", async () => {
        const categories = [category({ name: "Gaming" })];
        const find = test.mock.method(Categories, "find", async () => categories);

        const result = await getDiscoveryCategories({ locale: "de" });

        assert.deepEqual(find.mock.calls[0].arguments, []);
        assert.strictEqual(result[0], categories[0]);
    });
});
