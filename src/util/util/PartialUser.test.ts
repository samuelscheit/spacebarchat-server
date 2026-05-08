import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toPartialUser, toPartialUsers } from "./PartialUser";

describe("Partial user serialization", () => {
    test("projects public partial-user fields without leaking private profile fields", () => {
        const source = {
            id: "user-id",
            username: "partial-user",
            discriminator: "0001",
            avatar: "avatar-hash",
            global_name: "Partial User",
            public_flags: 64,
            email: "user@example.invalid",
            phone: "555-0100",
            mfa_enabled: true,
            bio: "profile bio must not leak into partial users",
        };

        const partial = toPartialUser(source);

        assert.deepEqual(partial, {
            id: "user-id",
            username: "partial-user",
            discriminator: "0001",
            avatar: "avatar-hash",
            global_name: "Partial User",
            public_flags: 64,
        });
    });

    test("uses toPublicUser sources and defaults missing avatars to null", () => {
        const partial = toPartialUser({
            toPublicUser() {
                return {
                    id: "user-id",
                    username: "partial-user",
                    discriminator: "0001",
                    public_flags: 64,
                    email: "user@example.invalid",
                };
            },
        });

        assert.deepEqual(partial, {
            id: "user-id",
            username: "partial-user",
            discriminator: "0001",
            avatar: null,
            public_flags: 64,
        });
    });

    test("projects arrays and defaults missing arrays to empty", () => {
        assert.deepEqual(
            toPartialUsers([
                {
                    id: "user-id",
                    username: "partial-user",
                    discriminator: "0001",
                },
            ]),
            [
                {
                    id: "user-id",
                    username: "partial-user",
                    discriminator: "0001",
                    avatar: null,
                },
            ],
        );
        assert.deepEqual(toPartialUsers(undefined), []);
        assert.deepEqual(toPartialUsers(null), []);
    });
});
