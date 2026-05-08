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
    getApplicationCommandLocalizedFields,
    getApplicationCommandLocalizedText,
    normalizeApplicationCommandName,
    resolveApplicationCommandLocale,
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
});

describe("application command localization helpers", () => {
    test("returns the localized command text for the requested locale", () => {
        assert.equal(getApplicationCommandLocalizedText({ de: "spielen", "en-US": "play" }, "de"), "spielen");
    });

    test("returns undefined when no localizations are stored", () => {
        assert.equal(getApplicationCommandLocalizedText(undefined, "de"), undefined);
        assert.equal(getApplicationCommandLocalizedText(null, "de"), undefined);
    });

    test("returns undefined when the requested locale has no localization", () => {
        assert.equal(getApplicationCommandLocalizedText({ "en-US": "play" }, "de"), undefined);
        assert.equal(getApplicationCommandLocalizedText({ de: "spielen" }, undefined), undefined);
    });

    test("normalizes locales, applies documented locale fallbacks, and handles language-region headers", () => {
        assert.equal(getApplicationCommandLocalizedText({ "en-GB": "colour" }, "en-US"), "colour");
        assert.equal(getApplicationCommandLocalizedText({ "en-US": "color" }, "en_GB"), "color");
        assert.equal(getApplicationCommandLocalizedText({ "es-ES": "jugar" }, "es-419"), "jugar");
        assert.equal(getApplicationCommandLocalizedText({ de: "spielen" }, "de-DE"), "spielen");
    });

    test("resolves locale from Discord locale, Accept-Language, then user settings", () => {
        assert.equal(
            resolveApplicationCommandLocale({
                discordLocale: "de",
                acceptLanguage: "fr;q=1",
                userSettingsLocale: "en-US",
            }),
            "de",
        );
        assert.equal(
            resolveApplicationCommandLocale({
                acceptLanguage: "de;q=0, fr;q=0.4, es-ES;q=0.9",
                userSettingsLocale: "en-US",
            }),
            "es-ES",
        );
        assert.equal(resolveApplicationCommandLocale({ userSettingsLocale: "en_US" }), "en-US");
    });

    test("builds localized command fields and omits unavailable localized values", () => {
        assert.deepEqual(
            getApplicationCommandLocalizedFields(
                {
                    name_localizations: { de: "spielen" },
                    description_localizations: { de: "Starte ein Spiel" },
                },
                "de",
            ),
            {
                name_localized: "spielen",
                description_localized: "Starte ein Spiel",
            },
        );

        const missingFields = getApplicationCommandLocalizedFields(
            {
                name_localizations: { "en-US": "play" },
                description_localizations: { "en-US": "Start a game" },
            },
            "de",
        );
        assert.deepEqual(missingFields, {});
        assert.equal("name_localized" in missingFields, false);
        assert.equal("description_localized" in missingFields, false);
        assert.equal(JSON.stringify({ name: "play", ...missingFields }), '{"name":"play"}');
    });
});
