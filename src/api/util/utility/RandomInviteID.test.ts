process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { DiscordApiErrors } = require("@spacebar/util") as typeof import("@spacebar/util");
const { INVITE_CODE_LENGTH, generateUnusedInviteCode, randomString } = require("./RandomInviteID") as typeof import("./RandomInviteID");

describe("randomString", () => {
    test("returns the requested number of base62 characters", () => {
        const value = randomString(64);

        assert.equal(value.length, 64);
        assert.match(value, /^[A-Za-z0-9]+$/);
    });

    test("rejects non-positive or unsafe lengths", () => {
        for (const length of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
            assert.throws(() => randomString(length), RangeError);
        }
    });
});

describe("generateUnusedInviteCode", () => {
    test("generates an unused base62 invite code with the default invite length", async () => {
        const code = await generateUnusedInviteCode({
            inviteRepository: {
                findOne: async () => undefined,
            },
        });

        assert.equal(code.length, INVITE_CODE_LENGTH);
        assert.match(code, /^[A-Za-z0-9]+$/);
    });

    test("retries generated invite code collisions", async () => {
        const generatedCodes = ["taken", "fresh"];
        const lookedUpCodes: string[] = [];

        const code = await generateUnusedInviteCode({
            generateCode: () => generatedCodes.shift()!,
            inviteRepository: {
                findOne: async ({ where }) => {
                    lookedUpCodes.push(where.code);
                    return where.code === "taken" ? { code: "taken" } : undefined;
                },
            },
        });

        assert.equal(code, "fresh");
        assert.deepEqual(lookedUpCodes, ["taken", "fresh"]);
    });

    test("rejects invalid generated invite codes before checking storage", async () => {
        await assert.rejects(
            () =>
                generateUnusedInviteCode({
                    generateCode: () => "bad code",
                    inviteRepository: {
                        findOne: async () => {
                            throw new Error("invalid codes should not query storage");
                        },
                    },
                }),
            (error) => (error as { code?: number }).code === DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE.code,
        );
    });

    test("rejects generated invite codes after exhausting collision retries", async () => {
        await assert.rejects(
            () =>
                generateUnusedInviteCode({
                    attempts: 2,
                    generateCode: () => "taken",
                    inviteRepository: {
                        findOne: async () => ({ code: "taken" }),
                    },
                }),
            (error) => (error as { code?: number }).code === DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE.code,
        );
    });
});
