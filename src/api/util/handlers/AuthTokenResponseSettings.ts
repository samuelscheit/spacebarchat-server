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

import { DefaultUserSettings, UserSettingsSchema } from "../../../schemas/api/users/UserSettings";

type TokenSettings = Partial<UserSettingsSchema> & { index?: string };

function createDefaultTokenResponseSettings(): UserSettingsSchema {
    return {
        ...DefaultUserSettings,
        friend_source_flags: { ...DefaultUserSettings.friend_source_flags },
        guild_folders: [...DefaultUserSettings.guild_folders],
        guild_positions: [...DefaultUserSettings.guild_positions],
        restricted_guilds: [...DefaultUserSettings.restricted_guilds],
    };
}

export function serializeTokenResponseSettings(settings?: TokenSettings | null): UserSettingsSchema {
    const serialized = { ...createDefaultTokenResponseSettings(), ...(settings ?? {}) };
    delete (serialized as Partial<TokenSettings>).index;
    return serialized as UserSettingsSchema;
}
