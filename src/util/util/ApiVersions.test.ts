import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ApiConfiguration } from "../config/types/ApiConfiguration";
import { API_PREFIXES, API_VERSIONS } from "./ApiVersions";

describe("API versions", () => {
    test("lists heritage through current Discord API versions", () => {
        assert.deepEqual(API_VERSIONS, ["3", "4", "5", "6", "7", "8", "9", "10"]);
        assert.deepEqual(API_PREFIXES, ["/api/v3", "/api/v4", "/api/v5", "/api/v6", "/api/v7", "/api/v8", "/api/v9", "/api/v10", "/api"]);
    });

    test("advertises every mounted version by default", () => {
        assert.deepEqual(new ApiConfiguration().activeVersions, API_VERSIONS);
    });
});
