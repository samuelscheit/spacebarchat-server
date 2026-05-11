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

import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId, Unique } from "typeorm";
import { Application } from "./Application";
import { BaseClass } from "./BaseClass";
import { User } from "./User";

export enum ApplicationTesterState {
    INVITED = 1,
    ACCEPTED = 2,
}

@Entity({
    name: "application_testers",
})
@Index(["application_id"])
@Index(["user_id"])
@Unique("UQ_application_testers_application_id_user_id", ["application_id", "user_id"])
export class ApplicationTester extends BaseClass {
    @Column({ type: "int" })
    state: ApplicationTesterState = ApplicationTesterState.INVITED;

    @Column({ type: "int8" })
    @RelationId((tester: ApplicationTester) => tester.application)
    application_id: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application, {
        onDelete: "CASCADE",
    })
    application: Application;

    @Column({ type: "int8" })
    @RelationId((tester: ApplicationTester) => tester.user)
    user_id: string;

    @JoinColumn({ name: "user_id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    user: User;
}
