import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from "typeorm";
import { StageInstancePrivacyLevel, StageInstanceResponse } from "@spacebar/schemas";
import { BaseClass } from "./BaseClass";
import { Channel } from "./Channel";
import { Guild } from "./Guild";

@Entity({
    name: "stage_instances",
})
@Index(["channel_id"], { unique: true })
export class StageInstance extends BaseClass {
    @Column({ type: "int8" })
    @RelationId((stageInstance: StageInstance) => stageInstance.guild)
    guild_id: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, {
        onDelete: "CASCADE",
    })
    guild: Guild;

    @Column({ type: "int8" })
    @RelationId((stageInstance: StageInstance) => stageInstance.channel)
    channel_id: string;

    @JoinColumn({ name: "channel_id" })
    @ManyToOne(() => Channel, {
        onDelete: "CASCADE",
    })
    channel: Channel;

    @Column({ length: 120 })
    topic: string;

    @Column({ type: "int" })
    privacy_level: StageInstancePrivacyLevel;

    @Column({ default: false })
    discoverable_disabled: boolean = false;

    @Column({ type: "int8", nullable: true })
    guild_scheduled_event_id?: string | null;

    toPublicStageInstance(): StageInstanceResponse {
        return {
            id: this.id,
            guild_id: this.guild_id,
            channel_id: this.channel_id,
            topic: this.topic,
            privacy_level: this.privacy_level,
            discoverable_disabled: this.discoverable_disabled,
            guild_scheduled_event_id: this.guild_scheduled_event_id ?? null,
        };
    }
}
