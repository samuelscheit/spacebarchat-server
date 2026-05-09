import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;

function compileSchema(name: string) {
    return new Ajv({ strict: false, validateFormats: false }).compile({
        ...(schemas[name] as Record<string, unknown>),
        definitions: {
            ...schemas,
            "Record<string,boolean>": {
                type: "object",
                additionalProperties: { type: "boolean" },
            },
        },
    });
}

function localizedOptionCommand() {
    return {
        name: "birthday",
        description: "Wish a friend a happy birthday",
        options: [
            {
                type: 3,
                name: "age",
                name_localizations: { "pt-BR": "idade" },
                description: "Your friend's age",
                description_localizations: { "pt-BR": "A idade do seu amigo" },
                choices: [{ name: "young", name_localizations: { "pt-BR": "jovem" }, value: "young" }],
            },
        ],
    };
}

describe("ApplicationCommandSchema", () => {
    test("accepts option localization dictionaries in create payloads", () => {
        const validate = compileSchema("ApplicationCommandCreateSchema");
        const command = localizedOptionCommand();

        assert.equal(validate(command), true, JSON.stringify(validate.errors));
    });

    test("rejects localized output fields in create payload options", () => {
        const validate = compileSchema("ApplicationCommandCreateSchema");
        const command = localizedOptionCommand();
        const invalidCommand = {
            ...command,
            options: [{ ...command.options[0], name_localized: "idade" }],
        };

        assert.equal(validate(invalidCommand), false);
    });

    test("accepts localized output fields in command responses", () => {
        const validate = compileSchema("ApplicationCommandSchema");
        const command = localizedOptionCommand();

        assert.equal(
            validate({
                ...command,
                id: "100000000000000003",
                application_id: "100000000000000001",
                default_member_permissions: null,
                version: "100000000000000002",
                name_localized: "aniversario",
                description_localized: "Deseje feliz aniversario",
                options: [
                    {
                        ...command.options[0],
                        name_localized: "idade",
                        description_localized: "A idade do seu amigo",
                        choices: [{ ...command.options[0].choices[0], name_localized: "jovem" }],
                    },
                ],
            }),
            true,
            JSON.stringify(validate.errors),
        );
    });
});
