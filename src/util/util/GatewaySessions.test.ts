import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { GatewaySession, Status } from "../interfaces";
import { isRealGatewaySessionId, serializePrivateGatewaySessions } from "./GatewaySessions";

function session(session_id: string, status: Status = "online") {
    return {
        session_id,
        toPrivateGatewayDeviceInfo(showCurrentGame = true): GatewaySession {
            return {
                session_id,
                status,
                activities: [],
                hidden_activities: showCurrentGame ? [] : [{ name: "hidden", type: 0, flags: "0", session_id }],
                client_info: {
                    client: "desktop",
                    os: "linux",
                    version: 0,
                },
            };
        },
    };
}

describe("gateway session serialization", () => {
    test("identifies real gateway session ids", () => {
        assert.equal(isRealGatewaySessionId("all"), false);
        assert.equal(isRealGatewaySessionId("TEMP_abc"), false);
        assert.equal(isRealGatewaySessionId(""), false);
        assert.equal(isRealGatewaySessionId("real"), true);
    });

    test("omits sentinel and temporary session ids", () => {
        assert.deepEqual(
            serializePrivateGatewaySessions([session("all"), session("TEMP_abc"), session("real")]).map((item) => item.session_id),
            ["real"],
        );
    });

    test("deduplicates sessions by id with the newest entry winning", () => {
        assert.deepEqual(serializePrivateGatewaySessions([session("same", "idle"), session("same", "online")]), [
            {
                session_id: "same",
                status: "online",
                activities: [],
                hidden_activities: [],
                client_info: {
                    client: "desktop",
                    os: "linux",
                    version: 0,
                },
            },
        ]);
    });

    test("passes the show_current_game preference to session serializers", () => {
        assert.deepEqual(serializePrivateGatewaySessions([session("real")], false)[0]?.hidden_activities, [
            { name: "hidden", type: 0, flags: "0", session_id: "real" },
        ]);
    });
});
