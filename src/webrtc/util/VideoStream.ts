import type { VoiceVideoSchema } from "@spacebar/schemas";
import type { SSRCs, VideoStream } from "@spacebarchat/spacebar-webrtc-types";

type VoiceVideoStream = NonNullable<VoiceVideoSchema["streams"]>[number];

const DEFAULT_VIDEO_STREAM: Omit<VideoStream, "ssrc" | "rtx_ssrc"> = {
    type: "video",
    rid: "100",
    active: true,
    quality: 100,
    max_bitrate: 2500000,
    max_framerate: 20,
    max_resolution: {
        type: "fixed",
        width: 1280,
        height: 720,
    },
};

function numberOrDefault(value: number | undefined, fallback: number): number {
    return value ?? fallback;
}

export function normalizeVideoStream(stream: VoiceVideoStream | undefined, ssrcs: SSRCs): VideoStream {
    return {
        ...DEFAULT_VIDEO_STREAM,
        ...stream,
        // Discord may identify Go Live/screen-share streams as "screen" in client
        // payloads, but subscribers expect the media stream descriptor to be "video".
        type: "video",
        ssrc: numberOrDefault(ssrcs.video_ssrc, numberOrDefault(stream?.ssrc, 0)),
        rtx_ssrc: numberOrDefault(ssrcs.rtx_ssrc, numberOrDefault(stream?.rtx_ssrc, 0)),
    };
}
