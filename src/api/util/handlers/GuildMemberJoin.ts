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

import { Config, DiscordApiErrors, Emoji, getRights, Guild, Member, Role, Sticker } from "@spacebar/util";

export type GuildMemberJoinQuery = {
    lurker?: boolean | string | string[];
};

export type GuildMemberJoinInput = {
    guild_id: string;
    member_id: string;
    user_id: string;
    user_bot?: boolean;
    query?: GuildMemberJoinQuery;
};

export type GuildMemberJoinResult =
    | {
          status: 204;
      }
    | {
          status: 200;
          data: unknown;
      };

type GuildMemberJoinRights = {
    hasThrow: (right: "JOIN_GUILDS") => unknown;
};

type GuildMemberJoinGuild = {
    features: string[];
} & object;

export type GuildMemberJoinDependencies = {
    getRights: (user_id: string) => Promise<GuildMemberJoinRights>;
    configGet: () => { user: { botsCanUseInvites: boolean } };
    memberCount: (query: unknown) => Promise<number>;
    memberAddToGuild: (member_id: string, guild_id: string) => Promise<unknown>;
    guildFindOneOrFail: (query: unknown) => Promise<GuildMemberJoinGuild>;
    emojiFind: (query: unknown) => Promise<unknown[]>;
    roleFind: (query: unknown) => Promise<unknown[]>;
    stickerFind: (query: unknown) => Promise<unknown[]>;
};

const defaultDependencies: GuildMemberJoinDependencies = {
    getRights,
    configGet: Config.get,
    memberCount: (query) => Member.count(query as Parameters<typeof Member.count>[0]),
    memberAddToGuild: Member.addToGuild.bind(Member),
    guildFindOneOrFail: (query) => Guild.findOneOrFail(query as Parameters<typeof Guild.findOneOrFail>[0]) as Promise<Guild>,
    emojiFind: (query) => Emoji.find(query as Parameters<typeof Emoji.find>[0]) as Promise<Emoji[]>,
    roleFind: (query) => Role.find(query as Parameters<typeof Role.find>[0]) as Promise<Role[]>,
    stickerFind: (query) => Sticker.find(query as Parameters<typeof Sticker.find>[0]) as Promise<Sticker[]>,
};

export function isLurkerJoinRequest(query?: GuildMemberJoinQuery) {
    const value = query?.lurker;
    if (Array.isArray(value)) return value.some((x) => x === "true" || x === "1");
    return value === true || value === "true" || value === "1";
}

export async function joinGuildMember(input: GuildMemberJoinInput, dependencies: GuildMemberJoinDependencies = defaultDependencies): Promise<GuildMemberJoinResult> {
    const rights = await dependencies.getRights(input.user_id);

    let member_id = input.member_id;
    if (member_id === "@me") {
        member_id = input.user_id;
        rights.hasThrow("JOIN_GUILDS");
        if (input.user_bot && !dependencies.configGet().user.botsCanUseInvites) throw DiscordApiErrors.BOT_PROHIBITED_ENDPOINT;
    } else {
        // TODO: check oauth2 scope
        throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;
    }

    if (isLurkerJoinRequest(input.query)) {
        const existingMemberCount = await dependencies.memberCount({ where: { id: member_id, guild_id: input.guild_id } });
        if (existingMemberCount > 0) return { status: 204 };
    }

    const guild = await dependencies.guildFindOneOrFail({ where: { id: input.guild_id } });

    if (!guild.features.includes("DISCOVERABLE")) throw DiscordApiErrors.UNKNOWN_GUILD;

    const emoji = await dependencies.emojiFind({ where: { guild_id: input.guild_id } });
    const roles = await dependencies.roleFind({ where: { guild_id: input.guild_id } });
    const stickers = await dependencies.stickerFind({ where: { guild_id: input.guild_id } });

    await dependencies.memberAddToGuild(member_id, input.guild_id);
    return { status: 200, data: { ...guild, emojis: emoji, roles: roles, stickers: stickers } };
}
