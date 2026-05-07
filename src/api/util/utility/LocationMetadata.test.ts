import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLocationMetadataResponse } from "./LocationMetadata";

test("buildLocationMetadataResponse preserves country code when available", () => {
    assert.deepEqual(buildLocationMetadataResponse("DE"), {
        consent_required: false,
        country_code: "DE",
        promotional_email_opt_in: { required: true, pre_checked: false },
    });
});

test("buildLocationMetadataResponse serializes unavailable country code as null", () => {
    const response = buildLocationMetadataResponse(undefined);
    const serialized = JSON.parse(JSON.stringify(response));

    assert.deepEqual(response, {
        consent_required: false,
        country_code: null,
        promotional_email_opt_in: { required: true, pre_checked: false },
    });
    assert.ok(Object.hasOwn(serialized, "country_code"));
    assert.equal(serialized.country_code, null);
    assert.equal(buildLocationMetadataResponse(null).country_code, null);
});
