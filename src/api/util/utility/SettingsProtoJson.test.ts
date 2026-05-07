import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PreloadedUserSettings } from "discord-protos";
import { HTTPError } from "lambert-server";
import { parseSettingsProtoJson } from "./SettingsProtoJson";

describe("parseSettingsProtoJson", () => {
    test("parses valid settings objects with fractional JSON numbers", () => {
        const settings = parseSettingsProtoJson(PreloadedUserSettings, {
            voiceAndVideo: {
                soundboardSettings: {
                    volume: 0.5,
                },
            },
        });

        assert.equal(settings.voiceAndVideo?.soundboardSettings?.volume, 0.5);
    });

    test("maps protobuf JSON parser failures to client errors", () => {
        assert.throws(
            () => parseSettingsProtoJson(PreloadedUserSettings, { unknownField: true }),
            (error) => {
                assert.ok(error instanceof HTTPError);
                assert.equal(error.code, 400);
                assert.match(error.message, /Invalid settings proto JSON/);
                assert.match(error.message, /unknownField/);
                return true;
            },
        );
    });
});
