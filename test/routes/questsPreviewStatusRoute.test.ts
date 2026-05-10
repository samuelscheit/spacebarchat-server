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
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import questPreviewStatusRouter, { assertValidQuestId, buildResetQuestPreviewStatusResponse } from "../../src/api/routes/quests/#quest_id/preview/status";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { DiscordApiErrors, Rights } from "@spacebar/util";

const questId = "123456789012345678";
const userId = "223456789012345678";

describe("DELETE /quests/:quest_id/preview/status", () => {
    test("returns an operator-only empty Quest User Status compatibility response", async () => {
        const app = createQuestPreviewStatusRouteApp();
        const response = await requestJson(app, `/quests/${questId}/preview/status`, { method: "DELETE" });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, buildResetQuestPreviewStatusResponse(userId, questId));
    });

    test("validates quest IDs as documented snowflakes", async () => {
        assert.doesNotThrow(() => assertValidQuestId(questId));
        assert.throws(() => assertValidQuestId("not-a-snowflake"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });

        const app = createQuestPreviewStatusRouteApp();
        const response = await requestJson(app, "/quests/not-a-snowflake/preview/status", { method: "DELETE" });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("denies authenticated non-operator users before reset compatibility handling", async () => {
        const app = createQuestPreviewStatusRouteApp(new Rights(0));
        const response = await requestJson(app, `/quests/${questId}/preview/status`, { method: "DELETE" });

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
    });

    test("documents route metadata for the source-backed compatibility contract", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "quests", "#quest_id", "preview", "status.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Reset Quest"/);
        assert.match(routeSource, /right:\s*"OPERATOR"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestUserStatusResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /emitEvent|QUESTS_USER_STATUS_UPDATE/);
    });
});

function createQuestPreviewStatusRouteApp(rights = new Rights("OPERATOR")): express.Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const routeRequest = req as typeof req & { t: (key: string) => string };
        routeRequest.user_id = userId;
        routeRequest.rights = rights;
        (routeRequest as unknown as { t: (key: string) => string }).t = (key: string) => key;
        next();
    });
    app.use("/quests/:quest_id/preview/status", questPreviewStatusRouter);
    app.use(ErrorHandler);

    return app;
}
