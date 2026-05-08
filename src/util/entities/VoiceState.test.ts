import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";

type GuildClass = typeof import("./Guild").Guild;
type MemberClass = typeof import("./Member").Member;
type VoiceStateClass = typeof import("./VoiceState").VoiceState;
type InverseSideProperty = string | ((object: Record<string, unknown>) => unknown);

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

const { Guild } = localRequire("./Guild") as { Guild: GuildClass };
const { Member } = localRequire("./Member") as { Member: MemberClass };
const { VoiceState } = localRequire("./VoiceState") as { VoiceState: VoiceStateClass };

function resolveRelationTarget(target: unknown) {
    if (typeof target !== "function") return target;
    if (Function.prototype.toString.call(target).startsWith("class ")) return target;
    return (target as () => unknown)();
}

function resolveInverseSideProperty(inverseSideProperty: InverseSideProperty | undefined) {
    if (typeof inverseSideProperty !== "function") return inverseSideProperty;

    let selectedProperty: string | undefined;
    inverseSideProperty(
        new Proxy(Object.create(null), {
            get: (_target, property) => {
                selectedProperty = String(property);
                return undefined;
            },
        }),
    );
    return selectedProperty;
}

describe("VoiceState entity metadata", () => {
    test("maps member through existing user and guild columns without replacing Guild.voice_states", () => {
        const metadata = getMetadataArgsStorage();
        const voiceStateRelations = metadata.relations.filter((relation) => relation.target === VoiceState);
        const voiceStateJoinColumns = metadata.joinColumns.filter((joinColumn) => joinColumn.target === VoiceState);

        const memberRelation = voiceStateRelations.find((relation) => relation.propertyName === "member");
        assert.ok(memberRelation, "VoiceState.member relation should be registered");
        assert.equal(memberRelation.relationType, "many-to-one");
        assert.equal(resolveRelationTarget(memberRelation.type), Member);
        assert.deepEqual(memberRelation.options, {
            createForeignKeyConstraints: false,
        });

        const memberJoinColumns = voiceStateJoinColumns.filter((joinColumn) => joinColumn.propertyName === "member");
        assert.deepEqual(
            memberJoinColumns.map((joinColumn) => ({
                name: joinColumn.name,
                referencedColumnName: joinColumn.referencedColumnName,
            })),
            [
                { name: "user_id", referencedColumnName: "id" },
                { name: "guild_id", referencedColumnName: "guild_id" },
            ],
        );

        const guildRelation = voiceStateRelations.find((relation) => relation.propertyName === "guild");
        assert.ok(guildRelation, "VoiceState.guild relation should remain registered");
        assert.equal(guildRelation.relationType, "many-to-one");
        assert.equal(resolveInverseSideProperty(guildRelation.inverseSideProperty), "voice_states");

        const guildJoinColumn = voiceStateJoinColumns.find((joinColumn) => joinColumn.propertyName === "guild");
        assert.equal(guildJoinColumn?.name, "guild_id");

        const guildVoiceStatesRelation = metadata.relations.find((relation) => relation.target === Guild && relation.propertyName === "voice_states");
        assert.ok(guildVoiceStatesRelation, "Guild.voice_states relation should remain registered");
        assert.equal(guildVoiceStatesRelation.relationType, "one-to-many");
        assert.equal(resolveRelationTarget(guildVoiceStatesRelation.type), VoiceState);
        assert.equal(resolveInverseSideProperty(guildVoiceStatesRelation.inverseSideProperty), "guild");
    });
});
