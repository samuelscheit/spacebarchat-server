import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ApiConfiguration } from "../config/types/ApiConfiguration";
import { API_PREFIXES, API_VERSIONS, normalizeApiActiveVersions } from "./ApiVersions";
import { mergeConfigDefaults, normalizeConfig } from "./ConfigDefaults";

describe("API versions", () => {
    test("lists heritage through current Discord API versions", () => {
        assert.deepEqual(API_VERSIONS, ["3", "4", "5", "6", "7", "8", "9", "10"]);
        assert.deepEqual(API_PREFIXES, ["/api/v3", "/api/v4", "/api/v5", "/api/v6", "/api/v7", "/api/v8", "/api/v9", "/api/v10", "/api"]);
    });

    test("advertises every mounted version by default", () => {
        assert.deepEqual(new ApiConfiguration().activeVersions, API_VERSIONS);
    });

    test("upgrades the previous default active versions", () => {
        assert.deepEqual(normalizeApiActiveVersions(["6", "7", "8", "9"]), API_VERSIONS);
        assert.deepEqual(normalizeApiActiveVersions(["6", "7", "8", "9", "7", "8", "9", "10"]), API_VERSIONS);
    });

    test("preserves custom active versions without duplicate entries", () => {
        assert.deepEqual(normalizeApiActiveVersions(["7", "7", "9"]), ["7", "9"]);
    });

    test("replaces config arrays instead of keeping default tails", () => {
        assert.deepEqual(mergeConfigDefaults({ activeVersions: ["3", "4", "5"] }, { activeVersions: ["6"] }), { activeVersions: ["6"] });
    });

    test("merges old persisted defaults as the current advertised API versions", () => {
        const config = normalizeConfig(
            mergeConfigDefaults(
                { api: new ApiConfiguration() },
                {
                    api: {
                        activeVersions: ["6", "7", "8", "9"],
                        endpointPublic: "http://localhost:3001/api/v9/",
                    },
                },
            ),
        );

        assert.deepEqual(config.api.activeVersions, API_VERSIONS);
    });
});
