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
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import { Note } from "@spacebar/util";
import express from "express";
import notesRouter from "../../src/api/routes/users/@me/notes";

type JsonSchema = {
    type?: string;
    additionalProperties?: boolean | JsonSchema;
};

describe("GET /users/@me/notes", () => {
    test("returns a target-user-id to note mapping for the current user's notes", async () => {
        const ownerId = "100000000000000001";
        const firstTargetId = "100000000000000002";
        const secondTargetId = "100000000000000003";
        const findOptions: unknown[] = [];
        const originalFind = Note.find;

        (Note as unknown as { find: typeof Note.find }).find = (async (options?: unknown) => {
            findOptions.push(options);
            return [
                { content: "second note", target: { id: secondTargetId } },
                { content: "first note", target: { id: firstTargetId } },
            ] as unknown as Awaited<ReturnType<typeof Note.find>>;
        }) as typeof Note.find;

        const app = express();
        app.use((req, _res, next) => {
            req.user_id = ownerId;
            next();
        });
        app.use("/users/@me/notes", notesRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/users/@me/notes`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                [firstTargetId]: "first note",
                [secondTargetId]: "second note",
            });
            assert.deepEqual(findOptions, [
                {
                    where: {
                        owner: { id: ownerId },
                    },
                    relations: {
                        target: true,
                    },
                },
            ]);
        } finally {
            (Note as unknown as { find: typeof Note.find }).find = originalFind;
            await close(server);
        }
    });

    test("is present in generated route artifacts with the documented mapping schema", () => {
        const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        assert.deepEqual(schemas.UserNotesResponse, {
            type: "object",
            additionalProperties: {
                type: "string",
            },
            $schema: "http://json-schema.org/draft-07/schema#",
        });

        const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths: Record<
                string,
                {
                    get?: {
                        security?: Array<Record<string, unknown[]>>;
                        responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
                    };
                }
            >;
            components: { schemas: Record<string, JsonSchema> };
        };
        const operation = openapi.paths["/users/@me/notes/"]?.get;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserNotesResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapi.components.schemas.UserNotesResponse, {
            type: "object",
            additionalProperties: {
                type: "string",
            },
        });

        const catalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as Array<{ method: string; route: string; route_name: string; source: string; response_schema_refs?: string[] }>;
        assert.deepEqual(
            catalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/notes"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "UserNotesResponse"],
                route: "/users/@me/notes",
                route_name: "GET_USERS__ME_NOTES",
                source: "src/api/routes/users/@me/notes.ts",
            },
        );

        const missing = JSON.parse(readFileSync(path.join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries: Array<{ method: string; route: string }>;
        };
        assert.equal(
            missing.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/users/@me/notes"),
            false,
        );
    });
});

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
