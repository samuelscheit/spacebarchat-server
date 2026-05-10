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

import { BaseEntity, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, RelationId } from "typeorm";
import { Application } from "./Application";
import { GiftCodeBatch } from "./GiftCodeBatch";

@Entity({
    name: "gift_codes",
})
@Index(["application_id"])
@Index(["batch_id"])
export class GiftCode extends BaseEntity {
    @PrimaryColumn()
    code: string;

    @Column({ type: "int8" })
    sku_id: string;

    @Column({ type: "int8" })
    @RelationId((giftCode: GiftCode) => giftCode.application)
    application_id: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application, {
        onDelete: "CASCADE",
    })
    application: Application;

    @Column({ nullable: true, type: "int8" })
    @RelationId((giftCode: GiftCode) => giftCode.batch)
    batch_id?: string | null;

    @JoinColumn({ name: "batch_id" })
    @ManyToOne(() => GiftCodeBatch, {
        onDelete: "CASCADE",
        nullable: true,
    })
    batch?: GiftCodeBatch | null;

    @Column({ type: "int", default: 0 })
    uses: number;

    @Column({ type: "int", default: 1 })
    max_uses: number;

    @Column({ nullable: true, type: Date })
    expires_at?: Date | null;

    @Column({ type: "varchar", array: true, nullable: true })
    entitlement_branches?: string[] | null;

    @Column({ nullable: true, type: "int" })
    gift_style?: number | null;
}
