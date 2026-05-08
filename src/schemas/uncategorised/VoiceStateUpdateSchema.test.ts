import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import { ajv } from "../Validator";
import { VoiceStateUpdateSchema } from "./VoiceStateUpdateSchema";

describe("VoiceStateUpdateSchema", () => {
    test("accepts gateway voice state updates for joining and self-state changes", () => {
        assert.equal(
            instanceOf(VoiceStateUpdateSchema, {
                guild_id: "guild-id",
                channel_id: "voice-channel-id",
                self_mute: false,
                self_deaf: false,
                self_video: true,
                preferred_region: "local",
            }),
            true,
        );

        assert.equal(
            instanceOf(VoiceStateUpdateSchema, {
                guild_id: "guild-id",
                self_mute: true,
                self_deaf: false,
            }),
            true,
        );
    });

    test("validates stage voice-state REST fields in the generated JSON schema", () => {
        const validate = ajv.getSchema("VoiceStateModifySchema");
        assert.ok(validate);

        assert.equal(
            validate({
                request_to_speak_timestamp: "2026-05-08T12:34:56.000Z",
                suppress: false,
            }),
            true,
            JSON.stringify(validate.errors),
        );
        assert.equal(validate({ channel_id: "stage-channel-id" }), true, JSON.stringify(validate.errors));
        assert.equal(validate({}), true, JSON.stringify(validate.errors));

        assert.equal(
            validate({
                channel_id: "stage-channel-id",
                stage_instance_id: "unexpected",
            }),
            false,
        );
        assert.equal(
            validate.errors?.some((error) => error.keyword === "additionalProperties"),
            true,
        );
    });

    test("does not require gateway-only self mute/deaf fields for stage voice-state REST updates", () => {
        const schema = ajv.getSchema("VoiceStateModifySchema")?.schema as {
            properties?: Record<string, unknown>;
            required?: string[];
        };

        assert.equal(schema.required, undefined);
        assert.deepEqual(Object.keys(schema.properties ?? {}).toSorted(), ["channel_id", "request_to_speak_timestamp", "suppress"]);
        assert.equal(ajv.validate("VoiceStateModifySchema", { channel_id: "stage-channel-id" }), true, JSON.stringify(ajv.errors));
        assert.equal(ajv.validate("VoiceStateModifySchema", { self_mute: false, self_deaf: false }), false);
    });

    test("exposes expected required and optional properties in generated JSON schema", () => {
        const schema = ajv.getSchema("VoiceStateUpdateSchema")?.schema as {
            properties?: Record<string, unknown>;
            required?: string[];
        };

        assert.deepEqual(schema.required?.toSorted(), ["self_deaf", "self_mute"]);
        assert.deepEqual(Object.keys(schema.properties ?? {}).toSorted(), [
            "channel_id",
            "flags",
            "guild_id",
            "preferred_region",
            "request_to_speak_timestamp",
            "self_deaf",
            "self_mute",
            "self_video",
            "suppress",
        ]);
    });
});
