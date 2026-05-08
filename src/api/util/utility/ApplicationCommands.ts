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

import type { ApplicationCommandCreateSchema } from "../../../schemas/api/bots/ApplicationCommandCreateSchema";
import { ApplicationCommandType, type ApplicationCommandSchema } from "../../../schemas/api/bots/ApplicationCommandSchema";
import type { ApplicationCommand } from "../../../util/entities/ApplicationCommand";
import type { User } from "../../../util/entities/User";
import { FieldErrors } from "../../../util/util/FieldError";
import { Snowflake } from "../../../util/util/Snowflake";
import { FindOptionsWhere, IsNull } from "typeorm";

export type ApplicationCommandScope = {
    applicationId: string;
    guildId?: string;
};

export function applicationCommandScopeWhere(scope: ApplicationCommandScope): FindOptionsWhere<ApplicationCommand> {
    return {
        application_id: scope.applicationId,
        guild_id: scope.guildId ?? IsNull(),
    };
}

export function applicationCommandNameWhere(scope: ApplicationCommandScope, name: string): FindOptionsWhere<ApplicationCommand> {
    return {
        ...applicationCommandScopeWhere(scope),
        name,
    };
}

export function applicationCommandIdWhere(scope: ApplicationCommandScope, commandId: string): FindOptionsWhere<ApplicationCommand> {
    return {
        ...applicationCommandScopeWhere(scope),
        id: commandId,
    };
}

export function normalizeApplicationCommandName(name: string) {
    const trimmedName = name.trim();

    if (trimmedName.length < 1 || trimmedName.length > 32) {
        // TODO: configurable?
        throw FieldErrors({
            name: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: `Must be between 1 and 32 in length.`,
            },
        });
    }

    return trimmedName;
}

export function buildApplicationCommand(scope: ApplicationCommandScope, body: ApplicationCommandCreateSchema): ApplicationCommandSchema {
    body.type ??= 1;

    return {
        application_id: scope.applicationId,
        guild_id: scope.guildId,
        name: normalizeApplicationCommandName(body.name),
        name_localizations: body.name_localizations,
        description: body.description?.trim() || "",
        description_localizations: body.description_localizations,
        default_member_permissions: body.default_member_permissions || null,
        contexts: body.contexts,
        dm_permission: body.dm_permission ?? true,
        global_popularity_rank: 1,
        handler: body.handler,
        integration_types: body.integration_types,
        nsfw: body.nsfw,
        options: body.options,
        type: body.type,
        version: Snowflake.generate(),
    };
}

function resolveLocalizedApplicationCommandText(localizations: Record<string, string> | undefined, locale: string | undefined, fallback: string) {
    if (!locale || !localizations) return fallback;

    const normalizedLocale = locale.replace("_", "-");
    const language = normalizedLocale.split("-")[0];

    return localizations[locale] ?? localizations[normalizedLocale] ?? localizations[language] ?? fallback;
}

export function serializeApplicationCommand(command: ApplicationCommand, locale?: string): ApplicationCommandSchema {
    return {
        id: command.id,
        type: command.type,
        application_id: command.application_id,
        guild_id: command.guild_id,
        name: command.name,
        name_localizations: command.name_localizations,
        name_localized: resolveLocalizedApplicationCommandText(command.name_localizations, locale, command.name),
        description: command.description,
        description_localizations: command.description_localizations,
        description_localized: resolveLocalizedApplicationCommandText(command.description_localizations, locale, command.description),
        options: command.type === ApplicationCommandType.CHAT_INPUT ? command.options : undefined,
        default_member_permissions: command.default_member_permissions,
        dm_permission: command.dm_permission,
        permissions: command.permissions,
        nsfw: command.nsfw,
        integration_types: command.integration_types,
        global_popularity_rank: command.global_popularity_rank,
        contexts: command.contexts,
        version: command.version,
        handler: command.handler,
    };
}

export function resolveApplicationCommandLocale(localeHeader: string | string[] | undefined, user: Pick<User, "settings"> | undefined, requestLanguage: string | undefined) {
    if (typeof localeHeader === "string") return localeHeader;

    return user?.settings?.locale ?? requestLanguage;
}
