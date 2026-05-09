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

import { Application, Member } from "@spacebar/util";
import type { APIGuildIntegration, APIIntegrationApplication } from "@spacebar/schemas";
import { In, Repository } from "typeorm";

export type MemberRepositoryLike = Pick<Repository<Member>, "find">;
export type ApplicationRepositoryLike = Pick<Repository<Application>, "find">;

function toIntegrationApplication(application: Application): APIIntegrationApplication {
    return {
        id: application.id,
        name: application.name,
        icon: application.icon,
        description: application.description,
        summary: application.summary,
        type: application.type,
        hook: application.hook,
        bot_public: application.bot_public,
        bot_require_code_grant: application.bot_require_code_grant,
        verify_key: application.verify_key,
        flags: application.flags,
        redirect_uris: application.redirect_uris,
        rpc_application_state: application.rpc_application_state,
        store_application_state: application.store_application_state,
        verification_state: application.verification_state,
        interactions_endpoint_url: application.interactions_endpoint_url,
        integration_public: application.integration_public,
        integration_require_code_grant: application.integration_require_code_grant,
        discoverability_state: application.discoverability_state,
        discovery_eligibility_flags: application.discovery_eligibility_flags,
        tags: application.tags,
        cover_image: application.cover_image,
        install_params: application.install_params ?? undefined,
        terms_of_service_url: application.terms_of_service_url,
        privacy_policy_url: application.privacy_policy_url,
        guild_id: application.guild_id,
        custom_install_url: application.custom_install_url,
    };
}

export function toGuildIntegration(application: Application): APIGuildIntegration {
    const bot = application.bot;
    const accountName = bot?.username ?? application.name;

    return {
        id: application.id,
        name: application.name,
        type: "discord",
        enabled: true,
        syncing: false,
        role_id: null,
        enable_emoticons: false,
        expire_behavior: 0,
        expire_grace_period: 0,
        user: null,
        account: {
            id: bot?.id ?? application.id,
            name: accountName,
        },
        synced_at: null,
        subscriber_count: 0,
        revoked: false,
        application: toIntegrationApplication(application),
    };
}

export async function listGuildIntegrations(
    guild_id: string,
    repositories: {
        members?: MemberRepositoryLike;
        applications?: ApplicationRepositoryLike;
    } = {},
): Promise<APIGuildIntegration[]> {
    const memberRepository = repositories.members ?? Member.getRepository();
    const applicationRepository = repositories.applications ?? Application.getRepository();

    const botMembers = await memberRepository.find({
        where: { guild_id, user: { bot: true } },
        relations: { user: true },
        select: {
            id: true,
            guild_id: true,
            user: {
                id: true,
                username: true,
                bot: true,
            },
        },
    });
    const botIds = [...new Set(botMembers.map((member) => member.id))];

    if (!botIds.length) return [];

    const applications = await applicationRepository.find({
        where: { bot: { id: In(botIds) } },
        relations: { bot: true },
    });
    const applicationsByBotId = new Map(applications.filter((application) => application.bot).map((application) => [application.bot!.id, application]));

    return botIds
        .map((botId) => applicationsByBotId.get(botId))
        .filter((application): application is Application => !!application)
        .map(toGuildIntegration);
}
