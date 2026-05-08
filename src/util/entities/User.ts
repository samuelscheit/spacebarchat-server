/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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

import { Request } from "express";
import { Column, Entity, EntityManager, JoinColumn, OneToMany, OneToOne } from "typeorm";
import {
    Channel,
    Config,
    emailAlreadyRegisteredFieldError,
    Email,
    FieldErrors,
    getDefaultUserRights,
    isNormalizedEmailUniqueViolation,
    normalizeOptionalEmail,
    Snowflake,
    trimSpecial,
} from "..";
import { bigintNumberTransformer, Random } from "../util";
import { profilePronouns } from "../util/UserProfile";
import { BaseClass } from "./BaseClass";
import { ConnectedAccount } from "./ConnectedAccount";
import { Member } from "./Member";
import { Relationship } from "./Relationship";
import { SecurityKey } from "./SecurityKey";
import { Session } from "./Session";
import { UserSettings } from "./UserSettings";
import { UserRecentAvatar } from "./UserRecentAvatar";
import {
    AvatarDecorationData,
    ChannelType,
    Collectibles,
    DisplayNameStyle,
    PrimaryGuild,
    PrivateUserProjection,
    PublicUser,
    PublicUserProjection,
    UserPrivate,
} from "@spacebar/schemas";
import { JsonNumber } from "../util/Decorators";

@Entity({
    name: "users",
})
export class User extends BaseClass {
    static readonly nsfwAllowedAge = 18;
    private static readonly dateOfBirthPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

    @Column()
    username: string; // username max length 32, min 2 (should be configurable)

    @Column()
    discriminator: string; // opaque string: 4 digits on discord.com

    @Column({ nullable: true })
    avatar?: string; // hash of the user avatar

    @Column({ nullable: true })
    accent_color?: number; // banner color of user

    @Column({ nullable: true })
    banner?: string; // hash of the user banner

    // TODO: Separate `User` and `UserProfile` models
    // puyo: changed from [number, number] because it breaks openapi
    @Column({ nullable: true, type: "int4", array: true })
    theme_colors?: number[];

    @Column({ nullable: true })
    pronouns?: string;

    @Column({ nullable: true, select: false })
    phone?: string; // phone number of the user

    @Column({ select: false })
    desktop: boolean = false; // if the user has desktop app installed

    @Column({ select: false })
    mobile: boolean = false; // if the user has mobile app installed

    @Column()
    premium: boolean; // if user bought individual premium

    @Column()
    premium_type: number; // individual premium level

    @Column()
    bot: boolean = false; // if user is bot

    @Column()
    bio: string = ""; // short description of the user

    @Column()
    system: boolean = false; // shouldn't be used, the api sends this field type true, if the generated message comes from a system generated author

    @Column({ select: false })
    nsfw_allowed: boolean = true; // if the user can do age-restricted actions (NSFW channels/guilds/commands)

    @Column({ select: false })
    mfa_enabled: boolean = false; // if multi factor authentication is enabled

    @Column({ select: false, default: false })
    webauthn_enabled: boolean = false; // if webauthn multi factor authentication is enabled

    @Column({ select: false, nullable: true })
    totp_secret?: string = "";

    @Column({ nullable: true, select: false })
    totp_last_ticket?: string = "";

    @Column()
    created_at: Date; // registration date

    @Column({ nullable: true, type: Date })
    premium_since?: Date | null; // premium date

    @Column({ select: false })
    verified: boolean; // email is verified

    @Column()
    disabled: boolean = false; // if the account is disabled

    @Column()
    deleted: boolean = false; // if the user was deleted

    @Column({ nullable: true, select: false })
    email?: string; // email of the user

    @Column({ type: "bigint", transformer: bigintNumberTransformer })
    @JsonNumber
    flags: number = 0; // Discord-compatible user flag bitfield; see UserFlags in @spacebar/schemas.

    @Column({ type: "bigint", transformer: bigintNumberTransformer })
    @JsonNumber
    public_flags: number = 0;

    @Column({ type: "bigint", transformer: bigintNumberTransformer })
    @JsonNumber
    purchased_flags: number = 0;

    @Column()
    premium_usage_flags: number = 0;

    @Column({ type: "bigint" })
    @JsonNumber
    rights: string;

    @OneToMany(() => Session, (session: Session) => session.user)
    sessions: Session[];

    @JoinColumn({ name: "relationship_ids" })
    @OneToMany(() => Relationship, (relationship: Relationship) => relationship.from, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    relationships: Relationship[];

    @JoinColumn({ name: "connected_account_ids" })
    @OneToMany(() => ConnectedAccount, (account: ConnectedAccount) => account.user, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    connected_accounts: ConnectedAccount[];

    @Column({ type: "jsonb", select: false })
    data: {
        valid_tokens_since: Date; // all tokens with a previous issue date are invalid
        hash?: string; // hash of the password, salt is saved in password (bcrypt)
    };

    @Column({ type: "varchar", array: true, select: false })
    fingerprints: string[] = []; // array of fingerprints -> used to prevent multiple accounts

    @OneToOne(() => UserSettings, {
        cascade: true,
        orphanedRowAction: "delete",
        nullable: true,
    })
    @JoinColumn()
    settings?: UserSettings;

    @OneToMany(() => SecurityKey, (key: SecurityKey) => key.user)
    security_keys: SecurityKey[];

    @OneToMany(() => UserRecentAvatar, (avatar: UserRecentAvatar) => avatar.user)
    recent_avatars: UserRecentAvatar[];

    @Column({ type: "varchar", array: true, nullable: true })
    badge_ids?: string[];

    @Column({ type: "jsonb", nullable: true })
    avatar_decoration_data?: AvatarDecorationData;

    @Column({ type: "jsonb", nullable: true })
    display_name_styles?: DisplayNameStyle;

    @Column({ type: "jsonb", nullable: true })
    collectibles?: Collectibles;

    @Column({ type: "jsonb", nullable: true })
    primary_guild?: PrimaryGuild;

    // TODO: I don't like this method?
    validate() {
        if (this.discriminator) {
            const discrim = Number(this.discriminator);
            if (isNaN(discrim) || !Number.isInteger(discrim) || discrim <= 0 || discrim >= 10000)
                throw FieldErrors({
                    discriminator: {
                        message: "Discriminator must be a number.",
                        code: "DISCRIMINATOR_INVALID",
                    },
                });

            this.discriminator = discrim.toString().padStart(4, "0");
        }
    }

    toPublicUser() {
        this.clean_data();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user: any = {};
        PublicUserProjection.forEach((x) => {
            user[x] = this[x];
        });
        user.pronouns = profilePronouns(this.pronouns);
        return user as PublicUser;
    }

    toPrivateUser(extraFields: (keyof User)[] = []) {
        this.clean_data();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user: any = {};
        [...PrivateUserProjection, ...extraFields].forEach((x) => {
            user[x] = this[x];
        });
        user.pronouns = profilePronouns(this.pronouns);
        return user as UserPrivate;
    }

    static async getPublicUser(user_id: string, manager?: EntityManager): Promise<PublicUser> {
        const userRepository = manager?.getRepository(User) ?? User.getRepository();
        const user = await userRepository.findOneOrFail({
            where: { id: user_id },
            select: PublicUserProjection,
        });
        return user.toPublicUser();
    }

    public static async generateDiscriminator(username: string, manager?: EntityManager): Promise<string | undefined> {
        const userRepository = manager?.getRepository(User) ?? User.getRepository();

        if (Config.get().register.incrementingDiscriminators) {
            // discriminator will be incrementally generated

            // First we need to figure out the currently highest discrimnator for the given username and then increment it
            const users = await userRepository.find({
                where: { username },
                select: { discriminator: true },
            });
            const highestDiscriminator = Math.max(0, ...users.map((u) => Number(u.discriminator)));

            const discriminator = highestDiscriminator + 1;
            if (discriminator >= 10000) {
                return undefined;
            }

            return discriminator.toString().padStart(4, "0");
        } else {
            // discriminator will be randomly generated

            // randomly generates a discriminator between 1 and 9999 and checks max five times if it already exists
            // TODO: is there any better way to generate a random discriminator only once, without checking if it already exists in the database?
            const takenDiscriminators = (await userRepository.find({ where: { username }, select: { discriminator: true } })).map((x) => x.discriminator);
            if (takenDiscriminators.length >= 9999) return undefined;

            for (let tries = 0; tries < 15; tries++) {
                const discriminator = Random.nextInt(1, 9999).toString().padStart(4, "0");
                if (!takenDiscriminators.includes(discriminator)) return discriminator;
            }

            return undefined;
        }
    }

    public get tag(): string {
        //const { uniqueUsernames } = Config.get().general;
        const uniqueUsernames = false;

        return uniqueUsernames ? this.username : `${this.username}#${this.discriminator}`;
    }

    private static parseDateOfBirth(dateOfBirth: Date | string) {
        if (dateOfBirth instanceof Date) {
            if (Number.isNaN(dateOfBirth.getTime())) return undefined;

            return {
                day: dateOfBirth.getUTCDate(),
                month: dateOfBirth.getUTCMonth(),
                year: dateOfBirth.getUTCFullYear(),
            };
        }

        const match = User.dateOfBirthPattern.exec(dateOfBirth);
        if (!match) return undefined;

        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const normalized = new Date(Date.UTC(year, month, day));
        if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month || normalized.getUTCDate() !== day) {
            return undefined;
        }

        return { day, month, year };
    }

    static isValidDateOfBirth(dateOfBirth: Date | string) {
        return User.parseDateOfBirth(dateOfBirth) !== undefined;
    }

    static hasReachedAge(dateOfBirth: Date | string, age: number, now = new Date()) {
        if (!Number.isFinite(age) || age < 0 || Number.isNaN(now.getTime())) return false;

        const birthday = User.parseDateOfBirth(dateOfBirth);
        if (!birthday) return false;

        const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const requiredBirthday = Date.UTC(birthday.year + age, birthday.month, birthday.day);
        return requiredBirthday <= today;
    }

    static isAdult(dateOfBirth: Date | string, now = new Date()) {
        return User.hasReachedAge(dateOfBirth, User.nsfwAllowedAge, now);
    }

    static async register({
        email,
        username,
        password,
        date_of_birth,
        id,
        req,
        bot,
        manager,
        emitSideEffects = true,
    }: {
        username: string;
        password?: string;
        email?: string;
        date_of_birth?: Date | string | null; // "2000-04-03"
        id?: string;
        req?: Request;
        bot?: boolean;
        manager?: EntityManager;
        emitSideEffects?: boolean;
    }) {
        // trim special utf8 control characters -> Backspace, Newline, ...
        username = trimSpecial(username);
        email = normalizeOptionalEmail(email);

        const userRepository = manager?.getRepository(User) ?? User.getRepository();
        const settingsRepository = manager?.getRepository(UserSettings) ?? UserSettings.getRepository();

        const discriminator = await User.generateDiscriminator(username, manager);
        if (!discriminator) {
            // We've failed to generate a valid and unused discriminator
            throw FieldErrors({
                username: {
                    code: "USERNAME_TOO_MANY_USERS",
                    message: req?.t("auth:register.USERNAME_TOO_MANY_USERS") || "",
                },
            });
        }

        const language = req?.language === "en" ? "en-US" : req?.language || "en-US";
        const nsfwAllowed = date_of_birth == null ? true : User.isAdult(date_of_birth);

        const settings = settingsRepository.create({
            locale: language,
        });

        const user = userRepository.create({
            username: username,
            discriminator,
            id: id || Snowflake.generate(),
            email: email,
            data: {
                hash: password,
                valid_tokens_since: new Date(),
            },
            settings: settings,

            premium_since: Config.get().defaults.user.premium ? new Date() : undefined,
            rights: getDefaultUserRights(bot, Config.get().register),
            premium: Config.get().defaults.user.premium ?? false,
            premium_type: Config.get().defaults.user.premiumType ?? 0,
            verified: Config.get().defaults.user.verified ?? true,
            created_at: new Date(),
            bot: !!bot,
            nsfw_allowed: nsfwAllowed,
        });

        user.validate();
        try {
            await userRepository.save(user);
        } catch (error) {
            if (isNormalizedEmailUniqueViolation(error)) {
                throw emailAlreadyRegisteredFieldError(req?.t("auth:register.EMAIL_ALREADY_REGISTERED"));
            }
            throw error;
        }

        if (emitSideEffects) {
            await User.runRegistrationSideEffects(user, { email, bot });
        }

        return user;
    }

    static async runRegistrationSideEffects(user: User, options: { email?: string; bot?: boolean }) {
        // send verification email if users aren't verified by default and we have an email
        if (!Config.get().defaults.user.verified && options.email) {
            await Email.sendVerifyEmail(user, options.email).catch((e) => {
                console.error(`Failed to send verification email to ${user.tag}: ${e}`);
            });
        }

        setImmediate(async () => {
            if (options.bot) {
                const { guild } = Config.get();
                if (!guild.autoJoin.bots) {
                    return;
                }
            }
            if (Config.get().guild.autoJoin.enabled) {
                for (const guild of Config.get().guild.autoJoin.guilds || []) {
                    await Member.addToGuild(user.id, guild).catch((e) => console.error("[Autojoin]", e));
                }
            }
        });
    }

    async getDmChannelWith(user_id: string) {
        const user_ids = [...new Set([this.id, user_id])];
        const qry = await Channel.getRepository()
            .createQueryBuilder("channel")
            .innerJoin("channel.recipients", "matchedRecipient", "matchedRecipient.user_id IN (:...user_ids)", { user_ids })
            .where("channel.type = :type", { type: ChannelType.DM })
            .andWhere((qb) => {
                const recipientCount = qb.subQuery().select("COUNT(*)").from("recipients", "recipient").where("recipient.channel_id = channel.id").getQuery();
                return `${recipientCount} = :recipientCount`;
            })
            .groupBy("channel.id")
            .having("COUNT(DISTINCT matchedRecipient.user_id) = :recipientCount", { recipientCount: user_ids.length })
            .getMany();

        // Emma [it/its]@Rory&: is this technically a bug, or am I being too over-cautious?
        if (qry.length > 1) {
            console.warn(`[WARN] User(${this.id})#getDmChannel(${user_id}) returned multiple channels:`);
            for (const channel of qry) {
                console.warn(JSON.stringify(channel));
            }
            throw new Error("Array contains more than one matching element");
        }

        return qry[0];
    }

    async getDmChannels() {
        const qry = await Channel.getRepository()
            .createQueryBuilder("channel")
            .innerJoin("channel.recipients", "recipient", "recipient.user_id = :user_id", { user_id: this.id })
            .where("channel.type = :type", { type: ChannelType.DM })
            .getMany();

        return qry;
    }
}
