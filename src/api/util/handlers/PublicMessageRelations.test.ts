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
import { createPublicMessageFindOptions, publicMessageRelations } from "./PublicMessageRelations";

const expectedPublicMessageRelations = ["application", "attachments", "author", "mention_channels", "mention_roles", "mentions", "sticker_items", "webhook"] as const;

test("public message relation helper keeps Message.toJSON public fields hydrated", () => {
    assert.deepEqual(Object.keys(publicMessageRelations).sort(), [...expectedPublicMessageRelations].sort());

    for (const relation of expectedPublicMessageRelations) {
        assert.equal(publicMessageRelations[relation], true);
    }
});

test("public message find options use the shared public relations", () => {
    const options = createPublicMessageFindOptions(["100", "200"]);

    assert.equal(options.relations, publicMessageRelations);
});
