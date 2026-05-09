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

import { NextFunction, Request, Response } from "express";
import { Config } from "@spacebar/util";

function headerFromList(configured: string[], requested: string | undefined) {
    if (configured.includes("*")) return requested || "*";
    return configured.join(", ");
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]) {
    if (allowedOrigins.includes("*")) return true;
    if (!origin) return false;
    return allowedOrigins.includes(origin);
}

export function CORS(req: Request, res: Response, next: NextFunction) {
    const { cors } = Config.get();
    const origin = req.header("Origin");

    if (cors.enabled && isOriginAllowed(origin, cors.allowedOrigins)) {
        if (cors.allowCredentials) res.set("Access-Control-Allow-Credentials", "true");
        res.set("Access-Control-Allow-Headers", headerFromList(cors.allowedHeaders, req.header("Access-Control-Request-Headers")));
        res.set("Access-Control-Allow-Methods", headerFromList(cors.allowedMethods, req.header("Access-Control-Request-Method")));
        res.set("Access-Control-Allow-Origin", origin ?? "*");
        res.set("Access-Control-Max-Age", String(cors.maxAgeSeconds)); // dont make it too long so we can change it dynamically
    }
    // TODO: use better CSP
    res.set(
        "Content-security-policy",
        "default-src *  data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src * data: blob: 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src * data: blob: ; style-src * data: blob: 'unsafe-inline'; font-src * data: blob: 'unsafe-inline';",
    );

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
}
