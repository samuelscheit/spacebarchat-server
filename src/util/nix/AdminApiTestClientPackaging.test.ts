import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const repoRoot = process.cwd();
const testClientProjectPath = path.join(repoRoot, "extra/admin-api/Utilities/Spacebar.AdminApi.TestClient/Spacebar.AdminApi.TestClient.csproj");
const testClientDepsPath = path.join(repoRoot, "extra/admin-api/Utilities/Spacebar.AdminApi.TestClient/deps.json");
const adminApiOutputsPath = path.join(repoRoot, "extra/admin-api/outputs.nix");

const readText = (filePath: string) => readFileSync(filePath, "utf8");

const getElement = (xml: string, elementName: string, include: string) => {
    const escapedInclude = include.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`<${elementName}\\s+[^>]*Include="${escapedInclude}"[^>]*/>`);
    const match = xml.match(regex);

    assert(match, `Expected ${elementName} for ${include}`);

    return match[0];
};

const assertAttribute = (element: string, attribute: string, expected: string) => {
    assert.match(element, new RegExp(`${attribute}="${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
};

describe("Admin API TestClient Nix packaging", () => {
    test("uses CI package references instead of unreachable project references", () => {
        const project = readText(testClientProjectPath);

        for (const model of ["Spacebar.Models.AdminApi", "Spacebar.Models.Config"]) {
            const projectReference = getElement(project, "ProjectReference", `..\\..\\Models\\${model}\\${model}.csproj`);
            assertAttribute(projectReference, "Condition", "'$(ContinuousIntegrationBuild)'!='true'");

            const packageReference = getElement(project, "PackageReference", model);
            assertAttribute(packageReference, "Version", "*-preview*");
            assertAttribute(packageReference, "Condition", "'$(ContinuousIntegrationBuild)'=='true'");
        }
    });

    test("locks the SDK-pinned browser-wasm packages required by offline Nix restore and publish", () => {
        const deps = JSON.parse(readText(testClientDepsPath)) as Array<{ pname?: string; version?: string; hash?: string }>;

        for (const expected of [
            {
                pname: "Microsoft.DotNet.HotReload.WebAssembly.Browser",
                version: "10.0.201",
                hash: "sha256-z1QpaipEn/QcWvTiuNB1KnuurPVrQKHwUbizQ0hEx4E=",
            },
            {
                pname: "Microsoft.NET.Sdk.WebAssembly.Pack",
                version: "10.0.5",
                hash: "sha256-gwneB/pH5T80p0YW+XbMkep4BmZ+ycKEISol+fR2rGw=",
            },
            {
                pname: "Microsoft.NETCore.App.Runtime.Mono.browser-wasm",
                version: "10.0.5",
                hash: "sha256-bkErTmR5f6Kxd0g8gkQnPBVTNPfuuKUKEwB53E5Ec18=",
            },
        ]) {
            assert.deepEqual(
                deps.find((dep) => dep.pname === expected.pname && dep.version === expected.version),
                expected,
            );
        }
    });

    test("keeps the Nix package wired for Blazor WebAssembly and model package inputs", () => {
        const outputs = readText(adminApiOutputsPath);
        const packageBlockMatch = outputs.match(/Spacebar-AdminApi-TestClient = buildSpacebarDotnetModule \{[\s\S]*?\n {8}\};/);

        assert(packageBlockMatch, "Expected Spacebar-AdminApi-TestClient package block in outputs.nix");

        const packageBlock = packageBlockMatch[0];
        assert.match(packageBlock, /runtimeId = "browser-wasm";/);
        assert.match(packageBlock, /useAppHost = false;/);
        assert.match(packageBlock, /dontBuild = true;/);
        assert.match(packageBlock, /dontDotnetBuild = true;/);
        assert.match(packageBlock, /dontDotnetFixup = true;/);
        assert.match(packageBlock, /srcRoot = Utilities\/Spacebar\.AdminApi\.TestClient;/);
        assert.match(packageBlock, /projectReferences = \[[\s\S]*proj\.Spacebar-Models-AdminApi[\s\S]*proj\.Spacebar-Models-Config[\s\S]*\];/);
    });

    test("publishes the static Blazor assets in one MSBuild graph", () => {
        const outputs = readText(adminApiOutputsPath);
        const packageBlockMatch = outputs.match(/Spacebar-AdminApi-TestClient = buildSpacebarDotnetModule \{[\s\S]*?\n {8}\};/);

        assert(packageBlockMatch, "Expected Spacebar-AdminApi-TestClient package block in outputs.nix");

        const packageBlock = packageBlockMatch[0];
        const installPhaseMatch = packageBlock.match(/installPhase = ''([\s\S]*?)\n {10}'';/);

        assert(installPhaseMatch, "Expected custom installPhase in Spacebar-AdminApi-TestClient package block");

        const installPhase = installPhaseMatch[1];
        assert.match(installPhase, /runHook preInstall[\s\S]*runHook postInstall/);
        assert.match(installPhase, /dotnet publish Spacebar\.AdminApi\.TestClient\.csproj[\s\S]*--runtime browser-wasm[\s\S]*--no-restore/);
        assert.doesNotMatch(installPhase, /--no-build/);
        assert.match(installPhase, /--output "\$out\/lib\/Spacebar\.AdminApi\.TestClient"/);
        assert.match(installPhase, /cp -r \$out\/lib\/Spacebar\.AdminApi\.TestClient\/wwwroot\/\. \$out\/share\/spacebar-admin-ui\//);
        assert.doesNotMatch(packageBlock, /postInstall =/);
    });
});
