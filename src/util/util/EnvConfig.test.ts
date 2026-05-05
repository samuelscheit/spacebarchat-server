import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEnvConfigOverrides } from "./EnvConfig";

describe("applyEnvConfigOverrides", () => {
    it("applies nested config values from SPACEBAR_CONFIG env vars", async () => {
        const config = {
            api: {
                endpointPublic: null as string | null,
                activeVersions: ["9"],
            },
            security: {
                cdnSignUrls: false,
            },
        };

        await applyEnvConfigOverrides(config, {
            SPACEBAR_CONFIG__API__ENDPOINT_PUBLIC: "http://localhost:3001/api/v9",
            SPACEBAR_CONFIG__API__ACTIVE_VERSIONS: '["9","10"]',
            SPACEBAR_CONFIG__SECURITY__CDN_SIGN_URLS: "true",
        });

        assert.deepEqual(config, {
            api: {
                endpointPublic: "http://localhost:3001/api/v9",
                activeVersions: ["9", "10"],
            },
            security: {
                cdnSignUrls: true,
            },
        });
    });

    it("keeps string values when they are not JSON", async () => {
        const config = {
            general: {
                serverName: null as string | null,
            },
        };

        await applyEnvConfigOverrides(config, {
            SPACEBAR_CONFIG__GENERAL__SERVER_NAME: "spacebar.local",
        });

        assert.equal(config.general.serverName, "spacebar.local");
    });

    it("reads secret file values with _PATH overrides", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-env-config-test-"));
        const secretPath = path.join(dir, "request-signature");
        await fs.writeFile(secretPath, "secret-value\n");

        try {
            const config = {
                security: {
                    requestSignature: "",
                },
            };

            await applyEnvConfigOverrides(config, {
                SPACEBAR_CONFIG__SECURITY__REQUEST_SIGNATURE_PATH: secretPath,
            });

            assert.equal(config.security.requestSignature, "secret-value");
        } finally {
            await fs.rm(dir, { force: true, recursive: true });
        }
    });

    it("rejects unknown config paths", async () => {
        await assert.rejects(
            () =>
                applyEnvConfigOverrides(
                    {},
                    {
                        SPACEBAR_CONFIG__EXPERIMENTAL__FEATURE_ENABLED: "true",
                    },
                ),
            /Unknown environment override path/,
        );
    });

    it("rejects prototype pollution paths", async () => {
        await assert.rejects(
            () =>
                applyEnvConfigOverrides(
                    {},
                    {
                        SPACEBAR_CONFIG__constructor__polluted: "true",
                    },
                ),
            /Refusing unsafe environment override path/,
        );
    });
});
