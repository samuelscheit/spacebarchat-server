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

import type { Snowflake } from "../Identifiers";

export interface GameInviteCreateSchema {
    recipient_id: Snowflake;

    /**
     * @maxLength 8192
     */
    launch_parameters: string;

    /**
     * @format uri
     */
    application_asset: string;

    /**
     * @minLength 2
     * @maxLength 128
     */
    application_name: string;

    /**
     * @format uri
     */
    fallback_url?: string | null;

    /**
     * @minimum 300
     * @maximum 86400
     */
    ttl?: number;
}
