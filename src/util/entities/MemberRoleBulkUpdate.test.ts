import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { Member } from "./Member";
import { Role } from "./Role";
import * as eventUtil from "../util/Event";

interface QueryCall {
    operation: "insert" | "delete";
    table?: string;
    values?: unknown;
    where?: { query: string; parameters: unknown };
    andWhere?: { query: string; parameters: unknown };
}

interface TransactionManagerMock {
    getRepository(entity: unknown): unknown;
    createQueryBuilder(): ReturnType<typeof createQueryBuilder>;
}

function createQueryBuilder(calls: QueryCall[]) {
    const call = {} as QueryCall;

    return {
        insert() {
            call.operation = "insert";
            calls.push(call);
            return this;
        },
        delete() {
            call.operation = "delete";
            calls.push(call);
            return this;
        },
        into(table: string) {
            call.table = table;
            return this;
        },
        from(table: string) {
            call.table = table;
            return this;
        },
        values(values: unknown) {
            call.values = values;
            return this;
        },
        orIgnore() {
            return this;
        },
        where(query: string, parameters: unknown) {
            call.where = { query, parameters };
            return this;
        },
        andWhere(query: string, parameters: unknown) {
            call.andWhere = { query, parameters };
            return this;
        },
        async execute() {
            return { affected: 1, generatedMaps: [], raw: [] };
        },
    };
}

function mockRoleMemberRepositories(t: TestContext, members: Partial<Member>[]) {
    const queryCalls: QueryCall[] = [];
    let transactionFinished = false;

    const transactionManager: TransactionManagerMock = {
        getRepository(entity: unknown) {
            if (entity === Member) {
                return {
                    async find() {
                        return members;
                    },
                };
            }

            if (entity === Role) {
                return {
                    async findOneOrFail() {
                        return { id: "role-a" };
                    },
                };
            }

            throw new Error("Unexpected repository");
        },
        createQueryBuilder() {
            return createQueryBuilder(queryCalls);
        },
    };

    const manager = {
        async transaction<T>(callback: (transactionManager: TransactionManagerMock) => Promise<T>) {
            const result = await callback(transactionManager);
            transactionFinished = true;
            return result;
        },
    };

    t.mock.method(Member, "getRepository", () => ({ manager }));

    return {
        queryCalls,
        get transactionFinished() {
            return transactionFinished;
        },
    };
}

describe("Member.updateRoleMembers", () => {
    test("bulk updates member role rows in one transaction and emits final role snapshots after commit", async (t) => {
        const repositoryState = mockRoleMemberRepositories(t, [
            { index: "1", id: "add-me", user: { id: "add-me" }, roles: [{ id: "role-b" }] },
            { index: "2", id: "remove-me", user: { id: "remove-me" }, roles: [{ id: "role-a" }, { id: "role-b" }] },
        ] as unknown as Partial<Member>[]);
        const events: unknown[] = [];

        t.mock.method(eventUtil, "emitEvent", async (event: unknown) => {
            assert.equal(repositoryState.transactionFinished, true);
            events.push(event);
        });

        await Member.updateRoleMembers("guild-a", "role-a", {
            addMemberIds: ["add-me"],
            removeMemberIds: ["remove-me"],
        });

        assert.deepEqual(repositoryState.queryCalls, [
            {
                operation: "insert",
                table: "member_roles",
                values: [{ index: "1", role_id: "role-a" }],
            },
            {
                operation: "delete",
                table: "member_roles",
                where: { query: '"index" IN (:...memberIndexes)', parameters: { memberIndexes: ["2"] } },
                andWhere: { query: "role_id = :role_id", parameters: { role_id: "role-a" } },
            },
        ]);
        assert.deepEqual(events, [
            {
                event: "GUILD_MEMBER_UPDATE",
                data: {
                    guild_id: "guild-a",
                    user: { id: "add-me" },
                    roles: ["role-b", "role-a"],
                },
                guild_id: "guild-a",
            },
            {
                event: "GUILD_MEMBER_UPDATE",
                data: {
                    guild_id: "guild-a",
                    user: { id: "remove-me" },
                    roles: ["role-b"],
                },
                guild_id: "guild-a",
            },
        ]);
    });

    test("treats overlapping add and remove input as an add", async (t) => {
        const repositoryState = mockRoleMemberRepositories(t, [{ index: "1", id: "member-a", user: { id: "member-a" }, roles: [] }] as unknown as Partial<Member>[]);
        const events: unknown[] = [];

        t.mock.method(eventUtil, "emitEvent", async (event: unknown) => {
            events.push(event);
        });

        await Member.updateRoleMembers("guild-a", "role-a", {
            addMemberIds: ["member-a"],
            removeMemberIds: ["member-a"],
        });

        assert.deepEqual(repositoryState.queryCalls, [
            {
                operation: "insert",
                table: "member_roles",
                values: [{ index: "1", role_id: "role-a" }],
            },
        ]);
        assert.deepEqual(events, [
            {
                event: "GUILD_MEMBER_UPDATE",
                data: {
                    guild_id: "guild-a",
                    user: { id: "member-a" },
                    roles: ["role-a"],
                },
                guild_id: "guild-a",
            },
        ]);
    });
});
