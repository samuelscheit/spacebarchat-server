import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeVideoStream } from "./VideoStream";

describe("WebRTC video stream normalization", () => {
    it("converts client screen-share streams into complete outbound video stream descriptors", () => {
        const normalized = normalizeVideoStream(
            {
                type: "screen",
                rid: "50",
                active: true,
                quality: 50,
                max_bitrate: 1_000_000,
            },
            {
                video_ssrc: 1234,
                rtx_ssrc: 5678,
            },
        );

        assert.deepEqual(normalized, {
            type: "video",
            rid: "50",
            active: true,
            quality: 50,
            ssrc: 1234,
            rtx_ssrc: 5678,
            max_bitrate: 1_000_000,
            max_framerate: 20,
            max_resolution: {
                type: "fixed",
                width: 1280,
                height: 720,
            },
        });
    });

    it("preserves producer stream metadata while applying subscriber-specific SSRCs", () => {
        const producerStream = normalizeVideoStream(
            {
                type: "screen",
                rid: "100",
                ssrc: 1111,
                rtx_ssrc: 2222,
                active: false,
                quality: 100,
                max_framerate: 30,
            },
            {},
        );

        const subscriberStream = normalizeVideoStream(producerStream, {
            video_ssrc: 3333,
            rtx_ssrc: 4444,
        });

        assert.equal(subscriberStream.type, "video");
        assert.equal(subscriberStream.active, false);
        assert.equal(subscriberStream.max_framerate, 30);
        assert.equal(subscriberStream.ssrc, 3333);
        assert.equal(subscriberStream.rtx_ssrc, 4444);
    });
});
