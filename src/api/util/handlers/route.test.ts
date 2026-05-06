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
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

async function getApplicationModifyRoute() {
    process.env.DATABASE ??= "postgres://user:password@localhost:5432/database";
    const { route } = await import("./route.js");

    return route({
        requestBody: "ApplicationModifySchema",
        strictStringFields: ["install_params.permissions"],
    });
}

test("route rejects numeric strict string fields before AJV can coerce them", async () => {
    const middleware = await getApplicationModifyRoute();
    const req = {
        body: {
            install_params: {
                scopes: ["bot"],
                permissions: 9007199254740992,
            },
        },
    } as Request;

    await assert.rejects(
        () => middleware(req, {} as Response, assert.fail as NextFunction),
        (error: { code?: number; errors?: Record<string, { _errors: { code: string }[] }> }) => {
            assert.equal(error.code, 50035);
            assert.equal(error.errors?.["install_params.permissions"]?._errors[0]?.code, "BASE_TYPE_STRING");
            return true;
        },
    );
    assert.equal(typeof req.body.install_params.permissions, "number");
});

test("route allows strict string fields that are already strings", async () => {
    const middleware = await getApplicationModifyRoute();
    const req = {
        body: {
            install_params: {
                scopes: ["bot"],
                permissions: "9007199254740993",
            },
        },
    } as Request;
    let nextCalled = false;

    await middleware(req, {} as Response, (() => (nextCalled = true)) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(req.body.install_params.permissions, "9007199254740993");
});

test("route strict string fields ignore omitted and null paths", async () => {
    const middleware = await getApplicationModifyRoute();
    for (const body of [{}, { install_params: null }]) {
        const req = { body } as Request;
        let nextCalled = false;

        await middleware(req, {} as Response, (() => (nextCalled = true)) as NextFunction);

        assert.equal(nextCalled, true);
    }
});
