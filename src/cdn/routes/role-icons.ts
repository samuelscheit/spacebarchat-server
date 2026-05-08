/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { STATIC_IMAGE_MIME_TYPES } from "../util/ImageRouteHelpers";
import { createHashImageRouter } from "../util/ImageRoute";

// WebP can be animated while still reporting image/webp, so keep role icons to
// formats this route can classify as static from MIME detection alone.
export const ROLE_ICON_MIME_TYPES = STATIC_IMAGE_MIME_TYPES.filter((mimeType) => mimeType !== "image/webp");

export default createHashImageRouter({
    pathPrefix: "role-icons",
    resourceParam: "role_id",
    allowedMimeTypes: ROLE_ICON_MIME_TYPES,
    legacyHashExtensions: ["png", "jpg", "jpeg", "webp", "svg"],
    resize: true,
});
