import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

const GROUP_DM_CHANNEL_TYPE = 3;

function loadUtil() {
    return require("@spacebar/util") as typeof import("../../../../util/index.js");
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
