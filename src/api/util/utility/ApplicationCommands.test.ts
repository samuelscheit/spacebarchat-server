import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ApplicationCommandCreateSchema } from "../../../schemas/api/bots/ApplicationCommandCreateSchema";
import { ApplicationCommandType } from "../../../schemas/api/bots/ApplicationCommandSchema";
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
        const command = {
            id: "command",
            application_id: "app",
            guild_id: "guild",
            type: ApplicationCommandType.CHAT_INPUT,
            name: "ping",
            name_localizations: { de: "ping-de", "pt-BR": "ping-pt-br" },
            description: "pong",
            description_localizations: { de: "pong-de", "pt-BR": "pong-pt-br" },
            options: [{ name: "option" }],
            default_member_permissions: null,
            version: "version",
        };

        const serialized = serializeApplicationCommand(command as never, "pt-BR");

        assert.equal(serialized.name_localized, "ping-pt-br");
        assert.equal(serialized.description_localized, "pong-pt-br");
        assert.deepEqual(serialized.options, [{ name: "option" }]);
    });

    test("falls back to base language command localizations", () => {
        const command = {
            application_id: "app",
            type: ApplicationCommandType.CHAT_INPUT,
            name: "ping",
            name_localizations: { de: "ping-de" },
            description: "pong",
            description_localizations: { de: "pong-de" },
            default_member_permissions: null,
            version: "version",
        };

        const serialized = serializeApplicationCommand(command as never, "de-DE");

        assert.equal(serialized.name_localized, "ping-de");
        assert.equal(serialized.description_localized, "pong-de");
    });

    test("falls back to default command text when no localization matches", () => {
        const command = {
            application_id: "app",
            type: ApplicationCommandType.USER,
            name: "ping",
            name_localizations: { de: "ping-de" },
            description: "pong",
            description_localizations: { de: "pong-de" },
            options: [{ name: "not-sendable-for-user-command" }],
            default_member_permissions: null,
            version: "version",
        };

        const serialized = serializeApplicationCommand(command as never, "fr");

        assert.equal(serialized.name_localized, "ping");
        assert.equal(serialized.description_localized, "pong");
        assert.equal(serialized.options, undefined);
    });

    test("resolves command locale from Discord locale header first", () => {
        const locale = resolveApplicationCommandLocale("pt-BR", { settings: { locale: "de-DE" } } as never, "fr");

        assert.equal(locale, "pt-BR");
    });

    test("resolves command locale from user settings before request language", () => {
        const locale = resolveApplicationCommandLocale(undefined, { settings: { locale: "de-DE" } } as never, "fr");

        assert.equal(locale, "de-DE");
    });

    test("ignores non-string command locale headers", () => {
        const locale = resolveApplicationCommandLocale(["pt-BR", "de-DE"], undefined, "fr");

        assert.equal(locale, "fr");
    });
});
