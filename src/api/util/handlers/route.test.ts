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
        coerceRequestBody: false,
    });
}

test("route rejects numeric install param permissions without mutating them", async () => {
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
        (error: { code?: number; _ajvErrors?: { instancePath: string; keyword: string }[] }) => {
            assert.equal(error.code, 50035);
            assert.equal(
                error._ajvErrors?.some((ajvError) => ajvError.instancePath === "/install_params/permissions" && ajvError.keyword === "type"),
                true,
            );
            return true;
        },
    );
    assert.equal(typeof req.body.install_params.permissions, "number");
});

test("route rejects scalar install params instead of coercing them to null", async () => {
    const middleware = await getApplicationModifyRoute();
    for (const body of [{ install_params: 0 }, { install_params: false }, { install_params: "" }]) {
        const req = { body } as Request;

        await assert.rejects(
            () => middleware(req, {} as Response, assert.fail as NextFunction),
            (error: { code?: number; _ajvErrors?: { instancePath: string; keyword: string }[] }) => {
                assert.equal(error.code, 50035);
                assert.equal(
                    error._ajvErrors?.some((ajvError) => ajvError.instancePath === "/install_params" && ajvError.keyword === "anyOf"),
                    true,
                );
                return true;
            },
        );
        assert.notEqual(req.body.install_params, null);
    }
});

test("route allows install param permissions that are already strings", async () => {
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

test("route allows omitted and null install params", async () => {
    const middleware = await getApplicationModifyRoute();
    for (const body of [{}, { install_params: null }]) {
        const req = { body } as Request;
        let nextCalled = false;

        await middleware(req, {} as Response, (() => (nextCalled = true)) as NextFunction);

        assert.equal(nextCalled, true);
    }
});
