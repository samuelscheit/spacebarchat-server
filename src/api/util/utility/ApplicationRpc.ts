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

import type { ApplicationRpcResponse } from "@spacebar/schemas";
import { Application, DiscordApiErrors } from "@spacebar/util";
import type { Request, Response } from "express";
import type { FindOneOptions } from "typeorm";

export type ApplicationRpcSource = Pick<
    Application,
    | "bot_public"
    | "bot_require_code_grant"
    | "cover_image"
    | "description"
    | "flags"
    | "hook"
    | "icon"
    | "id"
    | "install_params"
    | "name"
    | "privacy_policy_url"
    | "summary"
    | "tags"
    | "terms_of_service_url"
    | "type"
    | "verify_key"
>;

export type ApplicationRpcRepository = {
    findOne(options: FindOneOptions<Application>): Promise<ApplicationRpcSource | null>;
};

export type ApplicationRpcRepositories = {
    applicationRepository?: ApplicationRpcRepository;
};

function omitUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function optionalString(value: string | null | undefined) {
    return value ?? undefined;
}

function optionalArray<T>(value: T[] | null | undefined) {
    return value ?? undefined;
}

export function toApplicationRpcResponse(application: ApplicationRpcSource): ApplicationRpcResponse {
    return omitUndefined({
        id: application.id,
        name: application.name,
        description: application.description ?? "",
        icon: application.icon ?? null,
        summary: optionalString(application.summary),
        type: application.type ?? null,
        cover_image: optionalString(application.cover_image),
        hook: application.hook,
        bot_public: application.bot_public,
        bot_require_code_grant: application.bot_require_code_grant,
        terms_of_service_url: optionalString(application.terms_of_service_url),
        privacy_policy_url: optionalString(application.privacy_policy_url),
        install_params: application.install_params ?? undefined,
        verify_key: application.verify_key,
        flags: application.flags,
        tags: optionalArray(application.tags),
    });
}

export async function getApplicationRpcResponse(applicationId: string, repositories: ApplicationRpcRepositories = {}): Promise<ApplicationRpcResponse> {
    const applicationRepository = repositories.applicationRepository ?? (Application.getRepository() as unknown as ApplicationRpcRepository);
    const application = await applicationRepository.findOne({
        where: { id: applicationId },
        select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            summary: true,
            type: true,
            cover_image: true,
            hook: true,
            bot_public: true,
            bot_require_code_grant: true,
            terms_of_service_url: true,
            privacy_policy_url: true,
            install_params: true,
            verify_key: true,
            flags: true,
            tags: true,
        },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    return toApplicationRpcResponse(application);
}

export function createApplicationRpcRouteHandler(repositories: ApplicationRpcRepositories = {}) {
    return async (req: Request, res: Response) => {
        const response = await getApplicationRpcResponse(req.params.application_id as string, repositories);

        return res.status(200).json(response);
    };
}
