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

const APPLICATION_COMMAND_LOCALE_FALLBACKS: Record<string, string> = {
    "en-US": "en-GB",
    "en-GB": "en-US",
    "es-419": "es-ES",
};

type ApplicationCommandLocaleSource = string | string[] | null | undefined;

export type ApplicationCommandLocaleSources = {
    discordLocale?: ApplicationCommandLocaleSource;
    acceptLanguage?: ApplicationCommandLocaleSource;
    userSettingsLocale?: ApplicationCommandLocaleSource;
};

type ApplicationCommandLocalizationSource = {
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
};

function firstLocaleValue(locale: ApplicationCommandLocaleSource) {
    const localeValue = Array.isArray(locale) ? locale[0] : locale;

    return localeValue?.trim();
}

function normalizeApplicationCommandLocale(locale: ApplicationCommandLocaleSource) {
    const trimmedLocale = firstLocaleValue(locale);
    if (!trimmedLocale || trimmedLocale === "*") return undefined;

    const [language, region] = trimmedLocale.replace(/_/g, "-").split("-");
    if (!region) return language.toLowerCase() === "en" ? "en-US" : language.toLowerCase();

    return `${language.toLowerCase()}-${region.toUpperCase()}`;
}

function parseAcceptLanguageLocale(acceptLanguage: ApplicationCommandLocaleSource) {
    const acceptLanguageValue = firstLocaleValue(acceptLanguage);
    if (!acceptLanguageValue) return undefined;

    return acceptLanguageValue
        .split(",")
        .map((language, index) => {
            const [locale, ...parameters] = language.trim().split(";");
            const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
            const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;

            return {
                index,
                locale: normalizeApplicationCommandLocale(locale),
                quality: Number.isFinite(quality) ? quality : 0,
            };
        })
        .filter((language): language is { index: number; locale: string; quality: number } => !!language.locale && language.quality > 0)
        .sort((a, b) => b.quality - a.quality || a.index - b.index)[0]?.locale;
}

export function resolveApplicationCommandLocale(sources: ApplicationCommandLocaleSources) {
    return (
        normalizeApplicationCommandLocale(sources.discordLocale) ??
        parseAcceptLanguageLocale(sources.acceptLanguage) ??
        normalizeApplicationCommandLocale(sources.userSettingsLocale)
    );
}

function localizationsValueForLocale(localizations: Record<string, string>, locale: string) {
    const localized = localizations[locale];
    if (localized !== undefined) return localized;

    const normalizedLocale = normalizeApplicationCommandLocale(locale)?.toLowerCase();
    if (!normalizedLocale) return undefined;

    return Object.entries(localizations).find(([localizationLocale]) => normalizeApplicationCommandLocale(localizationLocale)?.toLowerCase() === normalizedLocale)?.[1];
}

export function getApplicationCommandLocalizedText(localizations: Record<string, string> | null | undefined, locale: string | null | undefined) {
    const normalizedLocale = normalizeApplicationCommandLocale(locale);
    if (!localizations || !normalizedLocale) return undefined;

    const fallbackLocale = APPLICATION_COMMAND_LOCALE_FALLBACKS[normalizedLocale];
    const baseLocale = normalizedLocale.split("-")[0];
    const localeCandidates = [normalizedLocale, fallbackLocale, baseLocale === normalizedLocale ? undefined : baseLocale].filter((candidate): candidate is string => !!candidate);

    for (const candidate of localeCandidates) {
        const localized = localizationsValueForLocale(localizations, candidate);
        if (localized !== undefined) return localized;
    }

    return undefined;
}

export function getApplicationCommandLocalizedFields(command: ApplicationCommandLocalizationSource, locale: string | null | undefined) {
    const nameLocalized = getApplicationCommandLocalizedText(command.name_localizations, locale);
    const descriptionLocalized = getApplicationCommandLocalizedText(command.description_localizations, locale);

    return {
        ...(nameLocalized === undefined ? {} : { name_localized: nameLocalized }),
        ...(descriptionLocalized === undefined ? {} : { description_localized: descriptionLocalized }),
    };
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

function serializeApplicationCommandOptionChoice(choice: ApplicationCommandOptionChoice, locale?: string): LocalizedApplicationCommandOptionChoice {
    const nameLocalized = getApplicationCommandLocalizedText(choice.name_localizations, locale);

    return {
        ...choice,
        ...(nameLocalized === undefined ? {} : { name_localized: nameLocalized }),
    };
}

function serializeApplicationCommandOption(option: ApplicationCommandOption, locale?: string): LocalizedApplicationCommandOption {
    return {
        ...option,
        ...getApplicationCommandLocalizedFields(option, locale),
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
        ...getApplicationCommandLocalizedFields(command, locale),
        description: command.description,
        description_localizations: command.description_localizations,
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
