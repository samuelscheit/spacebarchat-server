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

interface OAuthAuthorizeApplicationSource {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
    summary?: string | null;
    type?: object | null;
    hook: boolean;
    guild_id?: string | null;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    verify_key: string;
    flags: number;
}

export function serializeOAuthAuthorizeApplication(app: OAuthAuthorizeApplicationSource) {
    return {
        id: app.id,
        name: app.name,
        icon: app.icon,
        description: app.description,
        summary: app.summary,
        type: app.type,
        hook: app.hook,
        guild_id: app.guild_id ?? null,
        bot_public: app.bot_public,
        bot_require_code_grant: app.bot_require_code_grant,
        verify_key: app.verify_key,
        flags: app.flags,
    };
}
