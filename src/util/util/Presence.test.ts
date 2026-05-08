import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Session } from "../entities/Session";
import { ActivityType, type Activity, type Presence, type Status } from "../interfaces";

function createActivity(name: string): Activity {
    return { name, type: ActivityType.GAME, flags: "0", session_id: "session" };
}

function createSession(status: Status, activities: Activity[] = []): Session {
    return { status, activities } as Session;
}

describe("getMostRelevantSession", () => {
    test("models game presence as activities", () => {
        const game = createActivity("game");
        const noTopLevelGame: Extract<keyof Presence, "game"> extends never ? true : never = true;

        assert.equal(game.type, ActivityType.GAME);
        assert.equal(noTopLevelGame, true);
    });

    test("prioritizes status before activity count", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1/spacebar";
        const { getMostRelevantSession } = await import("./Presence.js");
        const offline = createSession("offline", []);
        const online = createSession("online", [createActivity("game"), createActivity("music"), createActivity("stream")]);
        const idle = createSession("idle", [createActivity("game"), createActivity("music")]);
        const dnd = createSession("dnd", [createActivity("game"), createActivity("music")]);

        assert.equal(getMostRelevantSession([idle, online]), online);
        assert.equal(getMostRelevantSession([offline, idle]), idle);
        assert.equal(getMostRelevantSession([offline, dnd]), dnd);
    });
});
