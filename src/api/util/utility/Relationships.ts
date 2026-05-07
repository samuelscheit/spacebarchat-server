/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { PublicUserProjection, RelationshipType } from "@spacebar/schemas";
import { Config, DiscordApiErrors, Relationship, RelationshipAddEvent, RelationshipRemoveEvent, User, emitEvent } from "@spacebar/util";
import { HTTPError } from "lambert-server";

export const relationshipUserProjection: (keyof User)[] = ["relationships", ...PublicUserProjection];

export interface UpdateRelationshipOptions {
    directFriendship?: boolean;
}

export async function updateRelationship(user_id: string, friend: User, type: RelationshipType, options: UpdateRelationshipOptions = {}): Promise<void> {
    const id = friend.id;
    if (id === user_id) throw new HTTPError("You can't add yourself as a friend");

    const user = await User.findOneOrFail({
        where: { id: user_id },
        relations: { relationships: { to: true } },
        select: relationshipUserProjection,
    });

    let relationship = user.relationships.find((x) => x.to_id === id);
    const friendRequest = friend.relationships.find((x) => x.to_id === user_id);

    // TODO: you can add infinitely many blocked users (should this be prevented?)
    if (type === RelationshipType.blocked) {
        if (relationship) {
            if (relationship.type === RelationshipType.blocked) throw new HTTPError("You already blocked the user");
            relationship.type = RelationshipType.blocked;
            await relationship.save();
        } else {
            relationship = await Relationship.create({
                to_id: id,
                type: RelationshipType.blocked,
                from_id: user_id,
            }).save();
        }

        if (friendRequest && friendRequest.type !== RelationshipType.blocked) {
            await Promise.all([
                Relationship.delete({ id: friendRequest.id }),
                emitEvent({
                    event: "RELATIONSHIP_REMOVE",
                    data: friendRequest.toPublicRelationship(),
                    user_id: id,
                } satisfies RelationshipRemoveEvent),
            ]);
        }

        await emitEvent({
            event: "RELATIONSHIP_ADD",
            data: relationship.toPublicRelationship(),
            user_id,
        } satisfies RelationshipAddEvent);

        return;
    }

    const { maxFriends } = Config.get().limits.user;
    if (user.relationships.length >= maxFriends) throw DiscordApiErrors.MAXIMUM_FRIENDS.withParams(maxFriends);

    const initialIncomingType = options.directFriendship ? RelationshipType.friends : RelationshipType.incoming;
    const initialOutgoingType = options.directFriendship ? RelationshipType.friends : RelationshipType.outgoing;

    let incoming_relationship = Relationship.create({
        nickname: undefined,
        type: initialIncomingType,
        to: user,
        from: friend,
    });
    let outgoing_relationship = Relationship.create({
        nickname: undefined,
        type: initialOutgoingType,
        to: friend,
        from: user,
    });

    if (friendRequest) {
        if (friendRequest.type === RelationshipType.blocked) throw new HTTPError("The user blocked you");
        if (friendRequest.type === RelationshipType.friends) throw new HTTPError("You are already friends with the user");
        // accept friend request
        incoming_relationship = friendRequest;
        incoming_relationship.type = RelationshipType.friends;
    }

    if (relationship) {
        if (relationship.type === RelationshipType.outgoing && !options.directFriendship) throw new HTTPError("You already sent a friend request");
        if (relationship.type === RelationshipType.blocked) throw new HTTPError("Unblock the user before sending a friend request");
        if (relationship.type === RelationshipType.friends) throw new HTTPError("You are already friends with the user");
        outgoing_relationship = relationship;
        outgoing_relationship.type = RelationshipType.friends;
    }

    await Promise.all([
        incoming_relationship.save(),
        outgoing_relationship.save(),
        emitEvent({
            event: "RELATIONSHIP_ADD",
            data: outgoing_relationship.toPublicRelationship(),
            user_id,
        } satisfies RelationshipAddEvent),
        emitEvent({
            event: "RELATIONSHIP_ADD",
            data: {
                ...incoming_relationship.toPublicRelationship(),
                should_notify: true,
            },
            user_id: id,
        } satisfies RelationshipAddEvent),
    ]);
}
