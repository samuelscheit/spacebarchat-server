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
import { describe, test } from "node:test";
import { serializeTokenResponseSettings } from "./AuthTokenResponseSettings";

describe("serializeTokenResponseSettings", () => {
    test("omits the database index from persisted settings", () => {
        const settings = {
            index: "42",
            locale: "de",
            theme: "light",
        };

        const serialized = serializeTokenResponseSettings(settings);

        assert.equal(serialized.locale, "de");
        assert.equal(serialized.theme, "light");
        assert.equal("index" in serialized, false);
    });

    test("returns default settings when a user has no settings row", () => {
        const serialized = serializeTokenResponseSettings(null);

        assert.equal(serialized.locale, "en-US");
        assert.equal(serialized.theme, "dark");
        assert.equal("index" in serialized, false);
    });
});
