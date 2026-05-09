import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, mock, test } from "node:test";
import { Config } from "@spacebar/util";
import express, { type NextFunction, type Request, type Response } from "express";
import registerRouter from "../../src/api/routes/auth/register";

afterEach(() => {
    mock.restoreAll();
});

describe("POST /auth/register password policy", () => {
    test("rejects configured blocklisted passwords before user creation", async () => {
        mock.method(Config, "get", createRegistrationConfig);

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.t = ((key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key) as Request["t"];
            next();
        });
        app.use("/auth/register", registerRouter);
        app.use((error: { code?: number | string; message?: string; errors?: unknown }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.code === 50035 ? 400 : 500).json({
                code: error.code,
                message: error.message,
                errors: error.errors,
            });
        });

        const server = app.listen(0);
        await once(server, "listening");

        try {
            const { port } = server.address() as AddressInfo;
            const response = await fetch(`http://127.0.0.1:${port}/auth/register`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "blocked-password-user",
                    password: "Password123!",
                    consent: true,
                    fingerprint: "blocked-password-fingerprint",
                }),
            });

            assert.equal(response.status, 400);
            assert.deepEqual(await response.json(), {
                code: 50035,
                message: "Invalid Form Body",
                errors: {
                    password: {
                        _errors: [
                            {
                                code: "PASSWORD_REQUIREMENTS_BLOCKLIST",
                                message: "This password is too common. Please choose a different password.",
                            },
                        ],
                    },
                },
            });
        } finally {
            server.close();
            await once(server, "close");
        }
    });
});

function createRegistrationConfig() {
    return {
        register: {
            allowNewRegistration: true,
            disabled: false,
            requireCaptcha: false,
            allowMultipleAccounts: true,
            enableAbuseIpDb: false,
            enableIpData: false,
            email: { required: false },
            dateOfBirth: { required: false, minimum: 13 },
            password: {
                required: true,
                minLength: 8,
                minNumbers: 2,
                minUpperCase: 1,
                minSymbols: 1,
                blocklist: [" password123! "],
            },
        },
        security: {
            captcha: {
                enabled: false,
            },
        },
    } as ReturnType<typeof Config.get>;
}
