import assert from "node:assert/strict";
import test from "node:test";

import { buildMissingRouteReport, RouteCatalogEntry } from "./index.js";

const implemented: RouteCatalogEntry[] = [
    { method: "GET", route: "/users/@me", route_name: "GET_USERS_ME", source: "spacebar" },
    { method: "POST", route: "/channels/{channel_id}/messages", route_name: "POST_CHANNEL_MESSAGES", source: "spacebar" },
    { method: "GET", route: "/spacebar-only", route_name: "GET_SPACEBAR_ONLY", source: "spacebar" },
];

const target: RouteCatalogEntry[] = [
    { method: "GET", route: "/users/@me/", route_name: "GET_USERS_ME", source: "discord-a" },
    { method: "POST", route: "/channels/{channel_id}/messages", route_name: "POST_CHANNEL_MESSAGES", source: "discord-a" },
    { method: "PATCH", route: "/users/@me", route_name: "PATCH_USERS_ME", source: "discord-a", summary: "Modify current user" },
    { method: "PATCH", route: "/users/@me", route_name: "PATCH_CURRENT_USER", source: "discord-b" },
    { method: "OPTIONS", route: "/channels/{channel_id}/messages", route_name: "OPTIONS_CHANNEL_MESSAGES", source: "discord-a" },
];

test("compares route catalogs by method and normalized route", () => {
    const report = buildMissingRouteReport(
        { path: "implemented.json", entries: implemented },
        [{ path: "target.json", entries: target }],
        { ignoredMethods: ["OPTIONS"] },
    );

    assert.equal(report.spacebar, 3);
    assert.equal(report.discord, 3);
    assert.equal(report.missing, 1);
    assert.deepEqual(report.routes, ["/users/@me"]);
    assert.deepEqual(report.additional, ["/spacebar-only"]);
    assert.equal(report.missing_entries[0].method, "PATCH");
    assert.equal(report.missing_entries[0].route, "/users/@me");
    assert.deepEqual(report.missing_entries[0].sources, ["discord-a", "discord-b"]);
    assert.deepEqual(report.missing_entries[0].summaries, ["Modify current user"]);
});
