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
import type {
    ApplicationCommandOption,
    ApplicationCommandOptionChoice,
    LocalizedApplicationCommandOption,
    LocalizedApplicationCommandOptionChoice,
} from "../../../schemas/api/developers/Application";
import type { ApplicationCommand } from "../../../util/entities/ApplicationCommand";
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

const APPLICATION_COMMAND_LOCALE_FALLBACKS: Record<string, string> = {
    "en-us": "en-GB",
    "en-gb": "en-US",
    "es-419": "es-ES",
};

type LocaleHeader = string | string[] | undefined;

function normalizeApplicationCommandLocale(locale: string) {
    return locale.trim().replace(/_/g, "-");
}

function headerLocaleValue(header: LocaleHeader) {
    if (typeof header !== "string") return undefined;

    const locale = normalizeApplicationCommandLocale(header);
    return locale || undefined;
}

function acceptLanguageLocale(acceptLanguageHeader: LocaleHeader) {
    if (typeof acceptLanguageHeader !== "string") return undefined;

    const preferences = acceptLanguageHeader
        .split(",")
        .map((part, index) => {
            const [rawLocale, ...parameters] = part.split(";").map((value) => value.trim());
            const locale = normalizeApplicationCommandLocale(rawLocale ?? "");
            if (!locale || locale === "*") return undefined;

            const qualityParameter = parameters.find((parameter) => parameter.toLowerCase().startsWith("q="));
            const quality = qualityParameter ? Number(qualityParameter.slice(2)) : 1;
            if (!Number.isFinite(quality) || quality <= 0) return undefined;

            return { locale, quality, index };
        })
        .filter((preference): preference is { locale: string; quality: number; index: number } => preference !== undefined);

    preferences.sort((a, b) => b.quality - a.quality || a.index - b.index);

    return preferences[0]?.locale;
}

function applicationCommandLocaleCandidates(locale: string) {
    const rawLocale = locale.trim();
    const normalizedLocale = normalizeApplicationCommandLocale(locale);
    const fallbackLocale = APPLICATION_COMMAND_LOCALE_FALLBACKS[normalizedLocale.toLowerCase()];

    return [...new Set([rawLocale, normalizedLocale, fallbackLocale].filter((candidate): candidate is string => !!candidate))];
}

function localizedApplicationCommandValue(localizations: Record<string, string> | null | undefined, locale: string | undefined) {
    if (!locale || !localizations) return undefined;

    for (const candidate of applicationCommandLocaleCandidates(locale)) {
        const localized = localizations[candidate];
        if (localized !== undefined) return localized;

        const normalizedCandidate = normalizeApplicationCommandLocale(candidate).toLowerCase();
        const matchingLocalization = Object.entries(localizations).find(([localizationLocale]) => normalizeApplicationCommandLocale(localizationLocale).toLowerCase() === normalizedCandidate);
        if (matchingLocalization) return matchingLocalization[1];
    }

    return undefined;
}

function serializeApplicationCommandOptionChoice(choice: ApplicationCommandOptionChoice, locale?: string): LocalizedApplicationCommandOptionChoice {
    return {
        ...choice,
        name_localized: localizedApplicationCommandValue(choice.name_localizations, locale),
    };
}

function serializeApplicationCommandOption(option: ApplicationCommandOption, locale?: string): LocalizedApplicationCommandOption {
    return {
        ...option,
        name_localized: localizedApplicationCommandValue(option.name_localizations, locale),
        description_localized: localizedApplicationCommandValue(option.description_localizations, locale),
        choices: option.choices?.map((choice) => serializeApplicationCommandOptionChoice(choice, locale)),
        options: option.options?.map((childOption) => serializeApplicationCommandOption(childOption, locale)),
    };
}

export function serializeApplicationCommand(command: ApplicationCommand, locale?: string): ApplicationCommandSchema {
    return {
        id: command.id,
        type: command.type,
        application_id: command.application_id,
        guild_id: command.guild_id,
        name: command.name,
        name_localizations: command.name_localizations,
        name_localized: localizedApplicationCommandValue(command.name_localizations, locale),
        description: command.description,
        description_localizations: command.description_localizations,
        description_localized: localizedApplicationCommandValue(command.description_localizations, locale),
        options: command.type === ApplicationCommandType.CHAT_INPUT ? command.options?.map((option) => serializeApplicationCommandOption(option, locale)) : undefined,
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

export function resolveApplicationCommandLocale(localeHeader: LocaleHeader, acceptLanguageHeader: LocaleHeader, userSettingsLocale: string | undefined) {
    return headerLocaleValue(localeHeader) ?? acceptLanguageLocale(acceptLanguageHeader) ?? (userSettingsLocale ? normalizeApplicationCommandLocale(userSettingsLocale) : undefined);
}
