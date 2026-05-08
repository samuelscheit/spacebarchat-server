import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import express, { type Request, type Response, type NextFunction } from "express";
import { ConnectedAccount } from "@spacebar/util";
import { BodyParser, ErrorHandler } from "../../../../../../middlewares";
import connectionsRouter from "./index";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

const originalFindOne = ConnectedAccount.findOne;
const originalUpdate = ConnectedAccount.update;

type TestConnectedAccount = ConnectedAccount & {
    assignedBody?: unknown;
};

function createConnection(overrides: Partial<TestConnectedAccount> = {}): TestConnectedAccount {
    return {
        external_id: "external-id",
        user_id: "user-id",
        friend_sync: false,
        name: "Twitch User",
        revoked: false,
        show_activity: 0,
        type: "twitch",
        verified: true,
        visibility: 0,
        integrations: [],
        metadata_: undefined,
        metadata_visibility: 0,
        two_way_link: false,
        assign(props: object) {
            this.assignedBody = props;
            Object.assign(this, props);
            return this;
        },
        ...overrides,
    } as TestConnectedAccount;
}

async function startConnectionsRouteServer(connection: TestConnectedAccount | null) {
    let updateCall:
        | {
              criteria: unknown;
              entity: unknown;
          }
        | undefined;

    ConnectedAccount.findOne = (async () => connection) as typeof ConnectedAccount.findOne;
    ConnectedAccount.update = (async (criteria: unknown, entity: unknown) => {
        updateCall = { criteria, entity };
        return { affected: 1, raw: [], generatedMaps: [] };
    }) as typeof ConnectedAccount.update;

    const app = express();
    app.use(BodyParser({ inflate: true, limit: "1mb" }));
    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.user_id = "user-id";
        next();
    });
    app.use("/users/@me/connections/:connection_name/:connection_id", connectionsRouter);
    app.use(ErrorHandler);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        url: `http://${address.address}:${address.port}/users/@me/connections/twitch/external-id`,
        getUpdateCall: () => updateCall,
    };
}

function patchJson(url: string, body: unknown): Promise<{ statusCode: number | undefined; body: unknown }> {
    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
        const req = http.request(
            url,
            {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(payload),
                },
            },
            (res) => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve({
                            statusCode: res.statusCode,
                            body: data ? JSON.parse(data) : null,
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            },
        );

        req.on("error", reject);
        req.end(payload);
    });
}

async function closeServer(server: http.Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

afterEach(() => {
    ConnectedAccount.findOne = originalFindOne;
    ConnectedAccount.update = originalUpdate;
});

describe("PATCH /users/@me/connections/:connection_name/:connection_id", () => {
    test("rejects revoked connections without updating them", async () => {
        const { server, url, getUpdateCall } = await startConnectionsRouteServer(createConnection({ revoked: true }));
        try {
            const response = await patchJson(url, { visibility: true });

            assert.equal(response.statusCode, 400);
            assert.deepEqual(response.body, {
                code: 40012,
                message: "The connection has been revoked",
            });
            assert.equal(getUpdateCall(), undefined);
        } finally {
            await closeServer(server);
        }
    });

    test("updates visibility fields for active connections", async () => {
        const connection = createConnection();
        const { server, url, getUpdateCall } = await startConnectionsRouteServer(connection);
        try {
            const response = await patchJson(url, {
                visibility: true,
                show_activity: false,
                metadata_visibility: true,
            });

            assert.equal(response.statusCode, 200);
            assert.equal(connection.visibility, 1);
            assert.equal(connection.show_activity, 0);
            assert.equal(connection.metadata_visibility, 1);
            assert.deepEqual(getUpdateCall()?.criteria, {
                user_id: "user-id",
                external_id: "external-id",
                type: "twitch",
            });
            assert.equal(getUpdateCall()?.entity, connection);

            const body = response.body as Record<string, unknown>;
            assert.equal(body.id, "external-id");
            assert.equal(body.revoked, false);
            assert.equal(body.visibility, 1);
            assert.equal(body.metadata_visibility, 1);
        } finally {
            await closeServer(server);
        }
    });
});
