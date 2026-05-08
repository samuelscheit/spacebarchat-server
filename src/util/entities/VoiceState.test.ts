import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import { DataSource, getMetadataArgsStorage } from "typeorm";

type EntityExports = typeof import("./index");
type EntityClass = abstract new (...args: never[]) => unknown;

const localRequire = createRequire(__filename);
const schemasPath = localRequire.resolve("@spacebar/schemas");

const fallbackSchemaValue = new Proxy(Object.create(null), {
    get: (_target, property) => {
        if (property === Symbol.toPrimitive) return () => 0;
        if (property === "then") return undefined;
        if (property === "toString") return () => "0";
        if (property === "valueOf") return () => 0;
        return fallbackSchemaValue;
    },
});

const schemasMock = new Proxy(
    {
        ApplicationCommandType: { CHAT_INPUT: 1 },
        PublicVoiceStateProjection: [
            "user_id",
            "suppress",
            "session_id",
            "self_video",
            "self_mute",
            "self_deaf",
            "self_stream",
            "request_to_speak_timestamp",
            "mute",
            "deaf",
            "channel_id",
            "guild_id",
        ],
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

const entities = localRequire("./index") as EntityExports;
const { Guild, Member, VoiceState } = entities;

function isEntityClass(value: unknown): value is EntityClass {
    return typeof value === "function";
}

function registeredEntityClasses() {
    const registeredTargets = new Set(
        getMetadataArgsStorage()
            .tables.map((table) => table.target)
            .filter(isEntityClass),
    );

    return Object.values(entities as Record<string, unknown>).filter((entity): entity is EntityClass => isEntityClass(entity) && registeredTargets.has(entity));
}

describe("VoiceState entity metadata", () => {
    test("maps member through existing user and guild columns without replacing Guild.voice_states", async () => {
        const dataSource = new DataSource({
            type: "postgres",
            entities: registeredEntityClasses(),
        });
        await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

        const voiceStateMetadata = dataSource.getMetadata(VoiceState);
        const guildMetadata = dataSource.getMetadata(Guild);

        assert.equal(voiceStateMetadata.columns.filter((column) => column.databaseName === "user_id").length, 1);
        assert.equal(voiceStateMetadata.columns.filter((column) => column.databaseName === "guild_id").length, 1);

        const memberRelation = voiceStateMetadata.findRelationWithPropertyPath("member");
        assert.ok(memberRelation, "VoiceState.member relation should be registered");
        assert.equal(memberRelation.relationType, "many-to-one");
        assert.equal(memberRelation.inverseEntityMetadata.target, Member);
        assert.equal(memberRelation.createForeignKeyConstraints, false);
        assert.deepEqual(
            memberRelation.joinColumns.map((joinColumn) => ({
                name: joinColumn.databaseName,
                propertyName: joinColumn.propertyName,
                referencedColumnName: joinColumn.referencedColumn?.propertyName,
            })),
            [
                { name: "user_id", propertyName: "user_id", referencedColumnName: "id" },
                { name: "guild_id", propertyName: "guild_id", referencedColumnName: "guild_id" },
            ],
        );
        assert.equal(
            voiceStateMetadata.foreignKeys.some((foreignKey) => foreignKey.referencedEntityMetadata.target === Member),
            false,
            "VoiceState.member should not create schema-changing foreign keys",
        );
        const memberJoinQuery = dataSource.getRepository(VoiceState).createQueryBuilder("voice_state").leftJoinAndSelect("voice_state.member", "member").getQuery();
        assert.match(memberJoinQuery, /"member"\."id"="voice_state"\."user_id"/);
        assert.match(memberJoinQuery, /"member"\."guild_id"="voice_state"\."guild_id"/);

        const guildRelation = voiceStateMetadata.findRelationWithPropertyPath("guild");
        assert.ok(guildRelation, "VoiceState.guild relation should remain registered");
        assert.equal(guildRelation.relationType, "many-to-one");
        assert.deepEqual(
            guildRelation.joinColumns.map((joinColumn) => ({
                name: joinColumn.databaseName,
                referencedColumnName: joinColumn.referencedColumn?.propertyName,
            })),
            [{ name: "guild_id", referencedColumnName: "id" }],
        );

        const guildVoiceStatesRelation = guildMetadata.findRelationWithPropertyPath("voice_states");
        assert.ok(guildVoiceStatesRelation, "Guild.voice_states relation should remain registered");
        assert.equal(guildVoiceStatesRelation.relationType, "one-to-many");
        assert.equal(guildVoiceStatesRelation.inverseEntityMetadata.target, VoiceState);
        assert.equal(guildRelation.inverseRelation, guildVoiceStatesRelation);
        assert.equal(guildVoiceStatesRelation.inverseRelation, guildRelation);
    });
});
