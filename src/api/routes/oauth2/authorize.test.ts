import assert from "node:assert/strict";
import test from "node:test";
import { toOAuthAuthorizeUserPreview } from "./authorize";

test("toOAuthAuthorizeUserPreview returns current avatar decoration response field", () => {
    const response = toOAuthAuthorizeUserPreview({
        id: "user-id",
        username: "alice",
        avatar: "avatar-hash",
        avatar_decoration_data: {
            asset: "decoration-asset",
            sku_id: "sku-id",
            expires_at: null,
        },
        discriminator: "0001",
        public_flags: 64,
    });

    assert.deepEqual(response, {
        id: "user-id",
        username: "alice",
        avatar: "avatar-hash",
        avatar_decoration_data: {
            asset: "decoration-asset",
            sku_id: "sku-id",
            expires_at: null,
        },
        discriminator: "0001",
        public_flags: 64,
    });
    assert.equal("avatar_decoration" in response, false);
});

test("toOAuthAuthorizeUserPreview preserves null avatar decoration data", () => {
    assert.equal(
        toOAuthAuthorizeUserPreview({
            id: "user-id",
            username: "alice",
            avatar: null,
            avatar_decoration_data: undefined,
            discriminator: "0001",
            public_flags: 0,
        }).avatar_decoration_data,
        null,
    );
});
