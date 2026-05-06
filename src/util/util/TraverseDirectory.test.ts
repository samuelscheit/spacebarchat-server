import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isRouteFile } from "./TraverseDirectory";

describe("route file traversal filter", () => {
    test("includes runtime route files", () => {
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/discovery-metadata.js"), true);
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/widget.json.js"), true);
    });

    test("excludes files that are not runtime routes", () => {
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/discovery-metadata.test.js"), false);
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/discovery-metadata.openapi.test.js"), false);
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/discovery-metadata.spec.js"), false);
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/discovery-metadata.d.js"), false);
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/.hidden.js"), false);
        assert.equal(isRouteFile("/dist/api/routes/guilds/#guild_id/discovery-metadata.js.map"), false);
    });
});
