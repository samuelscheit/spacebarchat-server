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

export interface OAuthAuthorizeInfoGuild {
    id: string;
    name: string;
    icon: string | null;
    mfa_level: number;
    permissions: string;
}

export interface OAuthAuthorizeInfoUser {
    id: string;
    username: string;
    avatar: string | null;
    avatar_decoration: string | null;
    discriminator: string;
    public_flags: number;
}

export interface OAuthAuthorizeInfoApplication {
    id: string;
    name: string;
    icon: string | null;
    description: string;
    summary: string;
    type?: object | null;
    hook: boolean;
    guild_id: string | null;
    bot_public: boolean;
    bot_require_code_grant: boolean;
    verify_key: string;
    flags: number;
}

export interface OAuthAuthorizeInfoBot {
    id: string;
    username: string;
    avatar: string | null;
    avatar_decoration: string | null;
    discriminator: string;
    public_flags: number;
    bot: boolean;
    approximated_guild_count: number;
}

export interface OAuthAuthorizeInfoResponse {
    guilds: OAuthAuthorizeInfoGuild[];
    user: OAuthAuthorizeInfoUser;
    application: OAuthAuthorizeInfoApplication;
    bot: OAuthAuthorizeInfoBot;
    authorized: boolean;
}
