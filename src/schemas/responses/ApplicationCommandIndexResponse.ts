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

import type { ApplicationCommandIndexPermissions, ApplicationCommandSchema } from "../api/bots/ApplicationCommandSchema";
import type { Snowflake } from "../Identifiers";

export interface ApplicationCommandIndexEmbeddedActivityConfigResponse {
    supported_platforms?: string[];
}

export interface ApplicationCommandIndexBotResponse {
    id?: Snowflake;
    username?: string;
    discriminator?: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
}

export interface ApplicationCommandIndexApplicationResponse {
    id: Snowflake;
    name: string;
    description: string;
    icon?: string | null;
    permissions?: ApplicationCommandIndexPermissions;
    bot?: ApplicationCommandIndexBotResponse;
    bot_id?: Snowflake;
    flags: number;
    embedded_activity_config?: ApplicationCommandIndexEmbeddedActivityConfigResponse;
}

export interface ApplicationCommandIndexResponse {
    applications: ApplicationCommandIndexApplicationResponse[];
    application_commands: ApplicationCommandSchema[];
    version: Snowflake;
}
