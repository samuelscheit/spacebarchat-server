import assert from "node:assert/strict";
import test from "node:test";
import { AvatarDecorationData } from "@spacebar/schemas";
import { toOAuthAuthorizeBot } from "./authorizeResponse";

test("toOAuthAuthorizeBot exposes persisted avatar decoration data", () => {
    const avatarDecorationData: AvatarDecorationData = {
        asset: "avatar-decoration-asset",
        sku_id: "123456789012345678",
        expires_at: null,
    };

    assert.deepEqual(
        toOAuthAuthorizeBot({
            id: "987654321098765432",
            username: "authorize-bot",
            avatar: "avatar-hash",
            avatar_decoration_data: avatarDecorationData,
            discriminator: "0001",
            public_flags: 0,
        }),
        {
            id: "987654321098765432",
            username: "authorize-bot",
            avatar: "avatar-hash",
            avatar_decoration_data: avatarDecorationData,
            discriminator: "0001",
            public_flags: 0,
            bot: true,
        },
    );
});

test("toOAuthAuthorizeBot normalizes missing avatar decoration data to null", () => {
    assert.equal(
        toOAuthAuthorizeBot({
            id: "987654321098765432",
            username: "authorize-bot",
            avatar: null,
            avatar_decoration_data: undefined,
            discriminator: "0001",
            public_flags: 0,
        }).avatar_decoration_data,
        null,
    );
});
