import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { Config } from "../util";
import { Channel } from "./Channel";
import { Recipient } from "./Recipient";

const originalConfigGet = Config.get;
const originalRecipientFind = Recipient.find;

afterEach(() => {
    Config.get = originalConfigGet;
    Recipient.find = originalRecipientFind;
});

function installRecipientLimit(maxRecipients: number) {
    Config.get = () =>
        ({
            limits: {
                channel: {
                    maxRecipients,
                },
            },
        }) as ReturnType<typeof Config.get>;
}

describe("Channel.createDMChannel recipient limits", () => {
    test("rejects requests above the configured non-creator recipient limit before database work", async () => {
        installRecipientLimit(2);
        let recipientFindCalled = false;
        Recipient.find = async () => {
            recipientFindCalled = true;
            throw new Error("Recipient.find should not run for over-limit DM creation");
        };

        await assert.rejects(
            () => Channel.createDMChannel(["friend-a", "friend-b", "friend-c"], "creator"),
            (error) => error instanceof Error && "code" in error && error.code === 30004 && /Maximum number of recipients reached \(2\)/.test(error.message),
        );
        assert.equal(recipientFindCalled, false);
    });

    test("applies the limit after deduplicating recipients and removing the creator", async () => {
        installRecipientLimit(2);
        let recipientFindCalled = false;
        Recipient.find = async () => {
            recipientFindCalled = true;
            throw new Error("limit accepted");
        };

        await assert.rejects(() => Channel.createDMChannel(["creator", "friend-a", "friend-a", "friend-b"], "creator"), /limit accepted/);
        assert.equal(recipientFindCalled, true);
    });
});

describe("group DM add-recipient route recipient limits", () => {
    test("checks the configured recipient limit before mutating an existing group DM", () => {
        const routeSource = fs.readFileSync(path.join(__dirname, "../../api/routes/channels/#channel_id/recipients.js"), "utf-8");

        assert.match(routeSource, /Config\.get\(\)\.limits\.channel/);
        assert.match(routeSource, /MAXIMUM_NUMBER_OF_RECIPIENTS_REACHED\.withParams\(maxRecipients\)/);
        assertBefore(routeSource, "MAXIMUM_NUMBER_OF_RECIPIENTS_REACHED.withParams(maxRecipients)", "channel.recipients?.push");
    });
});

function assertBefore(source: string, first: string, second: string) {
    const firstIndex = source.indexOf(first);
    const secondIndex = source.indexOf(second);

    assert.notEqual(firstIndex, -1, `${first} should be present`);
    assert.notEqual(secondIndex, -1, `${second} should be present`);
    assert.ok(firstIndex < secondIndex, `${first} should appear before ${second}`);
}
