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

import {
    InteractionContextType,
    PublicMember,
    PublicUser,
    SendableApplicationCommandDataSchema,
    SendableMessageComponentDataSchema,
    SendableModalSubmitDataSchema,
    Snowflake,
    InteractionType,
} from "@spacebar/schemas";
// TODO: remove entity imports
import { Channel, Message } from "@spacebar/util";

export interface InteractionCreateSchema {
    version: 1;
    id: Snowflake;
    application_id: Snowflake;
    type: InteractionType;
    token: string;
    data?: InteractionCreateData;
    guild?: InteractionGuild;
    guild_id?: Snowflake;
    guild_locale?: string;
    channel?: Channel;
    channel_id?: Snowflake;
    member?: PublicMember;
    user?: PublicUser;
    locale?: string;
    message?: Message;
    app_permissions: string;
    entitlements: InteractionEntitlement[];
    entitlement_sku_ids?: Snowflake[]; // DEPRECATED
    authorizing_integration_owners: AuthorizingIntegrationOwners;
    context?: InteractionContextType;
    attachment_size_limit: number;
}

export type InteractionCreateData = SendableApplicationCommandDataSchema | SendableMessageComponentDataSchema | SendableModalSubmitDataSchema;

export enum EntitlementType {
    PURCHASE = 1,
    PREMIUM_SUBSCRIPTION = 2,
    DEVELOPER_GIFT = 3,
    TEST_MODE_PURCHASE = 4,
    FREE_PURCHASE = 5,
    USER_GIFT = 6,
    PREMIUM_PURCHASE = 7,
    APPLICATION_SUBSCRIPTION = 8,
}

export interface InteractionEntitlement {
    id: Snowflake;
    sku_id: Snowflake;
    application_id: Snowflake;
    user_id?: Snowflake;
    type: EntitlementType;
    deleted: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    guild_id?: Snowflake;
    consumed?: boolean;
}

export interface AuthorizingIntegrationOwners {
    0?: Snowflake;
    1?: Snowflake;
}

interface InteractionGuild {
    id: Snowflake;
    features: string[];
    locale: string;
}
