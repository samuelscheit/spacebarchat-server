import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import type { Permissions, Rights, Session, User, UserTokenData } from "@spacebar/util";
import type { SpacebarServer } from "../../src/api/Server";
import type {} from "../../src/api/types/ExpressRequest";

type AssertEqual<T, Expected> = [T] extends [Expected] ? ([Expected] extends [T] ? true : never) : never;

test("API Express request augmentation exposes shared route and auth fields", () => {
    const requestContract: {
        user_id: AssertEqual<Request["user_id"], string>;
        user_bot: AssertEqual<Request["user_bot"], boolean>;
        tokenData: AssertEqual<Request["tokenData"], UserTokenData>;
        token: AssertEqual<Request["token"], UserTokenData["decoded"]>;
        user: AssertEqual<Request["user"], User>;
        session: AssertEqual<Request["session"], Session | undefined>;
        permission: AssertEqual<Request["permission"], Permissions | undefined>;
        rights: AssertEqual<Request["rights"], Rights>;
        fingerprint: AssertEqual<Request["fingerprint"], string | undefined>;
        server: AssertEqual<Request["server"], SpacebarServer>;
    } = {
        user_id: true,
        user_bot: true,
        tokenData: true,
        token: true,
        user: true,
        session: true,
        permission: true,
        rights: true,
        fingerprint: true,
        server: true,
    };

    assert.deepEqual(Object.values(requestContract), Array(Object.keys(requestContract).length).fill(true));
});
