/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express, { type Request } from "express";

const nativeModuleRoute = require("./#module_version.js") as typeof import("./#module_version.js");

describe("GET /modules/:release_channel/:module_name/:module_version", () => {
    test("parses native module path params and default query params", () => {
        const lookup = nativeModuleRoute.nativeModuleLookupFromRequest({
            params: {
                release_channel: "stable",
                module_name: "discord_desktop_core",
                module_version: "1",
            },
            query: {},
        } as unknown as Request);

        assert.deepEqual(lookup, {
            releaseChannel: "stable",
            moduleName: "discord_desktop_core",
            moduleVersion: "1",
            platform: "osx",
            hostVersion: "0",
        });
    });

    test("rejects non-native module path params", () => {
        const lookup = nativeModuleRoute.nativeModuleLookupFromRequest({
            params: {
                release_channel: "stable",
                module_name: "versions.json",
                module_version: "extra",
            },
            query: {
                platform: "linux",
                host_version: "0.0.75",
            },
        } as unknown as Request);

        assert.equal(lookup, undefined);
    });

    test("returns a public JSON not-found response when no native module archive is available", async () => {
        const app = express();
        app.use("/modules/:release_channel/:module_name/:module_version", nativeModuleRoute.default);

        const server = http.createServer(app);
        const port = await listen(server);
        try {
            const response = await fetch(`http://127.0.0.1:${port}/modules/stable/discord_desktop_core/1?platform=osx&host_version=0`);

            assert.equal(response.status, 404);
            assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
            assert.deepEqual(await response.json(), {
                code: 404,
                message: "Native module not found",
            });
        } finally {
            await close(server);
        }
    });
});

async function listen(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    return address.port;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
