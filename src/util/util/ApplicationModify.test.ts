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
import type { ApplicationModifySchema } from "@spacebar/schemas";
import { OrmUtils } from "../imports/OrmUtils";
import { applyApplicationModifySchema } from "./ApplicationModify";

type TestInstallParams = NonNullable<ApplicationModifySchema["install_params"]> & { stale?: boolean };

interface TestApplication {
    description?: string;
    install_params?: ApplicationModifySchema["install_params"] | TestInstallParams;
    assign(props: object): TestApplication;
}

function createTestApplication(): TestApplication {
    return {
        assign(props: object) {
            OrmUtils.mergeDeep(this, props);
            return this;
        },
    };
}

test("applyApplicationModifySchema replaces install params instead of deep-merging stale nested values", () => {
    const app = createTestApplication();
    app.install_params = {
        permissions: "8",
        scopes: ["bot", "applications.commands"],
        stale: true,
    };
    const previousInstallParams = app.install_params;

    const body: ApplicationModifySchema = {
        install_params: {
            permissions: "0",
            scopes: ["bot"],
        },
    };

    applyApplicationModifySchema(app, body);

    assert.deepEqual(app.install_params, {
        permissions: "0",
        scopes: ["bot"],
    });
    assert.notEqual(app.install_params?.scopes, body.install_params?.scopes);
    assert.deepEqual(previousInstallParams, {
        permissions: "8",
        scopes: ["bot", "applications.commands"],
        stale: true,
    });
});

test("applyApplicationModifySchema clears install params when null is provided", () => {
    const app = createTestApplication();
    app.install_params = {
        permissions: "8",
        scopes: ["bot"],
    };

    applyApplicationModifySchema(app, { install_params: null });

    assert.equal(app.install_params, null);
});

test("applyApplicationModifySchema preserves install params when omitted", () => {
    const app = createTestApplication();
    const installParams = {
        permissions: "8",
        scopes: ["bot", "applications.commands"] as ("applications.commands" | "bot")[],
    };
    app.install_params = installParams;

    applyApplicationModifySchema(app, { description: "updated description" });

    assert.equal(app.description, "updated description");
    assert.equal(app.install_params, installParams);
});
