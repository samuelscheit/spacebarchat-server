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
import { Application } from "./Application";
import { BaseClass } from "./BaseClass";

@Entity({
    name: "gift_code_batches",
})
@Index(["application_id"])
export class GiftCodeBatch extends BaseClass {
    @Column({ type: "int8" })
    @RelationId((batch: GiftCodeBatch) => batch.application)
    application_id: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application, {
        onDelete: "CASCADE",
    })
    application: Application;

    @Column({ type: "int8" })
    sku_id: string;

    @Column({ type: "int" })
    amount: number;

    @Column({ nullable: true })
    description?: string | null;

    @Column({ type: "varchar", array: true, nullable: true })
    entitlement_branches?: string[] | null;

    @Column({ nullable: true, type: Date })
    entitlement_starts_at?: Date | null;

    @Column({ nullable: true, type: Date })
    entitlement_ends_at?: Date | null;
}
