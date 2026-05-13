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
import { ConnectedAccount, ConnectedAccountDTO, DiscordApiErrors, emitEvent, getConnectedAccountDTOSelect } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { ConnectionUpdateSchema } from "@spacebar/schemas";
const router = Router({ mergeParams: true });

type NormalizedConnectionUpdate = {
    visibility?: boolean | number;
    show_activity?: boolean | number;
    metadata_visibility?: boolean | number;
};

function normalizeConnectionUpdate(body: ConnectionUpdateSchema): NormalizedConnectionUpdate {
    const update: NormalizedConnectionUpdate = { ...body };

    if (typeof update.visibility === "boolean") update.visibility = update.visibility ? 1 : 0;
    if (typeof update.show_activity === "boolean") update.show_activity = update.show_activity ? 1 : 0;
    if (typeof update.metadata_visibility === "boolean") update.metadata_visibility = update.metadata_visibility ? 1 : 0;

    return update;
}

async function updateConnection(req: Request) {
    const { connection_name, connection_id } = req.params as { [key: string]: string };
    const body = req.body as ConnectionUpdateSchema;

    const connection = await ConnectedAccount.findOne({
        where: {
            user_id: req.user_id,
            external_id: connection_id,
            type: connection_name,
        },
        select: getConnectedAccountDTOSelect(),
    });

    if (!connection) throw DiscordApiErrors.UNKNOWN_CONNECTION;
    if (connection.revoked) throw DiscordApiErrors.CONNECTION_REVOKED;

    connection.assign(normalizeConnectionUpdate(body));

    await ConnectedAccount.update(
        {
            user_id: req.user_id,
            external_id: connection_id,
            type: connection_name,
        },
        connection,
    );
    return new ConnectedAccountDTO(connection);
}

router.patch("/", route({ requestBody: "ConnectionUpdateSchema" }), async (req: Request, res: Response) => {
    res.json(await updateConnection(req));
});

router.put("/", route({ requestBody: "ConnectionUpdateSchema" }), async (req: Request, res: Response) => {
    const connection = await updateConnection(req);

    await emitEvent({
        event: "USER_CONNECTIONS_UPDATE",
        data: connection,
        user_id: req.user_id,
    });

    res.json(connection);
});

router.delete("/", route({}), async (req: Request, res: Response) => {
    const { connection_name, connection_id } = req.params as { [key: string]: string };

    const account = await ConnectedAccount.findOneOrFail({
        where: {
            user_id: req.user_id,
            external_id: connection_id,
            type: connection_name,
        },
    });

    await Promise.all([
        ConnectedAccount.remove(account),
        emitEvent({
            event: "USER_CONNECTIONS_UPDATE",
            data: new ConnectedAccountDTO(account),
            user_id: req.user_id,
        }),
    ]);

    return res.sendStatus(200);
});

export default router;
