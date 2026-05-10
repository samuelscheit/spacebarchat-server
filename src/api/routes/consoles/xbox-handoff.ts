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
import { ApiError, ConnectedAccount, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const XBOX_HANDOFF_CONNECTION_TYPE = "xbox";
export const XBOX_HANDOFF_UNSUPPORTED_MESSAGE = "Xbox voice handoff is not supported on this Spacebar instance.";

type XboxHandoffConnectedAccount = Pick<ConnectedAccount, "external_id" | "revoked">;

export async function getXboxHandoffConnectedAccounts(userId: string): Promise<XboxHandoffConnectedAccount[]> {
    return (await ConnectedAccount.find({
        where: {
            user_id: userId,
            type: XBOX_HANDOFF_CONNECTION_TYPE,
        },
        select: {
            external_id: true,
            revoked: true,
        },
        order: {
            external_id: "ASC",
        },
    })) as XboxHandoffConnectedAccount[];
}

export function assertHasActiveXboxHandoffAccount(accounts: XboxHandoffConnectedAccount[]): void {
    if (!accounts.length) throw DiscordApiErrors.UNKNOWN_CONNECTION;
    if (!accounts.some((account) => !account.revoked)) throw DiscordApiErrors.CONNECTION_REVOKED;
}

export function createXboxHandoffUnsupportedError(): ApiError {
    return new ApiError(XBOX_HANDOFF_UNSUPPORTED_MESSAGE, 0, 501);
}

router.get(
    "/",
    route({
        summary: "Get Xbox Handoff",
        responses: {
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, _res: Response) => {
        const accounts = await getXboxHandoffConnectedAccounts(req.user_id);
        assertHasActiveXboxHandoffAccount(accounts);

        // Spacebar does not have backing state to mint Discord/Xbox voice handoff
        // payloads. Return an explicit unsupported error instead of fabricating one.
        throw createXboxHandoffUnsupportedError();
    },
);

export default router;
