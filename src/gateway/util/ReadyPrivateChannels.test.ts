import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ChannelType } from "../../schemas/api/channels/Channel";
import type { PublicUser } from "../../schemas/api/users/User";
import { toReadyPrivateChannel } from "./ReadyPrivateChannels";

function publicUser(id: string): PublicUser {
    return {
        id,
        username: `user-${id}`,
        discriminator: "0001",
        public_flags: 0,
        avatar: undefined,
        accent_color: undefined,
        banner: undefined,
        bio: "",
        bot: false,
        premium_since: undefined,
        premium_type: 0,
        theme_colors: undefined,
        pronouns: "",
        badge_ids: undefined,
        avatar_decoration_data: undefined,
        display_name_styles: undefined,
        collectibles: undefined,
        primary_guild: undefined,
    };
}

function userRef(id: string) {
    const user = publicUser(id);
    return {
        id,
        toPublicUser: () => user,
    };
}

function recipient(id: string) {
    return { user: userRef(id) };
}

describe("toReadyPrivateChannel", () => {
    test("serializes a normal DM with only the other user as recipient", () => {
        const users = new Set<PublicUser>();
        const currentUser = userRef("self");
        const readyChannel = toReadyPrivateChannel(
            {
                id: "dm-1",
                flags: 0,
                type: ChannelType.DM,
                recipients: [recipient("self"), recipient("other")],
            },
            currentUser,
            users,
        );

        assert.deepEqual(
            readyChannel.recipients.map((user) => user.id),
            ["other"],
        );
        assert.deepEqual(
            Array.from(users).map((user) => user.id),
            ["other"],
        );
    });

    test("keeps one-recipient DMs renderable by using the current user", () => {
        const users = new Set<PublicUser>();
        const currentUser = userRef("self");
        const readyChannel = toReadyPrivateChannel(
            {
                id: "dm-self",
                flags: 0,
                type: ChannelType.DM,
                recipients: [recipient("self")],
            },
            currentUser,
            users,
        );

        assert.deepEqual(
            readyChannel.recipients.map((user) => user.id),
            ["self"],
        );
        assert.deepEqual(
            Array.from(users).map((user) => user.id),
            ["self"],
        );
    });

    test("does not fabricate group DM recipients when only the current user remains", () => {
        const users = new Set<PublicUser>();
        const readyChannel = toReadyPrivateChannel(
            {
                id: "group-1",
                flags: 0,
                type: ChannelType.GROUP_DM,
                recipients: [recipient("self")],
            },
            userRef("self"),
            users,
        );

        assert.deepEqual(readyChannel.recipients, []);
        assert.equal(users.size, 0);
    });
});
