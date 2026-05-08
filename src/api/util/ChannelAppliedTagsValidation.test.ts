/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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
import { FieldError } from "../../util/util/FieldError";
import { assertAppliedTagsExist, assertRequiredAppliedTagsPresent } from "./ChannelAppliedTagsValidation";

test("assertRequiredAppliedTagsPresent allows missing tags when the parent forum does not require one", () => {
    assert.doesNotThrow(() => assertRequiredAppliedTagsPresent(undefined, false));
    assert.doesNotThrow(() => assertRequiredAppliedTagsPresent([], false));
});

test("assertRequiredAppliedTagsPresent allows at least one tag when the parent forum requires one", () => {
    assert.doesNotThrow(() => assertRequiredAppliedTagsPresent(["tag-a"], true));
});

test("assertRequiredAppliedTagsPresent reports missing required applied_tags as an invalid form body", () => {
    assert.throws(
        () => assertRequiredAppliedTagsPresent([], true),
        (error) => {
            assert.ok(error instanceof FieldError);
            assert.equal(error.code, 50035);
            assert.equal(error.message, "Invalid Form Body");
            assert.deepEqual(error.errors, {
                applied_tags: {
                    _errors: [
                        {
                            code: "BASE_TYPE_REQUIRED",
                            message: "Tag is required for this API.",
                        },
                    ],
                },
            });
            return true;
        },
    );
});

test("assertAppliedTagsExist allows tags present on the parent forum", () => {
    assert.doesNotThrow(() => assertAppliedTagsExist(["tag-a", "tag-b"], ["tag-a", "tag-b", "tag-c"]));
});

test("assertAppliedTagsExist reports invalid applied_tags as an invalid form body", () => {
    assert.throws(
        () => assertAppliedTagsExist(["tag-a", "missing-tag"], ["tag-a", "tag-b"]),
        (error) => {
            assert.ok(error instanceof FieldError);
            assert.equal(error.code, 50035);
            assert.equal(error.message, "Invalid Form Body");
            assert.deepEqual(error.errors, {
                applied_tags: {
                    _errors: [
                        {
                            code: "BASE_TYPE_CHOICES",
                            message: "Tag missing-tag is not available for this forum channel.",
                        },
                    ],
                },
            });
            return true;
        },
    );
});

test("assertAppliedTagsExist reports empty-string tags as invalid applied_tags", () => {
    assert.throws(
        () => assertAppliedTagsExist([""], ["tag-a"]),
        (error) => {
            assert.ok(error instanceof FieldError);
            assert.equal(error.code, 50035);
            assert.deepEqual(error.errors, {
                applied_tags: {
                    _errors: [
                        {
                            code: "BASE_TYPE_CHOICES",
                            message: "Tag '' is not available for this forum channel.",
                        },
                    ],
                },
            });
            return true;
        },
    );
});
