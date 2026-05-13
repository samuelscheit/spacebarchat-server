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
import { ApiError, Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildProductsGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type GuildProductsRepositories = {
    guildRepository?: GuildProductsGuildRepository;
};

export const GUILD_PRODUCTS_CREATE_UNSUPPORTED_MESSAGE = "Guild product creation is not supported on this Spacebar instance.";

function getGuildRepository(repository?: GuildProductsGuildRepository): GuildProductsGuildRepository {
    return repository ?? (Guild as unknown as GuildProductsGuildRepository);
}

export function createGuildProductsCreateUnsupportedError(): ApiError {
    return new ApiError(GUILD_PRODUCTS_CREATE_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function createGuildProduct(guildId: string, repositories: GuildProductsRepositories = {}): Promise<never> {
    const guildRepository = getGuildRepository(repositories.guildRepository);
    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    // Discord guild products depend on provider-backed store, SKU, listing,
    // attachment, entitlement, and payout state. Spacebar does not persist that
    // state, so fail closed after guild access checks instead of fabricating a product.
    throw createGuildProductsCreateUnsupportedError();
}

export function createGuildProductsRouter(repositories: GuildProductsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Create Guild Product",
            description:
                "Creates a guild product. This Discord endpoint depends on provider-backed store, SKU, listing, attachment, entitlement, and payout state; Spacebar does not currently persist that state, so this compatibility endpoint fails closed after MANAGE_GUILD access checks.",
            permission: "MANAGE_GUILD",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, _res: Response) => {
            await createGuildProduct(req.params.guild_id as string, repositories);
        },
    );

    return router;
}

export default createGuildProductsRouter();
