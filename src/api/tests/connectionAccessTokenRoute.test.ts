import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { pathToFileURL } from "node:url";

process.env.DATABASE ??= "postgres://localhost/spacebar";

function getAccessTokenRouteModuleUrl(): string {
    return pathToFileURL(path.join(__dirname, "..", "routes", "users", "@me", "connections", "#connection_name", "#connection_id", "access-token.js")).href;
}

describe("connection access-token route policy", () => {
    test("limits access-token retrieval to the providers Discord clients use this route for and Spacebar supports", async () => {
        const { ACCESS_TOKEN_DISABLED_CONNECTIONS, ACCESS_TOKEN_SUPPORTED_CONNECTIONS, getAccessTokenSupportedConnectionTypes, isAccessTokenSupportedConnection } = await import(
            getAccessTokenRouteModuleUrl()
        );

        assert.deepEqual(ACCESS_TOKEN_SUPPORTED_CONNECTIONS, ["twitch", "youtube"]);
        assert.deepEqual(ACCESS_TOKEN_DISABLED_CONNECTIONS, ["spotify"]);
        assert.equal(getAccessTokenSupportedConnectionTypes(), "twitch, youtube");

        for (const provider of ["twitch", "youtube"]) assert.equal(isAccessTokenSupportedConnection(provider), true);
        for (const provider of ["spotify", "battlenet", "twitter", "github", "discord", "xbox", "reddit", "facebook", "epicgames"]) {
            assert.equal(isAccessTokenSupportedConnection(provider), false);
        }
    });
});
