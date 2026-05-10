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
import type { DeviceSyncTokenResponse } from "@spacebar/schemas";
import { loadOrGenerateKeypair } from "@spacebar/util";
import { Request, Response, Router } from "express";
import jwt, { type Secret } from "jsonwebtoken";

export const DEVICE_SYNC_TOKEN_TTL_SECONDS = 15 * 60;

export interface DeviceSyncTokenPayload {
    sub: string;
    iat: number;
    exp: number;
    kid: string;
    typ: "push_sync";
    ver: 1;
    did?: string;
}

export interface DeviceSyncTokenDependencies {
    nowSeconds: () => number;
    issueDeviceSyncToken: (userId: string, sessionId: string | undefined, nowSeconds: number) => Promise<string>;
}

export function createDeviceSyncTokenPayload(userId: string, keyId: string, nowSeconds: number, sessionId?: string): DeviceSyncTokenPayload {
    return {
        sub: userId,
        iat: nowSeconds,
        exp: nowSeconds + DEVICE_SYNC_TOKEN_TTL_SECONDS,
        kid: keyId,
        typ: "push_sync",
        ver: 1,
        ...(sessionId ? { did: sessionId } : {}),
    };
}

function signDeviceSyncToken(payload: DeviceSyncTokenPayload, privateKey: Secret) {
    return new Promise<string>((resolve, reject) => {
        jwt.sign(payload, privateKey, { algorithm: "ES512" }, (error, token) => {
            if (error) return reject(error);
            if (!token) return reject(new Error("Device sync token signer returned an empty token"));
            return resolve(token);
        });
    });
}

async function issueSignedDeviceSyncToken(userId: string, sessionId: string | undefined, nowSeconds: number) {
    const keyPair = await loadOrGenerateKeypair();
    const payload = createDeviceSyncTokenPayload(userId, keyPair.fingerprint, nowSeconds, sessionId);
    return signDeviceSyncToken(payload, keyPair.privateKey);
}

async function getDeviceSyncTokenResponse(req: Request, deps: DeviceSyncTokenDependencies): Promise<DeviceSyncTokenResponse> {
    return { token: await deps.issueDeviceSyncToken(req.user_id, req.session?.session_id, deps.nowSeconds()) };
}

const defaultDependencies: DeviceSyncTokenDependencies = {
    nowSeconds: () => Math.floor(Date.now() / 1000),
    issueDeviceSyncToken: issueSignedDeviceSyncToken,
};

export function createDeviceSyncTokenRouter(deps: DeviceSyncTokenDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Device Sync Token",
            description:
                "Returns a scoped, expiring push notification sync token for the current user. Spacebar does not currently persist push-device registrations or multi-account device sync state, so this endpoint returns only the source-documented token envelope without fabricating sync state.",
            responses: {
                200: {
                    body: "DeviceSyncTokenResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => res.json(await getDeviceSyncTokenResponse(req, deps)),
    );

    return router;
}

export default createDeviceSyncTokenRouter();
