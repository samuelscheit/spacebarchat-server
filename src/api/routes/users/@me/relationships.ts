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

import { relationshipUserProjection, route, updateRelationship } from "@spacebar/api";
import { ApiError, Relationship, RelationshipRemoveEvent, RelationshipUpdateEvent, User, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { RelationshipType, RelationshipPatchSchema } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

export const USER_BULK_RELATIONSHIPS_PUT_UNSUPPORTED_MESSAGE = "Bulk relationship replacement is not supported on this Spacebar instance.";

export function createUserBulkRelationshipsPutUnsupportedError(): ApiError {
    return new ApiError(USER_BULK_RELATIONSHIPS_PUT_UNSUPPORTED_MESSAGE, 0, 501);
}

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "UserRelationshipsResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const user = await User.findOneOrFail({
            where: { id: req.user_id },
            relations: { relationships: { to: true } },
            select: { id: true, relationships: true },
        });

        const related_users = user.relationships.map((r) => r.toPublicRelationship());
        return res.json(related_users);
    },
);

router.put(
    "/bulk",
    route({
        summary: "Bulk Replace Relationships",
        description:
            "Registers Discord client's PUT /users/@me/relationships/bulk route without mutating local relationship state. The only local evidence for PUT is the xHyroM client route catalog, while public Userdoccers source documents POST contact-sync bulk add for this path, so Spacebar fails closed instead of creating, deleting, or rewriting relationships.",
        responses: {
            401: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (_req: Request, _res: Response) => {
        throw createUserBulkRelationshipsPutUnsupportedError();
    },
);

router.put(
    "/:user_id",
    route({
        requestBody: "RelationshipPutSchema",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        await updateRelationship(
            req.user_id,
            await User.findOneOrFail({
                where: { id: req.params.user_id as string },
                relations: { relationships: { to: true } },
                select: relationshipUserProjection,
            }),
            req.body.type ?? RelationshipType.friends,
        );
        return res.sendStatus(204);
    },
);

router.patch(
    "/:user_id",
    route({
        requestBody: "RelationshipPatchSchema",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as RelationshipPatchSchema;
        const rel = await Relationship.findOneOrFail({
            where: {
                from_id: req.user_id,
                to_id: req.params.user_id as string,
            },
            relations: {
                to: true,
            },
        });
        rel.nickname = body.nickname;
        await Promise.all([
            emitEvent({
                event: "RELATIONSHIP_UPDATE",
                data: {
                    ...rel.toPublicRelationship(),
                    should_notify: true,
                },
                user_id: req.user_id,
            } satisfies RelationshipUpdateEvent),
            rel.save(),
        ]);
        res.sendStatus(204);
    },
);

router.post(
    "/",
    route({
        requestBody: "RelationshipPostSchema",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        await updateRelationship(
            req.user_id,
            await User.findOneOrFail({
                relations: { relationships: { to: true } },
                select: relationshipUserProjection,
                where: {
                    discriminator: String(req.body.discriminator).padStart(4, "0"), //Discord send the discriminator as integer, we need to add leading zeroes
                    username: req.body.username,
                },
            }),
            req.body.type,
        );
        return res.sendStatus(204);
    },
);

router.delete(
    "/:user_id",
    route({
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { user_id } = req.params as { [key: string]: string };
        if (user_id === req.user_id) throw new HTTPError("You can't remove yourself as a friend");

        const user = await User.findOneOrFail({
            where: { id: req.user_id },
            select: relationshipUserProjection,
            relations: { relationships: { to: true } },
        });
        const friend = await User.findOneOrFail({
            where: { id: user_id },
            select: relationshipUserProjection,
            relations: { relationships: { to: true } },
        });

        const relationship = user.relationships.find((x) => x.to_id === user_id);
        const friendRequest = friend.relationships.find((x) => x.to_id === req.user_id);

        if (!relationship) throw new HTTPError("You are not friends with the user", 404);

        if (relationship?.type === RelationshipType.blocked) {
            // unblock user
            await Promise.all([
                Relationship.delete({ id: relationship.id }),
                emitEvent({
                    event: "RELATIONSHIP_REMOVE",
                    user_id: req.user_id,
                    data: relationship.toPublicRelationship(),
                } satisfies RelationshipRemoveEvent),
            ]);
            return res.sendStatus(204);
        }
        if (friendRequest && friendRequest.type !== RelationshipType.blocked) {
            await Promise.all([
                Relationship.delete({ id: friendRequest.id }),
                await emitEvent({
                    event: "RELATIONSHIP_REMOVE",
                    data: friendRequest.toPublicRelationship(),
                    user_id: user_id,
                } satisfies RelationshipRemoveEvent),
            ]);
        }

        await Promise.all([
            Relationship.delete({ id: relationship.id }),
            emitEvent({
                event: "RELATIONSHIP_REMOVE",
                data: relationship.toPublicRelationship(),
                user_id: req.user_id,
            } satisfies RelationshipRemoveEvent),
        ]);

        return res.sendStatus(204);
    },
);

export default router;
