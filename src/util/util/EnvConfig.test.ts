import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { applyEnvConfigOverrides } from "./EnvConfig";

const execFileAsync = promisify(execFile);

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

describe("Config.init environment overrides", () => {
    it("uses SPACEBAR_CONFIG env vars before final startup config validation", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-config-init-env-test-"));
        const configPath = path.join(dir, "config.json");

        try {
            await fs.writeFile(configPath, "{}\n");

            const env = { ...process.env };
            for (const name of Object.keys(env)) {
                if (name.startsWith("SPACEBAR_CONFIG__")) delete env[name];
            }

            for (const name of [
                "CONFIG_PATH",
                "CONFIG_READONLY",
                "CONFIG_SOURCE",
                "CDN_SIGNATURE_PATH",
                "LEGACY_JWT_SECRET_PATH",
                "MAILJET_API_KEY_PATH",
                "MAILJET_API_SECRET_PATH",
                "SMTP_PASSWORD_PATH",
                "GIF_API_KEY_PATH",
                "DISCORD_ATTACHMENT_REFRESH_BOT_TOKEN_PATH",
                "RABBITMQ_HOST",
                "RABBITMQ_HOST_PATH",
                "ABUSEIPDB_API_KEY_PATH",
                "CAPTCHA_SECRET_KEY_PATH",
                "CAPTCHA_SITE_KEY_PATH",
                "IPDATA_API_KEY_PATH",
                "REQUEST_SIGNATURE_PATH",
            ]) {
                delete env[name];
            }

            Object.assign(env, {
                CONFIG_PATH: configPath,
                CONFIG_READONLY: "1",
                DATABASE: "postgres://spacebar:spacebar@localhost:5432/spacebar",
                SPACEBAR_CONFIG__GENERAL__SERVER_NAME: "spacebar.local",
                SPACEBAR_CONFIG__API__ENDPOINT_PUBLIC: "http://localhost:3001/api/v9",
                SPACEBAR_CONFIG__CDN__ENDPOINT_PUBLIC: "http://localhost:3003/",
                SPACEBAR_CONFIG__CDN__ENDPOINT_PRIVATE: "http://localhost:3003/",
                SPACEBAR_CONFIG__GATEWAY__ENDPOINT_PUBLIC: "ws://localhost:3002/",
            });

            const script = `
                const { Config } = require(${JSON.stringify(path.join(__dirname, "Config.js"))});

                (async () => {
                    const config = await Config.init(true);
                    console.log("CONFIG_INIT_RESULT " + JSON.stringify({
                        generalServerName: config.general.serverName,
                        apiEndpointPublic: config.api.endpointPublic,
                        cdnEndpointPublic: config.cdn.endpointPublic,
                        cdnEndpointPrivate: config.cdn.endpointPrivate,
                        gatewayEndpointPublic: config.gateway.endpointPublic,
                    }));
                })().catch((error) => {
                    console.error(error?.stack ?? error);
                    process.exit(1);
                });
            `;

            const { stdout } = await execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
                cwd: path.resolve(__dirname, "../../.."),
                env,
                maxBuffer: 1024 * 1024,
            });

            const resultLine = stdout
                .trim()
                .split(/\r?\n/)
                .find((line) => line.startsWith("CONFIG_INIT_RESULT "));
            assert.ok(resultLine, stdout);
            assert.deepEqual(JSON.parse(resultLine.slice("CONFIG_INIT_RESULT ".length)), {
                generalServerName: "spacebar.local",
                apiEndpointPublic: "http://localhost:3001/api/v9",
                cdnEndpointPublic: "http://localhost:3003/",
                cdnEndpointPrivate: "http://localhost:3003/",
                gatewayEndpointPublic: "ws://localhost:3002/",
            });
        } finally {
            await fs.rm(dir, { force: true, recursive: true });
        }
    });
});
