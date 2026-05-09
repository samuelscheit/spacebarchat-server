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
import { ApiError, ConnectedAccount, ConnectionStore, DiscordApiErrors, FieldErrors, RefreshableConnection } from "@spacebar/util";
import { Request, Response, Router } from "express";
const router = Router({ mergeParams: true });

export const ACCESS_TOKEN_SUPPORTED_CONNECTIONS = ["twitch", "youtube"] as const;

// Discord also exposes this endpoint for Spotify, but the local Spotify connection
// disables token refresh because it cannot currently be used reliably.
export const ACCESS_TOKEN_DISABLED_CONNECTIONS = ["spotify"] as const;

export function isAccessTokenSupportedConnection(connectionName: string): boolean {
    return ACCESS_TOKEN_SUPPORTED_CONNECTIONS.includes(connectionName as (typeof ACCESS_TOKEN_SUPPORTED_CONNECTIONS)[number]);
}

export function getAccessTokenSupportedConnectionTypes(): string {
    return ACCESS_TOKEN_SUPPORTED_CONNECTIONS.join(", ");
}

// NOTE: this route has not been extensively tested, as the required connections are not implemented as of writing
router.get("/", route({}), async (req: Request, res: Response) => {
    const { connection_name, connection_id } = req.params as { [key: string]: string };

    const connection = ConnectionStore.connections.get(connection_name);

    if (!isAccessTokenSupportedConnection(connection_name) || !connection)
        throw FieldErrors({
            provider_id: {
                code: "BASE_TYPE_CHOICES",
                message: req.t("common:field.BASE_TYPE_CHOICES", {
                    types: getAccessTokenSupportedConnectionTypes(),
                }),
            },
        });

    if (!connection.settings.enabled)
        throw FieldErrors({
            provider_id: {
                message: "This connection has been disabled server-side.",
            },
        });

    const connectedAccount = await ConnectedAccount.findOne({
        where: {
            type: connection_name,
            external_id: connection_id,
            user_id: req.user_id,
        },
        select: {
            id: true,
            external_id: true,
            type: true,
            name: true,
            verified: true,
            visibility: true,
            show_activity: true,
            revoked: true,
            token_data: true,
            friend_sync: true,
            integrations: true,
        },
    });
    if (!connectedAccount) throw DiscordApiErrors.UNKNOWN_CONNECTION;
    if (connectedAccount.revoked) throw DiscordApiErrors.CONNECTION_REVOKED;
    if (!connectedAccount.token_data) throw new ApiError("No token data", 0, 400);

    let access_token = connectedAccount.token_data.access_token;
    const { expires_at, expires_in, fetched_at } = connectedAccount.token_data;
    const expiresAt = Number(expires_at ?? 0);
    const expiresIn = Number(expires_in ?? 0);
    const fetchedAt = Number(fetched_at ?? 0);

    if ((expiresAt > 0 && expiresAt < Date.now()) || (expiresIn > 0 && fetchedAt + expiresIn * 1000 < Date.now())) {
        if (!(connection instanceof RefreshableConnection)) throw new ApiError("Access token expired", 0, 400);
        const tokenData = await connection.refresh(connectedAccount);
        access_token = tokenData.access_token;
    }

    res.json({ access_token });
});

export default router;
