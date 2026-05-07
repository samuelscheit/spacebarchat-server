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
import { DefaultUserSettings } from "../../../schemas/api/users/UserSettings";
import { serializeTokenResponseSettings } from "./AuthTokenResponseSettings";

describe("serializeTokenResponseSettings", () => {
    test("omits the database index from persisted settings", () => {
        const settings = {
            index: "42",
            locale: "de",
            theme: "light",
        } as const;

        const serialized = serializeTokenResponseSettings(settings);

        assert.equal(serialized.locale, "de");
        assert.equal(serialized.theme, "light");
        assert.equal("index" in serialized, false);
    });

    test("fills missing persisted settings with public defaults", () => {
        const serialized = serializeTokenResponseSettings({
            index: "42",
            locale: "de",
            theme: "light",
        } as const);

        assert.deepEqual(Object.keys(serialized).sort(), Object.keys(DefaultUserSettings).sort());
        assert.equal(serialized.afk_timeout, DefaultUserSettings.afk_timeout);
        assert.equal(serialized.friend_source_flags.all, DefaultUserSettings.friend_source_flags.all);
        assert.deepEqual(serialized.guild_folders, DefaultUserSettings.guild_folders);
        assert.deepEqual(serialized.guild_positions, DefaultUserSettings.guild_positions);
        assert.equal(serialized.locale, "de");
        assert.equal(serialized.theme, "light");
        assert.equal("index" in serialized, false);
    });

    test("returns complete default settings when a user has no settings row", () => {
        const serialized = serializeTokenResponseSettings(null);

        assert.deepEqual(serialized, DefaultUserSettings);
        assert.equal("index" in serialized, false);
    });
});
