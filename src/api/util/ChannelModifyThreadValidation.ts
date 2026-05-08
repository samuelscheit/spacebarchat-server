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

export function addThreadChannelModifyFieldErrors(errors: ErrorList, payload: ChannelModifySchema, isThread: boolean) {
    if (!isThread) return;

    if (payload.permission_overwrites !== undefined) {
        errors["permission_overwrites"] = makeObjectErrorContent("BASE_TYPE_BAD_VALUE", "Threads cannot update permission_overwrites");
    }

    for (const field of getInvalidThreadChannelOrderFields(payload, isThread)) {
        errors[field] = makeObjectErrorContent("BASE_TYPE_BAD_VALUE", `Threads cannot update ${field}`);
    }
}
