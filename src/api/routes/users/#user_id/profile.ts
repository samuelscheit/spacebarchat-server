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

import { route } from "@spacebar/api";
import { Badge, Config, emitEvent, FieldErrors, handleFile, Member, profilePronouns, Relationship, User, UserUpdateEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In } from "typeorm";
import {
    PartialConnectedAccountResponse,
    PrivateUserProjection,
    PublicUser,
    PublicUserProjection,
    RelationshipType,
    type UserProfileResponse,
    UserProfileModifySchema,
} from "@spacebar/schemas";
import { getProfileGuildMember } from "../../../util/profileGuildMember.js";
import { earliestPremiumGuildSince, toMutualGuildResponses, toPartialConnectedAccountResponse, toProfileBadgeResponse } from "../../../util/userProfileResponse";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: { body: "UserProfileResponse" },
            403: { body: "APIErrorResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        if (req.params.user_id === "@me") req.params.user_id = req.user_id;

        const { guild_id, with_mutual_guilds, with_mutual_friends, with_mutual_friends_count } = req.query;
        const { user_id } = req.params as { [key: string]: string };
        const guildId = typeof guild_id == "string" ? guild_id : undefined;

        const user = await User.findOneOrFail({
            where: {
                id: user_id,
            },
            relations: { connected_accounts: true },
            select: {
                // Manually select everything cause typeorm is a fuck
                connected_accounts: {
                    id: true,
                    type: true,
                    name: true,
                    verified: true,
                    metadata_: true,
                    metadata_visibility: true,
                    visibility: true,
                },
            },
        });

        const mutual_guilds: NonNullable<UserProfileResponse["mutual_guilds"]> = [];
        const requested_member = await Member.find({
            where: { id: user_id },
            select: { guild_id: true, nick: true, premium_since: true },
        });
        const premium_guild_since = earliestPremiumGuildSince(requested_member);

        if (with_mutual_guilds == "true") {
            const self_member = await Member.find({
                where: { id: req.user_id },
                select: { guild_id: true },
            });

            mutual_guilds.push(...toMutualGuildResponses(requested_member, self_member));
        }

        const guild_member = await getProfileGuildMember(req.user_id, user_id, guildId);

        // TODO: make proper DTO's in util?

        const userProfile = {
            bio: req.user_bot ? null : user.bio,
            accent_color: user.accent_color,
            banner: user.banner,
            pronouns: profilePronouns(user.pronouns),
            theme_colors: user.theme_colors?.map((t) => Number(t)), // these are strings for some reason, they should be numbers
        };

        const guildMemberProfile: UserProfileResponse["guild_member_profile"] | undefined = guild_member
            ? {
                  accent_color: null,
                  banner: guild_member.banner || null,
                  bio: guild_member.bio || "",
                  guild_id: guild_member.guild_id,
              }
            : undefined;

        const badges = user.badge_ids?.length ? await Badge.find({ where: { id: In(user.badge_ids) } }) : [];

        let mutual_friends: PublicUser[] = [];
        let mutual_friends_count = 0;

        if (with_mutual_friends == "true" || with_mutual_friends_count == "true") {
            const relationshipsSelf = await Relationship.find({ where: { from_id: req.user_id, type: RelationshipType.friends } });
            const relationshipsUser = await Relationship.find({ where: { from_id: user_id, type: RelationshipType.friends } });
            const relationshipsIntersection = relationshipsSelf.filter((r1) => relationshipsUser.some((r2) => r2.to_id === r1.to_id));
            if (with_mutual_friends_count == "true") mutual_friends_count = relationshipsIntersection.length;
            if (with_mutual_friends == "true") {
                const users = await User.find({ where: { id: In(relationshipsIntersection.map((r) => r.to_id)) }, select: PublicUserProjection });
                mutual_friends = users.map((u) => u.toPublicUser());
            }
        }

        // Only expose public properties to response
        const publicUserConnections: PartialConnectedAccountResponse[] = user.connected_accounts.filter((x) => x.visibility != 0).map(toPartialConnectedAccountResponse);
        const profileBadges: UserProfileResponse["badges"] = badges.map(toProfileBadgeResponse);
        const guildBadges: UserProfileResponse["guild_badges"] = [];

        const response = {
            connected_accounts: publicUserConnections,
            premium_guild_since,
            premium_since: user.premium_since, // TODO
            mutual_guilds: with_mutual_guilds == "true" ? mutual_guilds : undefined, // TODO {id: "", nick: null} when ?with_mutual_guilds=true
            mutual_friends: with_mutual_friends == "true" ? mutual_friends : undefined,
            mutual_friends_count: with_mutual_friends_count == "true" ? mutual_friends_count : undefined,
            user: user.toPublicUser(),
            premium_type: user.premium_type,
            profile_themes_experiment_bucket: 4, // TODO: This doesn't make it available, for some reason?
            user_profile: userProfile,
            guild_member: guild_member ? { ...guild_member.toPublicMember(), user: user.toPublicUser() } : undefined,
            guild_member_profile: guildMemberProfile,
            badges: profileBadges,
            guild_badges: guildBadges,
        } satisfies UserProfileResponse;

        res.json(response);
    },
);

router.patch("/", route({ requestBody: "UserProfileModifySchema" }), async (req: Request, res: Response) => {
    const body = req.body as UserProfileModifySchema;

    if (body.banner) body.banner = await handleFile(`/banners/${req.user_id}`, body.banner as string);
    const user = await User.findOneOrFail({
        where: { id: req.user_id },
        select: [...PrivateUserProjection, "data"],
    });

    if (body.bio) {
        const { maxBio } = Config.get().limits.user;
        if (body.bio.length > maxBio) {
            throw FieldErrors({
                bio: {
                    code: "BIO_INVALID",
                    message: `Bio must be less than ${maxBio} in length`,
                },
            });
        }
    }

    user.assign(body);
    await user.save();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete user.data;

    // TODO: send update member list event in gateway
    await emitEvent({
        event: "USER_UPDATE",
        user_id: req.user_id,
        data: user,
    } satisfies UserUpdateEvent);

    res.json({
        accent_color: user.accent_color,
        bio: user.bio,
        banner: user.banner,
        theme_colors: user.theme_colors,
        pronouns: profilePronouns(user.pronouns),
    });
});

export default router;
