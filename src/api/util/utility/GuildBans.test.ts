import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PublicUserProjection } from "../../../schemas/api/users/User";
import { BanResponseUserSelect, GuildBanResponseUserFields, toGuildBanResponse } from "./GuildBans";

describe("guild ban response helpers", () => {
    test("serializes ban users through the public user projection", () => {
        const response = toGuildBanResponse(undefined, {
            id: "123",
            username: "banned-user",
            discriminator: "0001",
            avatar: null,
            public_flags: 64,
            email: "secret@example.test",
            phone: "+15555550123",
            mfa_enabled: true,
            data: { hash: "password-hash" },
        } as never);

        assert.equal(response.reason, null);
        assert.deepEqual(Object.keys(response.user).sort(), [...GuildBanResponseUserFields].sort());
        assert.equal("email" in response.user, false);
        assert.equal("phone" in response.user, false);
        assert.equal("mfa_enabled" in response.user, false);
        assert.equal("data" in response.user, false);
    });

    test("selects only public user fields for ban user joins", () => {
        assert.deepEqual(Object.keys(BanResponseUserSelect).sort(), [...PublicUserProjection].sort());
    });
});
