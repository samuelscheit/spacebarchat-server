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
import { PublicUserProjection, type APIApplication, type ApplicationType, type OAuthCurrentAuthorizationResponse, type PublicUser, type Snowflake } from "@spacebar/schemas";
import { Application, DiscordApiErrors, User } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

const IDENTIFY_SCOPE = "identify";
const snowflakePattern = /^\d{1,20}$/;

type OAuthCurrentAuthorizationToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
    application_id?: unknown;
    client_id?: unknown;
    azp?: unknown;
    aud?: unknown;
    application?: unknown;
    exp?: unknown;
    expires?: unknown;
    expires_at?: unknown;
    expiresAt?: unknown;
};

type PublicUserSource = Partial<PublicUser> & {
    toPublicUser?: () => PublicUser;
};

export type OAuthCurrentAuthorizationApplicationSource = Omit<Partial<APIApplication>, "bot" | "owner"> & {
    id: Snowflake;
    name: string;
    description?: string | null;
    type?: ApplicationType | null;
    owner?: PublicUserSource | null;
    bot?: PublicUserSource | null;
};

export type OAuthCurrentAuthorizationClaims = {
    applicationId: string;
    expires: Date;
    includeUser: boolean;
    scopes: string[];
};

export type OAuthCurrentAuthorizationApplicationRepository = {
    findOne(options: unknown): Promise<OAuthCurrentAuthorizationApplicationSource | null>;
};

export type OAuthCurrentAuthorizationUserRepository = {
    findOneOrFail(options: unknown): Promise<PublicUserSource>;
};

export type OAuthCurrentAuthorizationRepositories = {
    applicationRepository?: OAuthCurrentAuthorizationApplicationRepository;
    userRepository?: OAuthCurrentAuthorizationUserRepository;
    now?: () => Date;
};

const publicUserSelect = Object.fromEntries(PublicUserProjection.map((field) => [field, true]));

function getApplicationRepository(repository?: OAuthCurrentAuthorizationApplicationRepository): OAuthCurrentAuthorizationApplicationRepository {
    return repository ?? (Application as unknown as OAuthCurrentAuthorizationApplicationRepository);
}

function getUserRepository(repository?: OAuthCurrentAuthorizationUserRepository): OAuthCurrentAuthorizationUserRepository {
    return repository ?? (User as unknown as OAuthCurrentAuthorizationUserRepository);
}

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nestedApplicationId(value: unknown): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    return stringValue((value as { id?: unknown }).id);
}

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function hasScopeClaim(token: OAuthCurrentAuthorizationToken) {
    return "scope" in token || "scopes" in token || "scp" in token;
}

function secondsValue(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return undefined;
}

function dateFromUnixSeconds(value: unknown): Date | undefined {
    const seconds = secondsValue(value);
    if (seconds === undefined || seconds <= 0) return undefined;

    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateFromTimestamp(value: unknown): Date | undefined {
    const unixDate = dateFromUnixSeconds(value);
    if (unixDate) return unixDate;

    const stringDate = stringValue(value);
    if (!stringDate) return undefined;

    const date = new Date(stringDate);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function isTokenRecord(token: unknown): token is OAuthCurrentAuthorizationToken {
    return !!token && typeof token === "object";
}

function toPublicUser(user: PublicUserSource): PublicUser {
    if (typeof user.toPublicUser === "function") return user.toPublicUser();

    return Object.fromEntries(PublicUserProjection.filter((field) => user[field] !== undefined).map((field) => [field, user[field]])) as PublicUser;
}

function omitUndefined<T extends object>(value: T): T {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(value)) {
        if (record[key] === undefined) delete record[key];
    }

    return value;
}

export function getOAuthCurrentAuthorizationApplicationId(token: unknown): string | undefined {
    if (!isTokenRecord(token)) return undefined;

    return stringValue(token.application_id) ?? stringValue(token.client_id) ?? nestedApplicationId(token.application) ?? stringValue(token.azp) ?? stringValue(token.aud);
}

export function getOAuthCurrentAuthorizationScopes(token: unknown): string[] {
    if (!isTokenRecord(token)) return [];

    return [...new Set([...scopeValues(token.scope), ...scopeValues(token.scopes), ...scopeValues(token.scp)])];
}

export function getOAuthCurrentAuthorizationExpires(token: unknown): Date | undefined {
    if (!isTokenRecord(token)) return undefined;

    return dateFromUnixSeconds(token.exp) ?? dateFromTimestamp(token.expires_at) ?? dateFromTimestamp(token.expiresAt) ?? dateFromTimestamp(token.expires);
}

export function getOAuthCurrentAuthorizationClaims(token: unknown, now = new Date()): OAuthCurrentAuthorizationClaims {
    if (!isTokenRecord(token)) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;

    const applicationId = getOAuthCurrentAuthorizationApplicationId(token);
    if (!applicationId || !snowflakePattern.test(applicationId)) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;
    if (!hasScopeClaim(token)) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;

    const expires = getOAuthCurrentAuthorizationExpires(token);
    if (!expires || expires.getTime() <= now.getTime()) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;

    const scopes = getOAuthCurrentAuthorizationScopes(token);

    return {
        applicationId,
        expires,
        includeUser: scopes.includes(IDENTIFY_SCOPE),
        scopes,
    };
}

export function serializeOAuthCurrentAuthorizationApplication(application: OAuthCurrentAuthorizationApplicationSource): APIApplication {
    return omitUndefined({
        id: application.id,
        name: application.name,
        icon: application.icon,
        description: application.description ?? "",
        summary: application.summary,
        type: application.type,
        hook: application.hook,
        bot_public: application.bot_public,
        bot_require_code_grant: application.bot_require_code_grant,
        verify_key: application.verify_key,
        owner: application.owner ? toPublicUser(application.owner) : undefined,
        flags: application.flags ?? 0,
        redirect_uris: application.redirect_uris,
        rpc_application_state: application.rpc_application_state,
        store_application_state: application.store_application_state,
        verification_state: application.verification_state,
        interactions_endpoint_url: application.interactions_endpoint_url,
        integration_public: application.integration_public,
        integration_require_code_grant: application.integration_require_code_grant,
        discoverability_state: application.discoverability_state,
        discovery_eligibility_flags: application.discovery_eligibility_flags,
        bot: application.bot ? toPublicUser(application.bot) : undefined,
        tags: application.tags,
        cover_image: application.cover_image,
        install_params: application.install_params,
        terms_of_service_url: application.terms_of_service_url,
        privacy_policy_url: application.privacy_policy_url,
        guild_id: application.guild_id,
        custom_install_url: application.custom_install_url,
    });
}

export async function getOAuthCurrentAuthorizationResponse(
    token: unknown,
    userId: string,
    repositories: OAuthCurrentAuthorizationRepositories = {},
): Promise<OAuthCurrentAuthorizationResponse> {
    const claims = getOAuthCurrentAuthorizationClaims(token, repositories.now?.() ?? new Date());
    const applicationRepository = getApplicationRepository(repositories.applicationRepository);

    const application = await applicationRepository.findOne({
        where: { id: claims.applicationId },
        relations: {
            bot: true,
            owner: true,
        },
        select: {
            bot: publicUserSelect,
            owner: publicUserSelect,
        },
    });

    if (!application) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;

    const response: OAuthCurrentAuthorizationResponse = {
        application: serializeOAuthCurrentAuthorizationApplication(application),
        scopes: claims.scopes,
        expires: claims.expires.toISOString(),
    };

    if (claims.includeUser) {
        const userRepository = getUserRepository(repositories.userRepository);
        const user = await userRepository.findOneOrFail({
            where: { id: userId },
            select: PublicUserProjection,
        });

        response.user = toPublicUser(user);
    }

    return response;
}

export function createOAuthCurrentAuthorizationRouter(repositories: OAuthCurrentAuthorizationRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Current Authorization Information",
            responses: {
                200: {
                    body: "OAuthCurrentAuthorizationResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => res.json(await getOAuthCurrentAuthorizationResponse(req.token, req.user_id, repositories)),
    );

    return router;
}

export default createOAuthCurrentAuthorizationRouter();
