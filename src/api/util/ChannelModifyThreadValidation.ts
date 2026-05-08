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

import { ChannelModifySchema } from "@spacebar/schemas";
import { ErrorList, getInvalidThreadChannelOrderFields, makeObjectErrorContent } from "@spacebar/util";

export const THREAD_PERMISSION_OVERWRITES_ERROR_MESSAGE = "Threads cannot update permission_overwrites";

type AvailableThreadTag = {
    id: string;
    moderated?: boolean | null;
};

export interface ThreadAppliedTagValidationResult {
    shouldApply: boolean;
    requiresManageThreads: boolean;
}

export function createThreadPermissionOverwriteFieldErrors(): ErrorList {
    const errors: ErrorList = {};
    addThreadPermissionOverwriteFieldError(errors);
    return errors;
}

export function addThreadPermissionOverwriteFieldError(errors: ErrorList) {
    errors["permission_overwrites"] = makeObjectErrorContent("BASE_TYPE_BAD_VALUE", THREAD_PERMISSION_OVERWRITES_ERROR_MESSAGE);
}

export function addThreadChannelModifyFieldErrors(errors: ErrorList, payload: ChannelModifySchema, isThread: boolean) {
    if (!isThread) return;

    if (payload.permission_overwrites !== undefined) {
        addThreadPermissionOverwriteFieldError(errors);
    }

    for (const field of getInvalidThreadChannelOrderFields(payload, isThread)) {
        errors[field] = makeObjectErrorContent("BASE_TYPE_BAD_VALUE", `Threads cannot update ${field}`);
    }
}

export function validateThreadAppliedTags(
    errors: ErrorList,
    appliedTags: string[] | undefined,
    currentAppliedTags: string[] | undefined,
    availableTags: AvailableThreadTag[] | undefined,
): ThreadAppliedTagValidationResult {
    if (appliedTags === undefined) {
        return { shouldApply: false, requiresManageThreads: false };
    }

    const realTags = new Map((availableTags ?? []).map((tag) => [tag.id, tag]));
    const badTag = appliedTags.find((tag) => !realTags.has(tag));
    if (badTag !== undefined) {
        errors["applied_tags"] = makeObjectErrorContent("BASE_TYPE_BAD_VALUE", `Invalid tag ${badTag}`);
        return { shouldApply: false, requiresManageThreads: false };
    }

    const changed = new Set(currentAppliedTags ?? []).symmetricDifference(new Set(appliedTags));
    const requiresManageThreads = [...changed].some((tag) => realTags.get(tag)?.moderated);

    return { shouldApply: true, requiresManageThreads };
}
