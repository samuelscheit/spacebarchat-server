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

import { checkToken, Rights, Session, User, UserTokenData } from "@spacebar/util";
import { NextFunction, Request, Response } from "express";
import { HTTPError } from "lambert-server";
import { isNoAuthorizationRoute } from "./NoAuthorizationRoutes";

export { API_PREFIX, API_PREFIX_TRAILING_SLASH, NO_AUTHORIZATION_ROUTES, isNoAuthorizationRoute } from "./NoAuthorizationRoutes";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user_id: string;
            user_bot: boolean;
            tokenData: UserTokenData;
            token: { id: string; iat: number; ver?: number; did?: string };
            user: User;
            session?: Session;
            rights: Rights;
            fingerprint?: string;
        }
    }
}

export async function Authentication(req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") return res.sendStatus(204);

    if (req.headers.cookie?.split("; ").find((x) => x.startsWith("__sb_sessid=")))
        req.fingerprint = req.headers.cookie
            .split("; ")
            .find((x) => x.startsWith("__sb_sessid="))!
            .split("=")[1];
    // for some reason we need to require here, else the openapi generator fails with "route is not a function"
    else res.setHeader("Set-Cookie", `__sb_sessid=${(req.fingerprint = (await require("../util")).randomString(32))}; Secure; HttpOnly; SameSite=None; Path=/`);

    if (isNoAuthorizationRoute(req.method, req.url)) return next();

    if (!req.headers.authorization) return next(new HTTPError("Missing Authorization Header", 401));

    try {
        const { decoded, user, session } = (req.tokenData = await checkToken(req.headers.authorization, {
            ipAddress: req.ip,
            fingerprint: req.fingerprint,
        }));

        req.token = decoded;
        req.user_id = decoded.id;
        req.user_bot = user.bot;
        req.user = user;
        req.session = session;
        req.rights = new Rights(Number(user.rights));
        return next();
    } catch (error) {
        if (error instanceof HTTPError) {
            return next(error);
        }
        return next(new HTTPError(error!.toString(), 400));
    }
}
