import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import * as TJS from "typescript-json-schema";
import { ActivitySchema } from "./ActivitySchema";

type SchemaDefinition = {
    $ref?: string;
    enum?: unknown[];
    items?: SchemaDefinition;
    properties?: Record<string, SchemaDefinition>;
    required?: string[];
    type?: string;
};

const ActivitySchemaSourcePath = path.join(process.cwd(), "src", "schemas", "uncategorised", "ActivitySchema.ts");
const Schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), { encoding: "utf8" })) as Record<string, SchemaDefinition>;
const SchemaGeneratorSettings: TJS.PartialArgs = {
    required: true,
    ignoreErrors: true,
    excludePrivate: true,
    defaultNumberType: "integer",
    noExtraProps: true,
    defaultProps: false,
    typeOfKeyword: false,
};

function activityPayload(activity: object) {
    return {
        status: "online",
        activities: [
            {
                name: "Activity",
                ...activity,
            },
        ],
    };
}

function generatedActivitySchemaSymbols() {
    const generator = TJS.buildGenerator(TJS.programFromConfig(path.join(process.cwd(), "tsconfig.json"), [ActivitySchemaSourcePath]), SchemaGeneratorSettings);
    assert.ok(generator);
    return generator;
}

function sourceFileFor(symbol: TJS.SymbolRef) {
    const declaration = symbol.symbol.declarations?.[0];
    assert.ok(declaration);
    return path.relative(process.cwd(), declaration.getSourceFile().fileName).split(path.sep).join("/");
}

function property(schema: SchemaDefinition, name: string) {
    const value = schema.properties?.[name];
    assert.ok(value);
    return value;
}

describe("ActivitySchema", () => {
    test("accepts activity types from zero through five", () => {
        for (const type of [0, 1, 2, 3, 4, 5]) {
            assert.equal(instanceOf(ActivitySchema, activityPayload({ type })), true);
        }
    });

    test("rejects activity types outside zero through five", () => {
        for (const type of [-1, 6, 99]) {
            assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type })), /must be one of/);
        }
    });

    test("rejects non-integer numeric activity types", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 1.5 })), /must be one of/);
    });

    test("accepts absent party size", () => {
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, party: { id: "party-id" } })), true);
    });

    test("accepts party size with exactly two numbers", () => {
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, 5] } })), true);
    });

    test("rejects party size with the wrong length", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1] } })), /exactly 2 items/);
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, 2, 3] } })), /exactly 2 items/);
    });

    test("rejects party size with non-number entries", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, "many"] } })), /must be a number/);
    });

    test("rejects party size with null entries", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, null] } })), /is required/);
    });

    test("accepts runtime-optional activity fields omitted or partially populated", () => {
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0 })), true);
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, timestamps: { start: 1 } })), true);
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, emoji: {} })), true);
    });

    test("keeps Activity metadata aligned with runtime validation", () => {
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, metadata: { album_id: "album", artist_ids: ["artist"] } })), true);
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, metadata: { context_uri: "spotify:track:123" } })), /album_id is required/);
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, metadata: { album_id: "album" } })), /artist_ids is required/);
    });

    test("keeps generated ActivitySchema symbols owned by schemas instead of util entities", () => {
        const generator = generatedActivitySchemaSymbols();
        for (const name of ["ActivitySchema", "Activity", "ActivityType", "Status"]) {
            const symbols = generator.getSymbols(name);
            assert.equal(symbols.length, 1, name);
            assert.equal(sourceFileFor(symbols[0]), "src/schemas/uncategorised/ActivitySchema.ts", name);
        }
    });

    test("keeps generated ActivitySchema references local Activity and Status definitions", () => {
        assert.deepEqual(Schemas.ActivitySchema.properties?.status, { $ref: "#/definitions/Status" });
        assert.deepEqual(Schemas.ActivitySchema.properties?.activities, {
            type: "array",
            items: {
                $ref: "#/definitions/Activity",
            },
        });
        assert.deepEqual(Schemas.Status.enum?.toSorted(), ["dnd", "idle", "invisible", "offline", "online", "unknown"]);
        assert.deepEqual(Schemas.ActivityType.enum, [0, 1, 2, 3, 4, 5]);
        assert.deepEqual(Schemas.Activity.required?.toSorted(), ["name", "type"]);
        assert.equal(property(Schemas.Activity, "timestamps").required, undefined);
        assert.equal(property(Schemas.Activity, "emoji").required, undefined);
        assert.deepEqual(Object.keys(property(Schemas.Activity, "metadata").properties ?? {}).toSorted(), ["album_id", "artist_ids", "context_uri"]);
        assert.deepEqual(property(Schemas.Activity, "metadata").required?.toSorted(), ["album_id", "artist_ids"]);
    });
});
