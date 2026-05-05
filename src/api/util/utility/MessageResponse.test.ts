import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("messageToResponse", () => {
    test("signs attachment urls for API responses", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        const { messageToResponse } = await import("./MessageResponse.js");

        const message = {
            withSignedAttachments(data: { ip: string; userAgent: string }) {
                return {
                    attachments: [
                        {
                            url: `https://cdn.example/attachments/file.png?ex=123&is=${data.ip}&hm=abc`,
                            proxy_url: `https://cdn.example/attachments/file.png?ex=123&is=${data.userAgent}&hm=abc`,
                        },
                    ],
                };
            },
        };

        const req = {
            ip: "203.0.113.10",
            headers: {
                "user-agent": "test-agent",
            },
        };

        const response = messageToResponse(message as never, req as never);

        assert.ok(response.attachments);
        assert.equal(response.attachments[0].url.includes("hm="), true);
        assert.equal(response.attachments[0].proxy_url.includes("hm="), true);
    });
});
