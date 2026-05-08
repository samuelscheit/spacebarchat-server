import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ActivityType, type Activity } from "../interfaces";
import { getPrivateGatewayActivities, isSpotifyActivity } from "../util/PrivateGatewayActivities";

function activity(name: string, type: ActivityType = ActivityType.GAME, extra: Partial<Activity> = {}): Activity {
    return {
        name,
        type,
        flags: "0",
        session_id: "activity-session",
        ...extra,
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

describe("private gateway session activity privacy", () => {
    test("keeps non-private activities visible by default", () => {
        assert.deepEqual(getPrivateGatewayActivities("online", [game]), {
            activities: [game],
            hidden_activities: [],
        });
    });

    test("treats nullable show_current_game as visible by default", () => {
        assert.deepEqual(getPrivateGatewayActivities("online", [game], null), {
            activities: [game],
            hidden_activities: [],
        });
    });

    test("hides every activity for offline and invisible sessions", () => {
        assert.deepEqual(getPrivateGatewayActivities("offline", [game, spotify]), {
            activities: [],
            hidden_activities: [game, spotify],
        });
        assert.deepEqual(getPrivateGatewayActivities("invisible", [game, spotify]), {
            activities: [],
            hidden_activities: [game, spotify],
        });
    });

    test("hides current games when show_current_game is disabled", () => {
        assert.deepEqual(getPrivateGatewayActivities("online", [game], false), {
            activities: [],
            hidden_activities: [game],
        });
    });

    test("keeps Spotify visible when show_current_game is disabled", () => {
        assert.equal(isSpotifyActivity(spotify), true);
        assert.deepEqual(getPrivateGatewayActivities("online", [game, spotify], false), {
            activities: [spotify],
            hidden_activities: [game],
        });
    });

    test("does not treat generic listening rich presence as Spotify", () => {
        const podcast = activity("Podcast", ActivityType.LISTENING, {
            sync_id: "episode-id",
            metadata: {
                album_id: "album-id",
                artist_ids: ["artist-id"],
            },
        });

        assert.equal(isSpotifyActivity(podcast), false);
        assert.deepEqual(getPrivateGatewayActivities("online", [podcast], false), {
            activities: [],
            hidden_activities: [podcast],
        });
    });
});
