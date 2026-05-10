/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from "typeorm";
import { BaseClass } from "./BaseClass";
import { Channel } from "./Channel";

@Entity({
    name: "conversation_summaries",
})
@Index("IDX_conversation_summaries_channel_latest", ["channel_id", "id"])
export class ConversationSummary extends BaseClass {
    @Column({ type: "int8" })
    @RelationId((summary: ConversationSummary) => summary.channel)
    channel_id: string;

    @JoinColumn({ name: "channel_id" })
    @ManyToOne(() => Channel, {
        onDelete: "CASCADE",
    })
    channel: Channel;

    @Column()
    topic: string;

    @Column()
    summ_short: string;

    @Column({ type: "int8", array: true, default: () => "ARRAY[]::int8[]" })
    message_ids: string[];

    @Column({ type: "int8", array: true, default: () => "ARRAY[]::int8[]" })
    people: string[];

    @Column({ default: false })
    unsafe: boolean;

    @Column({ type: "int8" })
    start_id: string;

    @Column({ type: "int8" })
    end_id: string;

    @Column({ type: "int4" })
    count: number;

    @Column({ type: "int4" })
    source: number;

    @Column({ type: "int4" })
    type: number;
}
