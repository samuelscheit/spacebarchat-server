import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import * as ts from "typescript";

type TypedResponsesImport = {
    isTypeOnly: boolean;
    moduleSpecifier: string;
    names: string[];
};

const typedResponsesPath = path.join(process.cwd(), "src", "schemas", "responses", "TypedResponses.ts");

function readTypedResponsesImports(): TypedResponsesImport[] {
    const sourceText = readFileSync(typedResponsesPath, "utf8");
    const sourceFile = ts.createSourceFile(typedResponsesPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    return sourceFile.statements.filter(ts.isImportDeclaration).map((declaration) => {
        const { importClause } = declaration;
        const { moduleSpecifier } = declaration;

        assert.ok(ts.isStringLiteral(moduleSpecifier), "Expected TypedResponses imports to use string module specifiers");
        assert.ok(importClause, `TypedResponses must not side-effect import ${moduleSpecifier.text}`);

        const names: string[] = [];
        if (importClause.name) names.push(importClause.name.text);
        const { namedBindings } = importClause;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
            names.push(...namedBindings.elements.map((element) => element.name.text));
        }

        return {
            isTypeOnly: importClause.phaseModifier === ts.SyntaxKind.TypeKeyword,
            moduleSpecifier: moduleSpecifier.text,
            names,
        };
    });
}

function moduleSpecifiersFor(imports: TypedResponsesImport[], importName: string) {
    return imports.filter(({ names }) => names.includes(importName)).map(({ moduleSpecifier }) => moduleSpecifier);
}

describe("TypedResponses imports", () => {
    test("uses type-only imports because the file exports type aliases only", () => {
        const imports = readTypedResponsesImports();

        assert.ok(imports.length > 0, "Expected TypedResponses to import response source types");
        for (const responseImport of imports) {
            assert.equal(responseImport.isTypeOnly, true, `${responseImport.moduleSpecifier} must be imported with import type`);
        }
    });

    test("imports util-owned response types from the public util barrel only", () => {
        const imports = readTypedResponsesImports();
        const utilResponseTypes = [
            "Application",
            "BackupCode",
            "Categories",
            "Channel",
            "DmChannelDTO",
            "GeneralConfiguration",
            "Guild",
            "Invite",
            "LimitsConfiguration",
            "Member",
            "Role",
            "Template",
        ];

        for (const responseImport of imports) {
            assert.doesNotMatch(responseImport.moduleSpecifier, /^@spacebar\/util\//, `${responseImport.moduleSpecifier} bypasses the public util barrel`);
            assert.doesNotMatch(responseImport.moduleSpecifier, /^\.\.?\/(?:.*\/)?util(?:\/|$)/, `${responseImport.moduleSpecifier} uses a relative util import`);
        }

        for (const importName of utilResponseTypes) {
            assert.deepEqual(moduleSpecifiersFor(imports, importName), ["@spacebar/util"], `${importName} must come from @spacebar/util`);
        }
    });

    test("imports schema-owned response types from the public schemas barrel", () => {
        const imports = readTypedResponsesImports();
        const schemaResponseTypes = ["APIWebhook", "GuildCreateResponse", "GuildVoiceRegion", "PrivateUser", "PublicMember", "PublicMessage", "PublicUser"];

        for (const importName of schemaResponseTypes) {
            assert.deepEqual(moduleSpecifiersFor(imports, importName), ["@spacebar/schemas"], `${importName} must come from @spacebar/schemas`);
        }
    });
});
