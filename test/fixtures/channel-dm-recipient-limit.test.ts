import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { afterEach, describe, test } from "node:test";
import express from "express";
import {
    assertCanAddGroupDmRecipient,
    assertDmRecipientLimit,
    Channel,
    ChannelLimits,
    Config,
    countGroupDmRecipientsExcludingOwner,
    normalizeDmRecipientIdsForLimit,
    Recipient,
    User,
} from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";

const originalConfigGet = Config.get;
const originalRecipientFind = Recipient.find;
const originalUserFind = User.find;

afterEach(() => {
    Config.get = originalConfigGet;
    Recipient.find = originalRecipientFind;
    User.find = originalUserFind;
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

describe("DM recipient limit helpers", () => {
    test("defaults the non-creator DM recipient limit to Discord's 10-recipient ceiling", () => {
        assert.equal(new ChannelLimits().maxRecipients, 10);
    });

    test("deduplicates recipient ids and excludes the creator before limit checks", () => {
        assert.deepEqual(normalizeDmRecipientIdsForLimit(["creator", "friend-a", "friend-a", "friend-b"], "creator"), ["friend-a", "friend-b"]);
    });

    test("throws the Discord recipient-limit API error with the configured limit", () => {
        installRecipientLimit(2);

        assert.doesNotThrow(() => assertDmRecipientLimit(2));
        assert.throws(
            () => assertDmRecipientLimit(3),
            (error) => error instanceof Error && "code" in error && error.code === 30004 && /Maximum number of recipients reached \(2\)/.test(error.message),
        );
    });

    test("checks existing group-DM recipients excluding the owner before adding a new recipient", () => {
        installRecipientLimit(2);

        assert.equal(countGroupDmRecipientsExcludingOwner([{ user_id: "owner" }, { user_id: "friend-a" }, { user_id: "friend-a" }], "owner"), 1);
        assert.doesNotThrow(() => assertCanAddGroupDmRecipient([{ user_id: "owner" }, { user_id: "friend-a" }], "owner"));
        assert.throws(
            () => assertCanAddGroupDmRecipient([{ user_id: "owner" }, { user_id: "friend-a" }, { user_id: "friend-b" }], "owner"),
            (error) => error instanceof Error && "code" in error && error.code === 30004 && /Maximum number of recipients reached \(2\)/.test(error.message),
        );
    });

    test("treats stale or missing group-DM owners as unavailable for recipient-count exclusions", () => {
        installRecipientLimit(2);

        const recipients = [{ user_id: "friend-a" }, { user_id: "friend-b" }];

        assert.equal(countGroupDmRecipientsExcludingOwner(recipients, "missing-owner"), 2);
        assert.equal(countGroupDmRecipientsExcludingOwner(recipients), 2);
        assert.throws(
            () => assertCanAddGroupDmRecipient(recipients, "missing-owner"),
            (error) => error instanceof Error && "code" in error && error.code === 30004 && /Maximum number of recipients reached \(2\)/.test(error.message),
        );
    });
});

describe("Channel.createDMChannel recipient limits", () => {
    test("rejects requests above the configured non-creator recipient limit before database work", async () => {
        installRecipientLimit(2);
        let recipientFindCalled = false;
        let userFindCalled = false;
        User.find = (async () => {
            userFindCalled = true;
            throw new Error("User.find should not run for over-limit DM creation");
        }) as typeof User.find;
        Recipient.find = async () => {
            recipientFindCalled = true;
            throw new Error("Recipient.find should not run for over-limit DM creation");
        };

        await assert.rejects(
            () => Channel.createDMChannel(["friend-a", "friend-b", "friend-c"], "creator"),
            (error) => error instanceof Error && "code" in error && error.code === 30004 && /Maximum number of recipients reached \(2\)/.test(error.message),
        );
        assert.equal(userFindCalled, false);
        assert.equal(recipientFindCalled, false);
    });

    test("applies the limit after deduplicating recipients and removing the creator", async () => {
        installRecipientLimit(2);
        let recipientFindCalled = false;
        User.find = (async () => [{ id: "friend-a" }, { id: "friend-b" }] as User[]) as typeof User.find;
        Recipient.find = async () => {
            recipientFindCalled = true;
            throw new Error("limit accepted");
        };

        await assert.rejects(() => Channel.createDMChannel(["creator", "friend-a", "friend-a", "friend-b"], "creator"), /limit accepted/);
        assert.equal(recipientFindCalled, true);
    });
});

describe("group DM add-recipient route recipient limits", () => {
    test("rejects over-limit group DMs before mutating recipients or emitting events", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";
        installRecipientLimit(2);

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const eventUtil = require("@spacebar/util/util/Event") as typeof import("@spacebar/util/util/Event");
        const routeModulePath = require.resolve("@spacebar/api/routes/channels/#channel_id/recipients");
        delete require.cache[routeModulePath];

        let recipientCreateCalled = false;
        let channelSaveCalled = false;
        let emitEventCalled = false;

        t.mock.method(util.Channel, "findOneOrFail", async () => ({
            id: "group-dm-id",
            type: ChannelType.GROUP_DM,
            owner_id: "owner-id",
            recipients: [{ user_id: "owner-id" }, { user_id: "friend-a" }, { user_id: "friend-b" }],
            async save() {
                channelSaveCalled = true;
                throw new Error("channel.save should not run for over-limit group DMs");
            },
        }));
        t.mock.method(util.Recipient, "create", () => {
            recipientCreateCalled = true;
            throw new Error("Recipient.create should not run for over-limit group DMs");
        });
        t.mock.method(eventUtil, "emitEvent", async () => {
            emitEventCalled = true;
            throw new Error("emitEvent should not run for over-limit group DMs");
        });

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = createRecipientsRouteApp(router);
            const response = await requestJson(app, "/channels/group-dm-id/recipients/new-friend", { method: "PUT" });

            assert.equal(response.status, 400);
            assert.deepEqual(response.body, {
                code: 30004,
                message: "Maximum number of recipients reached (2)",
            });
            assert.equal(recipientCreateCalled, false);
            assert.equal(channelSaveCalled, false);
            assert.equal(emitEventCalled, false);
        } finally {
            delete require.cache[routeModulePath];
        }
    });
});

function createRecipientsRouteApp(router: express.Router) {
    const app = express();
    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = "owner-id";
        next();
    });
    app.use("/channels/:channel_id/recipients", router);
    app.use((error: { code?: number; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });
    return app;
}

async function requestJson(app: express.Express, path: string, options: { method?: string } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method ?? "GET",
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}
