import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
const localRequire = createRequire(__filename);

const RelationshipType = {
    outgoing: 4,
    incoming: 3,
    blocked: 2,
    friends: 1,
} as const;

type RelationshipTypeValue = (typeof RelationshipType)[keyof typeof RelationshipType];

const fallbackSchemaValue = new Proxy(Object.create(null), {
    get: (_target, property) => {
        if (property === Symbol.toPrimitive) return () => 0;
        if (property === "then") return undefined;
        if (property === "toString") return () => "0";
        if (property === "valueOf") return () => 0;
        return fallbackSchemaValue;
    },
});

const schemasPath = localRequire.resolve("@spacebar/schemas");
const schemasMock = new Proxy(
    {
        ApplicationCommandType: { CHAT_INPUT: 1 },
        PublicUserProjection: [],
        RelationshipType,
    },
    {
        get: (target, property) => {
            if (property in target) return target[property as keyof typeof target];
            return fallbackSchemaValue;
        },
    },
);

(localRequire.cache as Record<string, { exports: unknown } | undefined>)[schemasPath] = {
    exports: schemasMock,
};

const DiscordApiErrors = {
    MAXIMUM_FRIENDS: {
        code: 30002,
        withParams: (maxFriends: number) => Object.assign(new Error(`Maximum number of friends reached (${maxFriends})`), { code: 30002 }),
    },
};
const Config = {
    get: () => ({ limits: { user: { maxFriends: 5000 } } }),
};
const Relationship = {
    create: () => {
        throw new Error("Relationship.create was not mocked");
    },
    delete: async () => undefined,
};
const User = {
    findOneOrFail: async () => {
        throw new Error("User.findOneOrFail was not mocked");
    },
};
const utilMock = {
    Config,
    DiscordApiErrors,
    Relationship,
    User,
    emitEvent: async () => undefined,
};
const utilPath = localRequire.resolve("@spacebar/util");

(localRequire.cache as Record<string, { exports: unknown } | undefined>)[utilPath] = {
    exports: utilMock,
};

const { updateRelationship } = localRequire("./Relationships") as typeof import("./Relationships");

type SavedRelationship = {
    id: string;
    to_id: string;
    type: RelationshipTypeValue;
    saveCalls: number;
    save: () => Promise<SavedRelationship>;
    toPublicRelationship: () => { id: string; type: RelationshipTypeValue };
};

function fakeRelationship(id: string, to_id: string, type: RelationshipTypeValue): SavedRelationship {
    const relationship: SavedRelationship = {
        id,
        to_id,
        type,
        saveCalls: 0,
        async save() {
            relationship.saveCalls += 1;
            return relationship;
        },
        toPublicRelationship() {
            return { id: to_id, type: relationship.type };
        },
    };

    return relationship;
}

function fakeUser(id: string, relationships: SavedRelationship[] = []) {
    return { id, relationships };
}

function relationshipUser(id: string, relationships: SavedRelationship[] = []) {
    return fakeUser(id, relationships) as never;
}

describe("updateRelationship", () => {
    test("rejects new blocked relationships when the acting user is at the relationship cap", async (t) => {
        const existingRelationship = fakeRelationship("existing-rel", "existing-user", RelationshipType.friends);
        const create = t.mock.method(Relationship, "create", () => {
            throw new Error("should not create a blocked relationship past the cap");
        });
        const emitted = t.mock.method(utilMock, "emitEvent", async () => undefined);

        t.mock.method(Config, "get", () => ({ limits: { user: { maxFriends: 1 } } }) as ReturnType<typeof Config.get>);
        t.mock.method(User, "findOneOrFail", async () => fakeUser("actor", [existingRelationship]));

        await assert.rejects(
            () => updateRelationship("actor", relationshipUser("target"), RelationshipType.blocked),
            (error) => (error as { code?: number }).code === DiscordApiErrors.MAXIMUM_FRIENDS.code,
        );

        assert.equal(create.mock.callCount(), 0);
        assert.equal(emitted.mock.callCount(), 0);
    });

    test("allows converting an existing relationship to blocked at the cap", async (t) => {
        const existingRelationship = fakeRelationship("existing-rel", "target", RelationshipType.outgoing);
        const emittedEvents: unknown[] = [];

        const create = t.mock.method(Relationship, "create", () => {
            throw new Error("should reuse the existing relationship row");
        });
        t.mock.method(Config, "get", () => ({ limits: { user: { maxFriends: 1 } } }) as ReturnType<typeof Config.get>);
        t.mock.method(User, "findOneOrFail", async () => fakeUser("actor", [existingRelationship]));
        t.mock.method(utilMock, "emitEvent", async (event: unknown) => {
            emittedEvents.push(event);
        });

        await updateRelationship("actor", relationshipUser("target"), RelationshipType.blocked);

        assert.equal(create.mock.callCount(), 0);
        assert.equal(existingRelationship.type, RelationshipType.blocked);
        assert.equal(existingRelationship.saveCalls, 1);
        assert.deepEqual(emittedEvents, [
            {
                event: "RELATIONSHIP_ADD",
                data: { id: "target", type: RelationshipType.blocked },
                user_id: "actor",
            },
        ]);
    });
});
