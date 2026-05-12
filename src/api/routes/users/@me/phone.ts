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

import { route } from "@spacebar/api";
import { PrivateUserProjection, type UserPhoneRemoveSchema } from "@spacebar/schemas";
import { emitEvent, FieldErrors, User, type UserUpdateEvent } from "@spacebar/util";
import bcrypt from "bcrypt";
import { Request, Response, Router } from "express";

export type CurrentUserPhoneRemovalRecord = User & { data: { hash?: string } };

export interface RemoveCurrentUserPhoneOptions {
    invalidPasswordMessage: string;
}

export interface RemoveCurrentUserPhoneDependencies {
    findUser(userId: string): Promise<CurrentUserPhoneRemovalRecord>;
    comparePassword(password: string, hash: string): Promise<boolean>;
    hashPassword(password: string): Promise<string>;
    emitUserUpdate(userId: string, user: CurrentUserPhoneRemovalRecord): Promise<void>;
}

const defaultRemoveCurrentUserPhoneDependencies: RemoveCurrentUserPhoneDependencies = {
    async findUser(userId) {
        return (await User.findOneOrFail({
            where: { id: userId },
            select: [...PrivateUserProjection, "data"],
        })) as CurrentUserPhoneRemovalRecord;
    },
    comparePassword: (password, hash) => bcrypt.compare(password, hash),
    hashPassword: (password) => bcrypt.hash(password, 12),
    emitUserUpdate: (userId, user) =>
        emitEvent({
            event: "USER_UPDATE",
            user_id: userId,
            data: user,
        } satisfies UserUpdateEvent),
};

function invalidPasswordFieldError(message: string) {
    return FieldErrors({
        password: {
            message,
            code: "INVALID_PASSWORD",
        },
    });
}

export async function removeCurrentUserPhone(
    userId: string,
    body: UserPhoneRemoveSchema,
    options: RemoveCurrentUserPhoneOptions,
    deps: RemoveCurrentUserPhoneDependencies = defaultRemoveCurrentUserPhoneDependencies,
) {
    const user = await deps.findUser(userId);

    if (user.data.hash) {
        if (!(await deps.comparePassword(body.password, user.data.hash))) {
            throw invalidPasswordFieldError(options.invalidPasswordMessage);
        }
    } else {
        user.data.hash = await deps.hashPassword(body.password);
    }

    user.assign({ phone: null });
    await user.save();

    // The private data bag contains password hashes and must not be emitted.
    delete (user as { data?: unknown }).data;
    await deps.emitUserUpdate(userId, user);
}

export function createCurrentUserPhoneRouter(deps: RemoveCurrentUserPhoneDependencies = defaultRemoveCurrentUserPhoneDependencies) {
    const router = Router({ mergeParams: true });

    router.delete(
        "/",
        route({
            summary: "Remove Phone Number",
            requestBody: "UserPhoneRemoveSchema",
            event: "USER_UPDATE",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            await removeCurrentUserPhone(
                req.user_id,
                req.body as UserPhoneRemoveSchema,
                {
                    invalidPasswordMessage: req.t("auth:login.INVALID_PASSWORD"),
                },
                deps,
            );

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createCurrentUserPhoneRouter();
