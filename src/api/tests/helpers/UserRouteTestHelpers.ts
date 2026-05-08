import type { AddressInfo } from "node:net";
import { type TestContext } from "node:test";
import express from "express";

export function mockCurrentUserLookup(t: TestContext, User: typeof import("@spacebar/util").User) {
    let assignedBody: Record<string, unknown> | undefined;

    class FakeUser {
        id = "user-id";
        username = "user";
        data?: { hash?: string; valid_tokens_since?: Date } = {};

        assign(body: Record<string, unknown>) {
            assignedBody = body;
            Object.assign(this, body);
            return this;
        }

        validate() {}

        async save() {}

        toPrivateUser() {
            return { ...this, data: undefined };
        }
    }

    t.mock.method(User, "findOneOrFail", async () => new FakeUser() as unknown as InstanceType<typeof User>);

    return () => assignedBody;
}

export function createUserRouteApp(router: express.Router, mountPath = "/users/@me") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const routeRequest = req as unknown as { user_id: string; t: (key: string) => string };
        routeRequest.user_id = "user-id";
        routeRequest.t = (key: string) => key;
        next();
    });
    app.use(mountPath, router);
    return app;
}

export async function requestJson(app: express.Express, path: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}
