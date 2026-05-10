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
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { DiscordApiErrors } from "@spacebar/util";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import familyCenterMeRouter, { buildFamilyCenterOverviewResponse, getFamilyCenterLinkCodeUnavailableError } from "../../src/api/routes/family-center/@me";
import { createUserRouteApp, requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

describe("GET /family-center/@me", () => {
    test("returns the authenticated empty Family Center overview compatibility payload", async () => {
        const app = createUserRouteApp(familyCenterMeRouter, "/family-center/@me");
        const response = await requestJson(app, "/family-center/@me");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, buildFamilyCenterOverviewResponse());
    });

    test("documents the response schema and bearer-auth error shape", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "family-center", "@me.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Family Center Overview"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"FamilyCenterResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });
});

describe("GET /family-center/@me/link-code", () => {
    test("fails closed while link-code persistence and expiry are unsupported", async () => {
        const app = createUserRouteApp(familyCenterMeRouter, "/family-center/@me");
        app.use(ErrorHandler);

        const response = await requestJson(app, "/family-center/@me/link-code");

        assert.equal(response.status, DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED.httpStatus);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED.code,
            message: DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED.message,
        });
    });

    test("uses the shared conservative compatibility error", () => {
        assert.equal(getFamilyCenterLinkCodeUnavailableError(), DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED);
    });

    test("documents the source response shape and bearer-auth error shape", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "family-center", "@me.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Link Code"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"FamilyCenterLinkCodeResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /FEATURE_TEMPORARILY_DISABLED/);
    });
});
