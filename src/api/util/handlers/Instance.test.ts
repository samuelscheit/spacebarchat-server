import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultInstanceAdministratorBootstrapDependencies, ensureInstanceAdministrator, InstanceAdministratorBootstrapDependencies } from "./Instance";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

const requireModule = require;

function user(overrides: Partial<{ id: string; username: string; discriminator: string; rights: string }> = {}) {
    return {
        id: "user-1",
        username: "first",
        discriminator: "0001",
        rights: "0",
        ...overrides,
    };
}

function dependencies(overrides: Partial<InstanceAdministratorBootstrapDependencies> = {}) {
    const logs: string[] = [];
    const warnings: string[] = [];
    const promoted: string[] = [];

    const deps: InstanceAdministratorBootstrapDependencies = {
        findOperator: async () => null,
        findFirstUser: async () => null,
        promoteToOperator: async (candidate) => {
            promoted.push(candidate.id);
        },
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
        ...overrides,
    };

    return { deps, logs, warnings, promoted };
}

describe("ensureInstanceAdministrator", () => {
    test("does nothing when an OPERATOR already exists", async () => {
        const operator = user({ id: "operator", rights: "1" });
        const state = dependencies({
            findOperator: async () => operator,
            findFirstUser: async () => {
                throw new Error("first user should not be queried when an operator exists");
            },
        });

        const result = await ensureInstanceAdministrator(state.deps);

        assert.deepEqual(result, { status: "operator_exists", user: operator });
        assert.deepEqual(state.promoted, []);
        assert.deepEqual(state.logs, []);
        assert.deepEqual(state.warnings, []);
    });

    test("warns when there is no user to promote", async () => {
        const state = dependencies();

        const result = await ensureInstanceAdministrator(state.deps);

        assert.deepEqual(result, { status: "no_users" });
        assert.deepEqual(state.promoted, []);
        assert.equal(state.logs.length, 0);
        assert.equal(state.warnings.length, 1);
        assert.match(state.warnings[0], /No instance administrator exists/);
    });

    test("promotes the first existing user when no OPERATOR exists", async () => {
        const firstUser = user({ id: "first-user" });
        const state = dependencies({ findFirstUser: async () => firstUser });

        const result = await ensureInstanceAdministrator(state.deps);

        assert.deepEqual(result, { status: "promoted", user: firstUser });
        assert.deepEqual(state.promoted, ["first-user"]);
        assert.equal(state.logs.length, 1);
        assert.match(state.logs[0], /Granted OPERATOR rights to first user first#0001 \(first-user\)/);
        assert.deepEqual(state.warnings, []);
    });

    test("looks for an active non-bot OPERATOR", async (t) => {
        const conditions: string[] = [];
        const queryBuilder = {
            where(condition: string) {
                conditions.push(condition);
                return this;
            },
            andWhere(condition: string) {
                conditions.push(condition);
                return this;
            },
            orderBy() {
                return this;
            },
            addOrderBy() {
                return this;
            },
            async getOne() {
                return null;
            },
        };

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        t.mock.method(spacebarUtil.User, "createQueryBuilder", () => queryBuilder);

        await defaultInstanceAdministratorBootstrapDependencies.findOperator();

        assert.ok(conditions.some((condition) => condition.includes("CAST(user.rights AS bigint)")));
        assert.ok(conditions.includes("user.bot = false"));
        assert.ok(conditions.includes("user.deleted = false"));
        assert.ok(conditions.includes("user.disabled = false"));
    });
});
