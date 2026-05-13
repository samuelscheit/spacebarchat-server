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
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type express from "express";
import { ReadStateType } from "@spacebar/schemas";
import notificationCenterItemsRouter, {
    NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT,
    acknowledgeNotificationCenterItem,
    createNotificationCenterItemsRouter,
    parseNotificationCenterItemsBoolean,
    parseNotificationCenterItemsLimit,
    parseNotificationCenterItemsQuery,
} from "../../src/api/routes/users/@me/notification-center/items";
import { createUserRouteApp, requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

interface OpenApiOperation {
    security?: { bearer?: unknown[] }[];
    responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
}

function getNotificationCenterItemsOpenApiOperations(): { get: OpenApiOperation; post: OpenApiOperation } {
    const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
        paths: Record<string, { get?: OpenApiOperation; post?: OpenApiOperation }>;
    };

    const routePath = openapi.paths["/users/@me/notification-center/items/"] ?? openapi.paths["/users/@me/notification-center/items"];
    assert.ok(routePath?.get, "OpenAPI should include GET /users/@me/notification-center/items");

    const ackRoutePath =
        openapi.paths["/users/@me/notification-center/items/{notification_center_item_id}/ack"] ??
        openapi.paths["/users/@me/notification-center/items/{notification_center_item_id}/ack/"];
    assert.ok(ackRoutePath?.post, "OpenAPI should include POST /users/@me/notification-center/items/{notification_center_item_id}/ack");

    return { get: routePath.get, post: ackRoutePath.post };
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
        const { get: operation } = getNotificationCenterItemsOpenApiOperations();

        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.deepEqual(operation.responses?.["200"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/NotificationCenterItemsResponse",
        });
        assert.deepEqual(operation.responses?.["401"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });
});

describe("POST /users/@me/notification-center/items/:notification_center_item_id/ack", () => {
    test("updates notification-center read state and emits the documented ack event", async () => {
        const itemId = "1456516148545421313";
        const readStateUpdates: unknown[] = [];
        const emittedEvents: unknown[] = [];

        await acknowledgeNotificationCenterItem("user-id", itemId, {
            upsertNotificationCenterReadState(userId, notificationCenterItemId) {
                readStateUpdates.push({
                    userId,
                    notificationCenterItemId,
                    readStateType: ReadStateType.NOTIFICATION_CENTER,
                });
            },
            emitEvent(event) {
                emittedEvents.push(event);
            },
        });

        assert.deepEqual(readStateUpdates, [
            {
                userId: "user-id",
                notificationCenterItemId: itemId,
                readStateType: ReadStateType.NOTIFICATION_CENTER,
            },
        ]);
        assert.deepEqual(emittedEvents, [
            {
                event: "NOTIFICATION_CENTER_ITEMS_ACK",
                user_id: "user-id",
                data: {
                    id: itemId,
                },
            },
        ]);
    });

    test("rejects invalid item IDs before persistence or gateway emission", async () => {
        await assert.rejects(
            acknowledgeNotificationCenterItem("user-id", "not-a-snowflake", {
                upsertNotificationCenterReadState() {
                    throw new Error("read state should not be updated");
                },
                emitEvent() {
                    throw new Error("event should not be emitted");
                },
            }),
            /notification_center_item_id must be a valid snowflake/,
        );
    });

    test("returns 204 for the authenticated route and preserves side effects", async () => {
        const itemId = "1456516148545421313";
        const readStateUpdates: unknown[] = [];
        const emittedEvents: unknown[] = [];
        const router = createNotificationCenterItemsRouter({
            upsertNotificationCenterReadState(userId, notificationCenterItemId) {
                readStateUpdates.push({ userId, notificationCenterItemId });
            },
            emitEvent(event) {
                emittedEvents.push(event);
            },
        });
        const app = createUserRouteApp(router, "/users/@me/notification-center/items");
        const response = await requestText(app, `/users/@me/notification-center/items/${itemId}/ack`, { method: "POST" });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(readStateUpdates, [{ userId: "user-id", notificationCenterItemId: itemId }]);
        assert.deepEqual(emittedEvents, [
            {
                event: "NOTIFICATION_CENTER_ITEMS_ACK",
                user_id: "user-id",
                data: {
                    id: itemId,
                },
            },
        ]);
    });

    test("documents bearer auth and response schemas in generated OpenAPI", () => {
        const { post: operation } = getNotificationCenterItemsOpenApiOperations();

        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.equal(operation.responses?.["204"]?.content, undefined);
        assert.deepEqual(operation.responses?.["400"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
        assert.deepEqual(operation.responses?.["401"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });
});

async function requestText(app: express.Express, path: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
