import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ApplicationCommandCreateSchema } from "../../../schemas/api/bots/ApplicationCommandCreateSchema";
import { ApplicationCommandType } from "../../../schemas/api/bots/ApplicationCommandSchema";
import { ApplicationCommandOptionType } from "../../../schemas/api/developers/Application";
import type { ApplicationCommand } from "../../../util/entities/ApplicationCommand";
import { FieldError } from "../../../util/util/FieldError";
import { Snowflake } from "../../../util/util/Snowflake";
import { FindOperator } from "typeorm";
import {
    applicationCommandIdWhere,
    applicationCommandNameWhere,
    applicationCommandScopeWhere,
    buildApplicationCommand,
    normalizeApplicationCommandName,
    resolveApplicationCommandLocale,
    serializeApplicationCommand,
} from "./ApplicationCommands";

function assertIsNullOperator(value: unknown) {
    assert.equal(value instanceof FindOperator, true);
    assert.equal((value as FindOperator<unknown>).type, "isNull");
}

function applicationCommand(overrides: Partial<ApplicationCommand> = {}) {
    return {
        application_id: "app",
        type: ApplicationCommandType.CHAT_INPUT,
        name: "ping",
        description: "pong",
        default_member_permissions: null,
        version: "version",
        ...overrides,
    } as ApplicationCommand;
}

describe("application command helpers", () => {
    test("scopes global command predicates to null guild ids", () => {
        const scopeWhere = applicationCommandScopeWhere({ applicationId: "app" });
        assert.equal(scopeWhere.application_id, "app");
        assertIsNullOperator(scopeWhere.guild_id);

        const nameWhere = applicationCommandNameWhere({ applicationId: "app" }, "ping");
        assert.equal(nameWhere.application_id, "app");
        assert.equal(nameWhere.name, "ping");
        assertIsNullOperator(nameWhere.guild_id);

        const idWhere = applicationCommandIdWhere({ applicationId: "app" }, "command");
        assert.equal(idWhere.application_id, "app");
        assert.equal(idWhere.id, "command");
        assertIsNullOperator(idWhere.guild_id);
    });

    test("scopes guild command predicates to the requested guild", () => {
        assert.deepEqual(applicationCommandNameWhere({ applicationId: "app", guildId: "guild" }, "ping"), {
            application_id: "app",
            guild_id: "guild",
            name: "ping",
        });

        assert.deepEqual(applicationCommandIdWhere({ applicationId: "app", guildId: "guild" }, "command"), {
            application_id: "app",
            guild_id: "guild",
            id: "command",
        });
    });

    test("builds normalized command records", (t) => {
        t.mock.method(Snowflake, "generate", () => "version");

        const body: ApplicationCommandCreateSchema = {
            name: " ping ",
            description: " pong ",
        };
        const command = buildApplicationCommand({ applicationId: "app", guildId: "guild" }, body);

        assert.equal(command.application_id, "app");
        assert.equal(command.guild_id, "guild");
        assert.equal(command.name, "ping");
        assert.equal(command.description, "pong");
        assert.equal(command.dm_permission, true);
        assert.equal(command.type, ApplicationCommandType.CHAT_INPUT);
        assert.equal(command.version, "version");
        assert.equal(body.type, ApplicationCommandType.CHAT_INPUT);
    });

    test("preserves explicit false command flags", () => {
        const command = buildApplicationCommand(
            { applicationId: "app" },
            {
                name: "ping",
                dm_permission: false,
            },
        );

        assert.equal(command.dm_permission, false);
    });

    test("rejects empty and oversized command names", () => {
        assert.throws(() => normalizeApplicationCommandName(" "), FieldError);
        assert.throws(() => normalizeApplicationCommandName("a".repeat(33)), FieldError);
    });

    test("serializes localized command text for the requested locale", () => {
        const command = applicationCommand({
            id: "command",
            guild_id: "guild",
            name_localizations: { de: "ping-de", "pt-BR": "ping-pt-br" },
            description_localizations: { de: "pong-de", "pt-BR": "pong-pt-br" },
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "option",
                    name_localizations: { "pt-BR": "opcao" },
                    description: "option description",
                    description_localizations: { "pt-BR": "descricao da opcao" },
                    choices: [{ name: "first", name_localizations: { "pt-BR": "primeira" }, value: "first" }],
                },
            ],
        });

        const serialized = serializeApplicationCommand(command, "pt-BR");

        assert.equal(serialized.name_localized, "ping-pt-br");
        assert.equal(serialized.description_localized, "pong-pt-br");
        assert.equal(serialized.options?.[0].name_localized, "opcao");
        assert.equal(serialized.options?.[0].description_localized, "descricao da opcao");
        assert.equal(serialized.options?.[0].choices?.[0].name_localized, "primeira");
    });

    test("normalizes underscore command locales", () => {
        const command = applicationCommand({
            name_localizations: { "pt-BR": "ping-pt-br" },
            description_localizations: { "pt-BR": "pong-pt-br" },
        });

        const serialized = serializeApplicationCommand(command, "pt_BR");

        assert.equal(serialized.name_localized, "ping-pt-br");
        assert.equal(serialized.description_localized, "pong-pt-br");
    });

    test("uses Discord application command locale fallbacks", () => {
        const command = applicationCommand({
            name_localizations: { "en-GB": "colour", "es-ES": "color-es" },
            description_localizations: { "en-GB": "colour description", "es-ES": "descripcion" },
        });

        let serialized = serializeApplicationCommand(command, "en-US");
        assert.equal(serialized.name_localized, "colour");
        assert.equal(serialized.description_localized, "colour description");

        serialized = serializeApplicationCommand(command, "es-419");
        assert.equal(serialized.name_localized, "color-es");
        assert.equal(serialized.description_localized, "descripcion");

        serialized = serializeApplicationCommand(command, "en-us");
        assert.equal(serialized.name_localized, "colour");
        assert.equal(serialized.description_localized, "colour description");
    });

    test("omits localized fields when no localization matches", () => {
        const command = applicationCommand({
            type: ApplicationCommandType.USER,
            name_localizations: { de: "ping-de" },
            description_localizations: { de: "pong-de" },
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "not-sendable-for-user-command",
                    description: "not sendable for user command",
                },
            ],
        });

        const serialized = serializeApplicationCommand(command, "fr");
        const serializedJson = JSON.parse(JSON.stringify(serialized)) as Record<string, unknown>;

        assert.equal(serialized.name_localized, undefined);
        assert.equal(serialized.description_localized, undefined);
        assert.equal("name_localized" in serializedJson, false);
        assert.equal("description_localized" in serializedJson, false);
        assert.equal(serialized.options, undefined);
    });

    test("resolves command locale from Discord locale header first", () => {
        const locale = resolveApplicationCommandLocale("pt-BR", "de-DE", "fr");

        assert.equal(locale, "pt-BR");
    });

    test("resolves command locale from accept-language before user settings", () => {
        const locale = resolveApplicationCommandLocale(undefined, "fr;q=0.7, de-DE;q=0.9", "pt-BR");

        assert.equal(locale, "de-DE");
    });

    test("resolves command locale from user settings when locale headers are absent", () => {
        const locale = resolveApplicationCommandLocale(undefined, undefined, "de_DE");

        assert.equal(locale, "de-DE");
    });

    test("ignores non-string command locale headers", () => {
        const locale = resolveApplicationCommandLocale(["pt-BR", "de-DE"], "fr", "de-DE");

        assert.equal(locale, "fr");
    });
});
