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

import type { Application } from "../../../util/entities/Application";
import { DiscordApiErrors } from "../../../util/util/Constants";

export type OAuthAuthorizeApplicationTarget = {
    bot?: unknown | null;
};

export type OAuthAuthorizeApplicationWithBot<T extends OAuthAuthorizeApplicationTarget = Application> = T & {
    bot: NonNullable<T["bot"]>;
};

export type OAuthAuthorizeApplicationRepository<T extends OAuthAuthorizeApplicationTarget = Application> = {
    findOne(options: unknown): Promise<T | null>;
};

async function getOAuthAuthorizeApplicationRepository<T extends OAuthAuthorizeApplicationTarget>(): Promise<OAuthAuthorizeApplicationRepository<T>> {
    const { Application } = await import("../../../util/entities/Application.js");
    return Application as OAuthAuthorizeApplicationRepository<T>;
}

export async function requireOAuthAuthorizeApplication<T extends OAuthAuthorizeApplicationTarget = Application>(
    clientId: string,
    repository?: OAuthAuthorizeApplicationRepository<T>,
): Promise<OAuthAuthorizeApplicationWithBot<T>> {
    const applicationRepository = repository ?? (await getOAuthAuthorizeApplicationRepository<T>());
    const application = await applicationRepository.findOne({
        where: {
            id: clientId,
        },
        relations: { bot: true },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!application.bot) throw DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT;

    return application as OAuthAuthorizeApplicationWithBot<T>;
}
