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
import { BitField } from "./BitField";

class TestBitField extends BitField {
    static FLAGS = {
        FIRST: 1n,
        SECOND: 1n << 1n,
        THIRD: 1n << 2n,
    };
}

test("BitField inherited helpers use subclass flags", () => {
    const flags = new TestBitField(["FIRST", "THIRD"]);

    assert.deepEqual(flags.toArray(), ["FIRST", "THIRD"]);
    assert.deepEqual(flags.serialize(), {
        FIRST: true,
        SECOND: false,
        THIRD: true,
    });
    assert.deepEqual(flags.missing(["FIRST", "SECOND", "THIRD"]), ["SECOND"]);
    assert.deepEqual(flags.missing(new TestBitField(["FIRST", "SECOND", "THIRD"])), ["SECOND"]);
});

test("BitField immutable operations preserve the subclass", () => {
    const frozen = new TestBitField("FIRST").freeze();

    const added = frozen.add("SECOND");
    assert.ok(added instanceof TestBitField);
    assert.notEqual(added, frozen);
    assert.deepEqual(added.toArray(), ["FIRST", "SECOND"]);
    assert.deepEqual(frozen.toArray(), ["FIRST"]);

    const removed = frozen.remove("FIRST");
    assert.ok(removed instanceof TestBitField);
    assert.notEqual(removed, frozen);
    assert.deepEqual(removed.toArray(), []);
    assert.deepEqual(frozen.toArray(), ["FIRST"]);
});
