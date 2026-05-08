import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { User } from "@spacebar/util";
import { ajv } from "@spacebar/schemas";

describe("user discriminator normalization", () => {
    test("pads valid decimal discriminator strings", () => {
        assert.equal(User.normalizeDiscriminator("1"), "0001");
        assert.equal(User.normalizeDiscriminator("0001"), "0001");
        assert.equal(User.normalizeDiscriminator("42"), "0042");
        assert.equal(User.normalizeDiscriminator("0042"), "0042");
        assert.equal(User.normalizeDiscriminator("9999"), "9999");
    });

    test("rejects invalid or non-canonical numeric strings", () => {
        for (const discriminator of ["0", "0000", "10000", "1.5", "1e3", "0x10", "+1", "-1", " 42", "42 ", "9999.0", "abcd", ""]) {
            assert.throws(
                () => User.normalizeDiscriminator(discriminator),
                (error: unknown) => {
                    assert.equal((error as { code?: number }).code, 50035);
                    assert.equal((error as { errors?: { discriminator?: { _errors?: { code?: string }[] } } }).errors?.discriminator?._errors?.[0]?.code, "DISCRIMINATOR_INVALID");
                    return true;
                },
                `expected ${JSON.stringify(discriminator)} to be rejected`,
            );
        }
    });
});

describe("UserModifySchema discriminator validation", () => {
    test("accepts 1 to 4 digit discriminator strings for route-level normalization", () => {
        for (const discriminator of ["1", "01", "0001", "9999"]) {
            assert.equal(
                ajv.validate("UserModifySchema", {
                    discriminator,
                }),
                true,
                `expected ${JSON.stringify(discriminator)} to be accepted`,
            );
        }
    });

    test("rejects discriminator strings outside the 1 through 9999 decimal range", () => {
        for (const discriminator of ["", "0", "0000", "10000", "1e3", "0x10", "+1", "-1", " 42", "42 ", "9999.0", "abcd"]) {
            assert.equal(
                ajv.validate("UserModifySchema", {
                    discriminator,
                }),
                false,
                `expected ${JSON.stringify(discriminator)} to be rejected`,
            );
        }
    });
});
