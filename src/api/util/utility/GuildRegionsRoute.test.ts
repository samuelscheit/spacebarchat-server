import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";

const SKIP_ROUTE_TEST_UNDER_COVERAGE =
    process.execArgv.includes("--experimental-test-coverage") || process.env.npm_lifecycle_event === "node:tests"
        ? "Node coverage cannot resolve source maps for route paths containing #guild_id"
        : false;

describe("guild regions route", () => {
    test("passes VIP_REGIONS guild feature membership to the voice region lookup", { skip: SKIP_ROUTE_TEST_UNDER_COVERAGE }, async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const routeHandler = require(path.join(process.cwd(), "dist/api/util/handlers/route.js")) as typeof import("../handlers/route");
        const voice = require(path.join(process.cwd(), "dist/api/util/handlers/Voice.js")) as typeof import("../handlers/Voice");
        const { Guild, GuildFeature } = require("@spacebar/util") as typeof import("@spacebar/util");
        const routeModulePath = require.resolve(path.join(process.cwd(), "dist/api/routes/guilds/#guild_id/regions.js"));
        const voiceRegionCalls: { ipAddress: string; vip: boolean }[] = [];
        const guildLookups: string[] = [];
        let storedFeatures: string[] = [];

        t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
        t.mock.method(Guild, "findOneOrFail", async (options: { where?: { id?: string } }) => {
            guildLookups.push(options.where?.id ?? "");
            return { features: storedFeatures };
        });
        t.mock.method(voice, "getVoiceRegions", async (ipAddress: string, vip: boolean) => {
            voiceRegionCalls.push({ ipAddress, vip });
            return [
                {
                    id: vip ? "vip-region" : "standard-region",
                    name: vip ? "VIP Region" : "Standard Region",
                    custom: false,
                    deprecated: false,
                    optimal: true,
                },
            ];
        });

        delete require.cache[routeModulePath];

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = express();
            app.use("/guilds/:guild_id/regions", router);

            let response = await requestJson(app, "/guilds/guild-id/regions");
            assert.equal(response.status, 200);
            assert.deepEqual(response.body, [
                {
                    id: "standard-region",
                    name: "Standard Region",
                    custom: false,
                    deprecated: false,
                    optimal: true,
                },
            ]);
            assert.deepEqual(voiceRegionCalls.at(-1)?.vip, false);

            storedFeatures = [GuildFeature.VipRegions];
            response = await requestJson(app, "/guilds/guild-id/regions");
            assert.equal(response.status, 200);
            assert.deepEqual(response.body, [
                {
                    id: "vip-region",
                    name: "VIP Region",
                    custom: false,
                    deprecated: false,
                    optimal: true,
                },
            ]);
            assert.deepEqual(voiceRegionCalls.at(-1)?.vip, true);
            assert.deepEqual(guildLookups, ["guild-id", "guild-id"]);
            assert.ok(voiceRegionCalls.every((call) => call.ipAddress.length > 0));
        } finally {
            delete require.cache[routeModulePath];
        }
    });
});

async function requestJson(app: express.Express, path: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}
