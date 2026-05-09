import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { PublicConnectedAccount } from "./ConnectedAccount";

test("PublicConnectedAccount stays independent from util entities", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "schemas", "api", "users", "ConnectedAccount.ts"), "utf8");

    assert.equal(source.includes("@spacebar/util"), false);
    assert.equal(source.includes("TODO: remove entity import"), false);
});

test("PublicConnectedAccount exposes the public connected account fields", () => {
    const connectedAccount = {
        name: "alice",
        type: "github",
        verified: true,
    } satisfies PublicConnectedAccount;

    assert.deepEqual(Object.keys(connectedAccount).sort(), ["name", "type", "verified"]);
});
