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
import { join } from "node:path";
import { describe, test } from "node:test";
import notificationCenterItemsRouter, {
    NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT,
    parseNotificationCenterItemsBoolean,
    parseNotificationCenterItemsLimit,
    parseNotificationCenterItemsQuery,
} from "../../src/api/routes/users/@me/notification-center/items";
import { createUserRouteApp, requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

interface OpenApiOperation {
    security?: { bearer?: unknown[] }[];
    responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
}

function getNotificationCenterItemsOpenApiOperation(): OpenApiOperation {
    const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
        paths: Record<string, { get?: OpenApiOperation }>;
    };

    const routePath = openapi.paths["/users/@me/notification-center/items/"] ?? openapi.paths["/users/@me/notification-center/items"];
    assert.ok(routePath?.get, "OpenAPI should include GET /users/@me/notification-center/items");

    return routePath.get;
}

describe("GET /users/@me/notification-center/items", () => {
    test("normalizes documented query defaults and bounds", () => {
        assert.equal(parseNotificationCenterItemsLimit(undefined), NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT);
        assert.equal(parseNotificationCenterItemsLimit(""), NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT);
        assert.equal(parseNotificationCenterItemsLimit("0"), 1);
        assert.equal(parseNotificationCenterItemsLimit("101"), 100);
        assert.equal(parseNotificationCenterItemsLimit("abc"), NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT);

        assert.equal(parseNotificationCenterItemsBoolean(undefined, true), true);
        assert.equal(parseNotificationCenterItemsBoolean("false", true), false);
        assert.equal(parseNotificationCenterItemsBoolean("1", false), true);

        assert.deepEqual(
            parseNotificationCenterItemsQuery({
                after: "123",
                with_mentions: "true",
                roles_filter: "false",
                everyone_filter: "0",
                limit: "50",
            }),
            {
                after: "123",
                with_mentions: true,
                roles_filter: false,
                everyone_filter: false,
                limit: 50,
            },
        );
    });

    test("returns an authenticated compatibility page without fabricated items", async () => {
        const app = createUserRouteApp(notificationCenterItemsRouter, "/users/@me/notification-center/items");
        const response = await requestJson(app, "/users/@me/notification-center/items?limit=101&with_mentions=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            limit: 100,
            items: [],
            cursor: null,
            has_more: false,
        });
    });

    test("documents bearer auth and response schemas in generated OpenAPI", () => {
        const operation = getNotificationCenterItemsOpenApiOperation();

        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.deepEqual(operation.responses?.["200"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/NotificationCenterItemsResponse",
        });
        assert.deepEqual(operation.responses?.["401"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });
});
