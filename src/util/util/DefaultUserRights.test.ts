import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RegisterConfiguration } from "../config/types/RegisterConfiguration";
import { OrmUtils } from "../imports/OrmUtils";
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

    it("keeps existing config default rights as bot fallback after default config merging", () => {
        const initializedConfig = OrmUtils.mergeDeep({}, new RegisterConfiguration(), { defaultRights: "123" }) as RegisterConfiguration;

        assert.equal(getDefaultUserRights(true, initializedConfig), "123");
    });
});
