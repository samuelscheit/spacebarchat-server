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

import multerConfig from "multer";
import { Config, getConfiguredCdnMultipartFileLimit } from "@spacebar/util";
import type { RequestHandler } from "express";

function createMulter() {
    return multerConfig({
        storage: multerConfig.memoryStorage(),
        limits: {
            fields: 10,
            files: 10,
            fileSize: getConfiguredCdnMultipartFileLimit(Config.get().cdn),
        },
    });
}

export const multer = {
    single(fieldName: string): RequestHandler {
        return (req, res, next) => {
            createMulter().single(fieldName)(req, res, next);
        };
    },
};
