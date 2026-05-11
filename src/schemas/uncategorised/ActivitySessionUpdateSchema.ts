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

export interface ActivitySessionUpdateSchema {
    token?: string;
    application_id: Snowflake;
    /**
     * @minimum 0
     * @maximum 1800
     */
    duration?: number;
    share_activity?: boolean;
    distributor?: string;
    /**
     * @maxLength 128
     */
    exe_path?: string;
    voice_channel_id?: Snowflake;
    session_id?: string;
    media_session_id?: string;
    closed?: boolean;
}
