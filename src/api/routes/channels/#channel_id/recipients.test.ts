import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { join } from "node:path";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

const DM_CHANNEL_TYPE = 1;
const GROUP_DM_CHANNEL_TYPE = 3;
const ROUTE_SOURCE_PATH = join(process.cwd(), "src/api/routes/channels/#channel_id/recipients.ts");

function loadUtil() {
    return require("@spacebar/util") as typeof import("../../../../util/index.js");
}

function readRouteSource() {
    return readFileSync(ROUTE_SOURCE_PATH, "utf8");
}

describe("group DM recipient route guards", () => {
    test("rejects adding an existing group DM recipient as invalid before lookup", async (t) => {
        const { loadAddableGroupDmRecipient } = await import("./recipients.js");
        const { DiscordApiErrors, User } = loadUtil();
        const originalFindOne = User.findOne;
        let userLookups = 0;

        t.after(() => {
            User.findOne = originalFindOne;
        });

        User.findOne = (async () => {
            userLookups++;
            return { toPublicUser: () => ({ id: "existing-user" }) };
        }) as typeof User.findOne;

        await assert.rejects(
            () =>
                loadAddableGroupDmRecipient(
                    {
                        recipients: [{ user_id: "existing-user" }],
                    },
                    "existing-user",
                ),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
        assert.equal(userLookups, 0);
    });

    test("rejects adding an unknown group DM recipient before persistence", async (t) => {
        const { putChannelRecipient } = await import("./recipients.js");
        const { Channel, DiscordApiErrors, Recipient, User } = loadUtil();
        const originalFindOneOrFail = Channel.findOneOrFail;
        const originalFindOne = User.findOne;
        const originalCreate = Recipient.create;
        let saved = false;
        let createdRecipient = false;
        const channel = {
            type: GROUP_DM_CHANNEL_TYPE,
            recipients: [{ user_id: "existing-user" }],
            save: async function () {
                saved = true;
                return this;
            },
        };

        t.after(() => {
            Channel.findOneOrFail = originalFindOneOrFail;
            User.findOne = originalFindOne;
            Recipient.create = originalCreate;
        });

        Channel.findOneOrFail = (async () => channel) as typeof Channel.findOneOrFail;
        User.findOne = (async () => null) as typeof User.findOne;
        Recipient.create = ((recipient: unknown) => {
            createdRecipient = true;
            return recipient;
        }) as typeof Recipient.create;

        await assert.rejects(
            () =>
                putChannelRecipient(
                    {
                        params: {
                            channel_id: "group-dm",
                            user_id: "missing-user",
                        },
                        user_id: "owner",
                    } as never,
                    {} as never,
                ),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
        assert.equal(saved, false);
        assert.equal(createdRecipient, false);
        assert.deepEqual(channel.recipients, [{ user_id: "existing-user" }]);
    });

    test("allows adding a user who exists and is not already in the group DM", async (t) => {
        const { loadAddableGroupDmRecipient } = await import("./recipients.js");
        const { User } = loadUtil();
        const originalFindOne = User.findOne;
        const loadedUser = {
            toPublicUser: () => ({ id: "new-user" }),
        };

        t.after(() => {
            User.findOne = originalFindOne;
        });

        User.findOne = (async () => loadedUser) as typeof User.findOne;

        const user = await loadAddableGroupDmRecipient(
            {
                recipients: [{ user_id: "existing-user" }],
            },
            "new-user",
        );

        assert.equal(user, loadedUser);
    });
});

describe("current user message request recipient route", () => {
    test("declares authenticated @me route metadata before the parameterized recipient routes", () => {
        const routeSource = readRouteSource();
        const deleteMeIndex = routeSource.indexOf('router.delete(\n    "/@me"');
        const deleteUserIndex = routeSource.indexOf('router.delete(\n    "/:user_id"');
        const putMeIndex = routeSource.indexOf('router.put(\n    "/@me"');
        const putUserIndex = routeSource.indexOf('router.put(\n    "/:user_id"');

        assert.ok(deleteMeIndex >= 0, "DELETE /@me route is missing");
        assert.ok(putMeIndex >= 0, "PUT /@me route is missing");
        assert.ok(deleteMeIndex < deleteUserIndex, "DELETE /@me must be registered before DELETE /:user_id");
        assert.ok(putMeIndex < putUserIndex, "PUT /@me must be registered before PUT /:user_id");

        assert.match(
            routeSource,
            /router\.delete\([\s\S]*"\/@me"[\s\S]*summary:\s*"Reject Message Request"[\s\S]*event:\s*\["CHANNEL_UPDATE", "MESSAGE_ACK", "CHANNEL_DELETE"\][\s\S]*401:\s*\{\s*body:\s*"APIErrorResponse"/,
        );
        assert.match(routeSource, /router\.patch\([\s\S]*"\/@me"[\s\S]*requestBody:\s*"ChannelRecipientMeUpdateSchema"[\s\S]*401:\s*\{\s*body:\s*"APIErrorResponse"/);
        assert.match(routeSource, /router\.put\([\s\S]*"\/@me"[\s\S]*requestBody:\s*"ChannelRecipientMeUpdateSchema"[\s\S]*401:\s*\{\s*body:\s*"APIErrorResponse"/);
    });

    test("rejects @me message request operations outside one-to-one DMs", async () => {
        const { updateCurrentUserMessageRequest } = await import("./recipients.js");
        const { DiscordApiErrors } = loadUtil();

        await assert.rejects(
            () =>
                updateCurrentUserMessageRequest(
                    {
                        id: "group-dm",
                        type: GROUP_DM_CHANNEL_TYPE,
                        recipients: [createTestRecipient("requester", true)],
                    },
                    "requester",
                    { consent_status: 2 },
                ),
            (error) => error === DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE,
        );
    });

    test("accepts only the documented ACCEPTED consent status for non-employee users", async () => {
        const { updateCurrentUserMessageRequest } = await import("./recipients.js");
        const { DiscordApiErrors } = loadUtil();

        await assert.rejects(
            () =>
                updateCurrentUserMessageRequest(
                    {
                        id: "dm",
                        type: DM_CHANNEL_TYPE,
                        recipients: [createTestRecipient("requester", true)],
                    },
                    "requester",
                    { consent_status: 3 },
                ),
            (error) => error === DiscordApiErrors.MISSING_PERMISSIONS,
        );
    });

    test("requires a pending closed current-user recipient before rejecting a message request", async () => {
        const { assertPendingMessageRequestRecipient } = await import("./recipients.js");
        const { DiscordApiErrors } = loadUtil();

        assert.doesNotThrow(() =>
            assertPendingMessageRequestRecipient(
                {
                    id: "dm",
                    type: DM_CHANNEL_TYPE,
                    recipients: [createTestRecipient("requester", true)],
                },
                "requester",
            ),
        );

        assert.throws(
            () =>
                assertPendingMessageRequestRecipient(
                    {
                        id: "dm",
                        type: DM_CHANNEL_TYPE,
                        recipients: [createTestRecipient("requester", false)],
                    },
                    "requester",
                ),
            (error) => error === DiscordApiErrors.MISSING_PERMISSIONS,
        );
    });

    test("routes DELETE, PATCH, and PUT /@me to the current-user message request handlers", async (t) => {
        const express = require("express") as typeof import("express");
        const routeModule = require("./recipients.js") as typeof import("./recipients.js");
        const { Channel, DmChannelDTO, events } = loadUtil();
        const originalFindOneOrFail = Channel.findOneOrFail;
        const originalCreateDMChannel = Channel.createDMChannel;
        const originalDtoFrom = DmChannelDTO.from;
        const originalEventEmit = events.emit;
        const emittedEvents: unknown[] = [];
        let channel = createMessageRequestChannel(true);

        t.after(() => {
            Channel.findOneOrFail = originalFindOneOrFail;
            Channel.createDMChannel = originalCreateDMChannel;
            DmChannelDTO.from = originalDtoFrom;
            events.emit = originalEventEmit;
        });

        Channel.findOneOrFail = (async () => channel) as typeof Channel.findOneOrFail;
        Channel.createDMChannel = (async () => assert.fail("PUT /@me must not fall through to PUT /:user_id")) as typeof Channel.createDMChannel;
        DmChannelDTO.from = (async (source: ReturnType<typeof createMessageRequestChannel>) => createDmChannelDto(source)) as unknown as typeof DmChannelDTO.from;
        events.emit = ((_routeId: string | symbol, event: unknown) => {
            emittedEvents.push(event);
            return true;
        }) as typeof events.emit;

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user_id = "requester";
            next();
        });
        app.use("/channels/:channel_id/recipients", routeModule.default);
        const server = await listen(app);

        t.after(() => {
            server.close();
        });

        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        channel = createMessageRequestChannel(true);
        emittedEvents.length = 0;
        const deleteResponse = await fetch(`${baseUrl}/channels/${channel.id}/recipients/@me`, { method: "DELETE" });
        assert.equal(deleteResponse.status, 200);
        const deleteBody = (await deleteResponse.json()) as { recipients: Array<{ id: string }> };
        assert.deepEqual(deleteBody.recipients, [{ id: "sender" }]);
        assert.deepEqual(
            emittedEvents.map((event) => (event as { event: string }).event),
            ["CHANNEL_UPDATE", "MESSAGE_ACK", "CHANNEL_DELETE"],
        );
        assert.equal((emittedEvents[1] as { data: { message_id: string } }).data.message_id, "last-message");

        for (const method of ["PATCH", "PUT"]) {
            channel = createMessageRequestChannel(true);
            emittedEvents.length = 0;
            const response = await fetch(`${baseUrl}/channels/${channel.id}/recipients/@me`, {
                method,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ consent_status: 2 }),
            });

            assert.equal(response.status, 200, `${method} /@me should succeed`);
            const responseBody = (await response.json()) as { recipients: Array<{ id: string }> };
            assert.deepEqual(responseBody.recipients, [{ id: "sender" }]);
            assert.equal(channel.recipients[1].closed, false);
            assert.deepEqual(
                emittedEvents.map((event) => (event as { event: string }).event),
                ["CHANNEL_UPDATE"],
            );
        }
    });
});

function createTestRecipient(user_id: string, closed: boolean) {
    return {
        user_id,
        closed,
        async save() {
            return this as never;
        },
    };
}

function createMessageRequestChannel(requesterClosed: boolean) {
    return {
        id: "message-request-dm",
        last_message_id: "last-message",
        type: DM_CHANNEL_TYPE,
        recipients: [createTestRecipient("sender", false), createTestRecipient("requester", requesterClosed)],
    };
}

function createDmChannelDto(source: ReturnType<typeof createMessageRequestChannel>) {
    const dto = {
        icon: null,
        id: source.id,
        last_message_id: source.last_message_id,
        name: null,
        origin_channel_id: null,
        owner_id: undefined,
        recipients: source.recipients.map((recipient) => ({ id: recipient.user_id })),
        type: source.type,
        forRecipient(recipientId: string) {
            return {
                ...this,
                recipients: this.recipients.filter((recipient) => recipient.id !== recipientId),
            };
        },
    };

    return dto;
}

function listen(app: import("express").Express): Promise<Server> {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}
