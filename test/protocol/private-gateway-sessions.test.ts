import assert from "node:assert/strict";
import { test } from "node:test";
import { ActivityType, type Activity } from "../../src/util/interfaces/Activity";
import type { GatewaySession, Status } from "../../src/util/interfaces";
import { serializePrivateGatewaySessions } from "../../src/util/util/GatewaySessions";
import { getPrivateGatewayActivities } from "../../src/util/util/PrivateGatewayActivities";

function activity(name: string, type: ActivityType = ActivityType.GAME, extra: Partial<Activity> = {}): Activity {
    return {
        name,
        type,
        flags: "0",
        session_id: "activity-session",
        ...extra,
    };
}

function session(sessionId: string, status: Status, activities: Activity[]) {
    return {
        session_id: sessionId,
        toPrivateGatewayDeviceInfo(showCurrentGame?: boolean | null): GatewaySession {
            const privateActivities = getPrivateGatewayActivities(status, activities, showCurrentGame);
            return {
                session_id: sessionId,
                status,
                ...privateActivities,
                client_info: {
                    client: "desktop",
                    os: "linux",
                    version: 1,
                },
            };
        },
    };
}

const game = activity("Game");
const spotify = activity("Spotify", ActivityType.LISTENING, {
    id: "spotify:1",
    sync_id: "track-id",
    metadata: {
        context_uri: "spotify:album:1",
        album_id: "album-id",
        artist_ids: ["artist-id"],
    },
});

test("private gateway sessions hide non-Spotify activities when show_current_game is disabled", () => {
    const [serialized] = serializePrivateGatewaySessions([session("real-session", "online", [game, spotify])], false);

    assert.deepEqual(serialized.activities, [spotify]);
    assert.deepEqual(serialized.hidden_activities, [game]);
});

test("private gateway sessions hide all activities for offline and invisible statuses", () => {
    for (const status of ["offline", "invisible"] satisfies Status[]) {
        const [serialized] = serializePrivateGatewaySessions([session(`real-${status}`, status, [game, spotify])], false);

        assert.deepEqual(serialized.activities, []);
        assert.deepEqual(serialized.hidden_activities, [game, spotify]);
    }
});

test("private gateway sessions default nullable show_current_game values to visible activities", () => {
    assert.deepEqual(serializePrivateGatewaySessions([session("undefined-session", "online", [game])], undefined)[0].activities, [game]);
    assert.deepEqual(serializePrivateGatewaySessions([session("null-session", "online", [game])], null)[0].activities, [game]);
});
