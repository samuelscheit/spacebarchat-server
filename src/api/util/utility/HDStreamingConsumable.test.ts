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
import { describe, test } from "node:test";
import { DiscordApiErrors } from "@spacebar/util";
import type { Response } from "express";
import { ErrorHandler } from "../../middlewares/ErrorHandler";
import hdStreamingConsumableRouter from "../../routes/users/@me/consumable/hd-streaming";
import { createUserRouteApp, requestJson } from "../../tests/helpers/UserRouteTestHelpers";
import { DefaultHDStreamingConsumableResponse, applyHDStreamingConsumable, getHDStreamingConsumable, sendHDStreamingConsumableResponse } from "./HDStreamingConsumable";

type OpenApiOperation = {
    requestBody?: {
        required?: boolean;
        content?: Record<string, { schema?: { $ref?: string } }>;
    };
    responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
    security?: Array<Record<string, unknown>>;
};

function createHDStreamingConsumableRouteApp() {
    const app = createUserRouteApp(hdStreamingConsumableRouter, "/users/@me/consumable/hd-streaming");
    app.use(ErrorHandler);
    return app;
}

function getHDStreamingOpenApiOperation(method: "get" | "post") {
    const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8")) as {
        paths: Record<string, Record<string, OpenApiOperation> | undefined>;
    };
    const operation = openapi.paths["/users/@me/consumable/hd-streaming/"]?.[method];

    assert.ok(operation);
    return operation;
}

function getResponseSchemaRef(operation: OpenApiOperation, status: string) {
    return operation.responses?.[status]?.content?.["application/json"]?.schema?.$ref;
}

describe("HDStreamingConsumable", () => {
    test("returns an explicit empty consumable state until inventory persistence exists", () => {
        assert.deepEqual(getHDStreamingConsumable(), {
            entitlement: null,
        });
    });

    test("returns independent response objects", () => {
        const response = getHDStreamingConsumable();
        response.entitlement = { id: "100000000000000001" };

        assert.deepEqual(getHDStreamingConsumable(), DefaultHDStreamingConsumableResponse);
    });

    test("sends the typed compatibility response", () => {
        const calls: unknown[] = [];
        const res = {
            status(code: number) {
                calls.push(["status", code]);
                return this;
            },
            json(body: unknown) {
                calls.push(["json", body]);
                return this;
            },
        } as Response;

        sendHDStreamingConsumableResponse(res);

        assert.deepEqual(calls, [
            ["status", 200],
            ["json", DefaultHDStreamingConsumableResponse],
        ]);
    });

    test("does not apply an HD streaming potion without durable consumable state", () => {
        assert.throws(
            () =>
                applyHDStreamingConsumable({
                    channel_id: "100000000000000001",
                }),
            DiscordApiErrors.UNKNOWN_ENTITLEMENT,
        );
    });

    test("GET /users/@me/consumable/hd-streaming returns the compatibility state", async () => {
        const response = await requestJson(createHDStreamingConsumableRouteApp(), "/users/@me/consumable/hd-streaming");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, DefaultHDStreamingConsumableResponse);
    });

    test("POST /users/@me/consumable/hd-streaming validates params but rejects absent inventory", async () => {
        const response = await requestJson(createHDStreamingConsumableRouteApp(), "/users/@me/consumable/hd-streaming", {
            method: "POST",
            body: {
                channel_id: "100000000000000001",
            },
        });

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_ENTITLEMENT.code,
            message: DiscordApiErrors.UNKNOWN_ENTITLEMENT.message,
        });
    });

    test("documents bearer authentication and explicit OpenAPI responses", () => {
        const getOperation = getHDStreamingOpenApiOperation("get");
        const postOperation = getHDStreamingOpenApiOperation("post");

        assert.deepEqual(getOperation.security, [{ bearer: [] }]);
        assert.deepEqual(postOperation.security, [{ bearer: [] }]);

        assert.equal(getResponseSchemaRef(getOperation, "200"), "#/components/schemas/HDStreamingConsumableResponse");
        assert.equal(getResponseSchemaRef(getOperation, "401"), "#/components/schemas/APIErrorResponse");

        assert.ok(postOperation.responses?.["204"]);
        assert.equal(postOperation.requestBody?.required, true);
        assert.equal(postOperation.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/HDStreamingConsumableApplySchema");
        assert.equal(getResponseSchemaRef(postOperation, "400"), "#/components/schemas/APIErrorResponse");
        assert.equal(getResponseSchemaRef(postOperation, "401"), "#/components/schemas/APIErrorResponse");
    });
});
