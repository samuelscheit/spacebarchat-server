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

import { Router, Response, Request } from "express";
import { route } from "@spacebar/api";
import type { PushNotificationDeviceUnregisterSchema } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

router.post("/", route({}), (req: Request, res: Response) => {
    // TODO:
    res.sendStatus(204);
});

export async function unregisterPushNotificationDevice(userId: string, device: PushNotificationDeviceUnregisterSchema): Promise<void> {
    void userId;
    void device.provider;
    void device.token;

    // Spacebar does not currently persist Discord push-device registrations.
    // Validate and acknowledge the documented unregister payload without fabricating device state.
}

router.delete(
    "/",
    route({
        summary: "Unregister Device",
        description:
            "Unregisters a GCM/APNs push notification token for the current user's device. Spacebar does not currently persist push-device registrations, so this compatibility endpoint validates the documented unregister payload and acknowledges removal without fabricating device state.",
        requestBody: "PushNotificationDeviceUnregisterSchema",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        await unregisterPushNotificationDevice(req.user_id, req.body as PushNotificationDeviceUnregisterSchema);

        return res.sendStatus(204);
    },
);

export default router;
