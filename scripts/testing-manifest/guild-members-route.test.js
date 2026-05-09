"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { scanRouterCalls } = require("./lib");

const repoRoot = path.join(__dirname, "..", "..");
const membersRoutePath = path.join(repoRoot, "src", "api", "routes", "guilds", "#guild_id", "members", "index.ts");
const requestGuildMembersPath = path.join(repoRoot, "src", "gateway", "opcodes", "RequestGuildMembers.ts");
const gatewayOpcodesPath = path.join(repoRoot, "src", "gateway", "opcodes", "index.ts");
const gatewayConstantsPath = path.join(repoRoot, "src", "gateway", "util", "Constants.ts");
const constantsPath = path.join(repoRoot, "src", "util", "util", "Constants.ts");

function readSource(file) {
    return fs.readFileSync(file, "utf8");
}

describe("guild members route transport contract", () => {
    test("keeps GET /guilds/:guild_id/members as an HTTP JSON route", () => {
        const source = readSource(membersRoutePath);
        const getMembers = scanRouterCalls(source).find((call) => call.method === "GET" && call.localPath === "/");

        assert.ok(getMembers, "expected the guild members collection GET route to be present");
        assert.deepEqual(getMembers.routeMetadata.responseBodies, ["APIErrorResponse", "APIMemberArray"]);
        assert.deepEqual(getMembers.routeMetadata.responseStatuses, [200, 403]);
        assert.equal(getMembers.routeMetadata.hasQuery, true);
        assert.match(source, /return\s+res\.json\(\s*members\s*\)/, "REST route should return the member list in the HTTP response body");
        assert.doesNotMatch(source, /send over websocket/i, "stale websocket-delivery TODO must not return to the REST route");
    });

    test("keeps websocket guild-member chunks in the gateway request handler", () => {
        const membersRouteSource = readSource(membersRoutePath);
        const requestGuildMembersSource = readSource(requestGuildMembersPath);
        const gatewayOpcodesSource = readSource(gatewayOpcodesPath);
        const gatewayConstantsSource = readSource(gatewayConstantsPath);
        const constantsSource = readSource(constantsPath);

        assert.doesNotMatch(membersRouteSource, /\bSend\s*\(/, "REST route must not send gateway websocket payloads directly");
        assert.doesNotMatch(membersRouteSource, /\bGUILD_MEMBERS_CHUNK\b/, "REST route must not dispatch gateway member chunks");
        assert.doesNotMatch(membersRouteSource, /\bOPCODES?\b/, "REST route must not depend on gateway opcode constants");

        assert.match(gatewayConstantsSource, /\bRequest_Guild_Members\s*=\s*8\b/, "gateway opcode enum should define member-list requests as opcode 8");
        assert.match(constantsSource, /\bREQUEST_GUILD_MEMBERS:\s*8\b/, "gateway opcode 8 should represent member-list requests");
        assert.match(gatewayOpcodesSource, /\b8:\s*onRequestGuildMembers\b/, "opcode 8 should route to the gateway member request handler");
        assert.match(requestGuildMembersSource, /function\s+onRequestGuildMembers\b/, "gateway member requests should be handled by opcode 8");
        assert.match(requestGuildMembersSource, /\bSend\s*\(/, "gateway request handler should send websocket responses");
        assert.match(requestGuildMembersSource, /\bGUILD_MEMBERS_CHUNK\b/, "gateway request handler should dispatch member chunks");
        assert.match(requestGuildMembersSource, /\bOPCODES\.Dispatch\b/, "gateway member chunks should be dispatch events");
    });
});
