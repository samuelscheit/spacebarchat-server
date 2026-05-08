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

import { FieldErrors } from "../../util/util/FieldError";

export function assertRequiredAppliedTagsPresent(appliedTags: string[] | undefined, requireTag: boolean) {
    if (!requireTag || appliedTags?.length) return;

    throw FieldErrors({
        applied_tags: {
            code: "BASE_TYPE_REQUIRED",
            message: "Tag is required for this API.",
        },
    });
}

export function assertAppliedTagsExist(appliedTags: string[], availableTagIds: Iterable<string>) {
    const availableTagIdSet = new Set(availableTagIds);
    const invalidTag = appliedTags.find((tag) => !availableTagIdSet.has(tag));

    if (invalidTag === undefined) return;

    const invalidTagDescription = invalidTag.length ? invalidTag : "''";

    throw FieldErrors({
        applied_tags: {
            code: "BASE_TYPE_CHOICES",
            message: `Tag ${invalidTagDescription} is not available for this forum channel.`,
        },
    });
}
