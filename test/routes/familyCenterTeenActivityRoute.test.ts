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
import familyCenterTeenActivityRouter from "../../src/api/routes/family-center/#teen_user_id/activity";
import { buildFamilyCenterTeenActivityResponse } from "../../src/api/routes/family-center/@me";
import { createUserRouteApp, requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

describe("GET /family-center/:teen_user_id/activity", () => {
    test("returns an authenticated empty teen activity compatibility payload", async () => {
        const teenUserId = "801318363472330772";
        const app = createUserRouteApp(familyCenterTeenActivityRouter, "/family-center/:teen_user_id/activity");
        const response = await requestJson(app, `/family-center/${teenUserId}/activity`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, buildFamilyCenterTeenActivityResponse(teenUserId));
    });

    test("documents the teen audit-log response schema and bearer-auth error shape", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "family-center", "#teen_user_id", "activity.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Family Center Teen Activity"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"FamilyCenterTeenAuditLog"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });
});
