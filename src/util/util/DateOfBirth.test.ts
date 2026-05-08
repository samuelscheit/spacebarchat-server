import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDateOfBirth } from "./DateOfBirth.js";

test("evaluateDateOfBirth accepts the exact minimum-age birthday as a calendar date", () => {
    const result = evaluateDateOfBirth("2013-05-08", 13, new Date("2026-05-08T12:00:00.000Z"));

    assert.equal(result.status, "allowed");
});

test("evaluateDateOfBirth rejects a birthday one calendar day below the minimum age", () => {
    const result = evaluateDateOfBirth("2013-05-09", 13, new Date("2026-05-08T12:00:00.000Z"));

    assert.equal(result.status, "underage");
});

test("evaluateDateOfBirth rejects invalid date-only strings instead of normalizing them", () => {
    const result = evaluateDateOfBirth("2026-02-31", 13, new Date("2026-05-08T12:00:00.000Z"));

    assert.equal(result.status, "invalid");
});

test("evaluateDateOfBirth treats blank strings as invalid supplied dates", () => {
    const result = evaluateDateOfBirth("", 13, new Date("2026-05-08T12:00:00.000Z"));

    assert.equal(result.status, "invalid");
});

test("evaluateDateOfBirth rejects timestamp strings to avoid timezone-dependent birthdays", () => {
    const result = evaluateDateOfBirth("2013-05-08T00:00:00.000Z", 13, new Date("2026-05-08T12:00:00.000Z"));

    assert.equal(result.status, "invalid");
});
