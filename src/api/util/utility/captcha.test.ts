import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { Config } from "@spacebar/util";
import { verifyCaptcha } from "./captcha";

const originalFetch = globalThis.fetch;
const originalConfigGet = Config.get;

type CaptchaService = "recaptcha" | "hcaptcha";

function configureCaptcha(service: CaptchaService | string | null) {
    Config.get = (() => ({
        security: {
            captcha: {
                enabled: true,
                service,
                sitekey: service ? `${service}-sitekey` : null,
                secret: service ? `${service}-secret` : null,
            },
        },
    })) as typeof Config.get;
}

describe("verifyCaptcha", () => {
    afterEach(() => {
        globalThis.fetch = originalFetch;
        Config.get = originalConfigGet;
    });

    for (const [service, expectedUrl] of [
        ["recaptcha", "https://www.google.com/recaptcha/api/siteverify"],
        ["hcaptcha", "https://hcaptcha.com/siteverify"],
    ] as const) {
        test(`posts ${service} challenges to the configured verification endpoint`, async () => {
            configureCaptcha(service);
            const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
            globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
                calls.push({ url: String(url), init });
                return new Response(JSON.stringify({ success: true }), {
                    headers: { "Content-Type": "application/json" },
                });
            }) as typeof fetch;

            const result = await verifyCaptcha("response token", "203.0.113.7");

            assert.deepEqual(result, { success: true });
            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, expectedUrl);
            assert.equal(calls[0].init?.method, "POST");
            assert.equal((calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/x-www-form-urlencoded");
            const body = new URLSearchParams(calls[0].init?.body as string);
            assert.equal(body.get("response"), "response token");
            assert.equal(body.get("secret"), `${service}-secret`);
            assert.equal(body.get("sitekey"), `${service}-sitekey`);
            assert.equal(body.get("remoteip"), "203.0.113.7");
        });
    }

    test("rejects enabled CAPTCHA without a configured service, secret, and sitekey", async () => {
        configureCaptcha(null);

        await assert.rejects(() => verifyCaptcha("response token"), /CAPTCHA is not configured correctly/);
    });

    test("rejects unsupported CAPTCHA services before making a verification request", async () => {
        configureCaptcha("turnstile");
        let fetchCalled = false;
        globalThis.fetch = (async () => {
            fetchCalled = true;
            return new Response(JSON.stringify({ success: true }));
        }) as typeof fetch;

        await assert.rejects(() => verifyCaptcha("response token"), /CAPTCHA is not configured correctly/);

        assert.equal(fetchCalled, false);
    });
});
