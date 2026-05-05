import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDefaultUserRights } from "./DefaultUserRights";

describe("default user rights", () => {
    it("uses normal default rights for user accounts", () => {
        assert.equal(getDefaultUserRights(false, { defaultRights: "123", defaultBotRights: "456" }), "123");
    });

    it("uses bot default rights for bot accounts", () => {
        assert.equal(getDefaultUserRights(true, { defaultRights: "123", defaultBotRights: "456" }), "456");
    });

    it("falls back to normal default rights when bot rights are not configured", () => {
        assert.equal(getDefaultUserRights(true, { defaultRights: "123" }), "123");
    });
});
