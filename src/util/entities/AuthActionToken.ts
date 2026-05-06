/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors
	SPDX-License-Identifier: AGPL-3.0-only
*/

import { BaseEntity, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, RelationId } from "typeorm";
import { User } from "./User";

@Entity({
    name: "auth_action_tokens",
})
@Index(["user_id", "purpose"])
@Index(["expires_at"])
export class AuthActionToken extends BaseEntity {
    @PrimaryColumn()
    token_hash: string;

    @Column()
    @RelationId((token: AuthActionToken) => token.user)
    user_id: string;

    @JoinColumn({ name: "user_id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    user: User;

    @Column()
    purpose: string;

    @Column({ nullable: true })
    email?: string | null;

    @CreateDateColumn({ type: Date })
    created_at: Date;

    @Column({ type: Date })
    expires_at: Date;

    @Column({ nullable: true, type: Date })
    consumed_at?: Date | null;
}
