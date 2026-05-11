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
    name: "application_store_assets",
})
@Index(["application_id"])
export class ApplicationStoreAsset extends BaseClass {
    @Column({ type: "int8" })
    @RelationId((asset: ApplicationStoreAsset) => asset.application)
    application_id: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application, {
        onDelete: "CASCADE",
    })
    application: Application;

    @Column({ type: "int" })
    size: number;

    @Column()
    mime_type: string;

    @Column()
    filename: string;

    @Column({ type: "int" })
    width: number;

    @Column({ type: "int" })
    height: number;
}
