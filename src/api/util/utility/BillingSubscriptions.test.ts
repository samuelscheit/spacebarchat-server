import { describe, test } from "node:test";
import assert from "node:assert";
import type { Response } from "express";
import { listBillingSubscriptions, sendBillingSubscriptionsResponse } from "./BillingSubscriptions";

describe("BillingSubscriptions", () => {
    test("lists no active billing subscriptions until a billing provider/model exists", () => {
        assert.deepStrictEqual(listBillingSubscriptions(), []);
    });

    test("sends an explicit empty subscriptions response", () => {
        const calls: unknown[] = [];
        const res = {
            status(code: number) {
                calls.push(["status", code]);
                return this;
            },
            json(body: unknown) {
                calls.push(["json", body]);
                return this;
            },
        } as Response;

        sendBillingSubscriptionsResponse(res);

        assert.deepStrictEqual(calls, [
            ["status", 200],
            ["json", []],
        ]);
    });
});
