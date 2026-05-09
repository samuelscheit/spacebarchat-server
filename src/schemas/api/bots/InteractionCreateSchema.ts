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

import { InteractionContextType, MessageComponentType, PublicMember, PublicMessage, PublicUser, ResolvedData, Snowflake } from "@spacebar/schemas";
// TODO: remove entity imports
import { Channel } from "@spacebar/util";

interface InteractionCreateBase {
    version: 1;
    id: Snowflake;
    application_id: Snowflake;
    token: string;
    guild?: InteractionGuild;
    guild_id?: Snowflake;
    guild_locale?: string;
    channel?: Channel;
    channel_id?: Snowflake;
    member?: PublicMember;
    user?: PublicUser;
    locale?: string;
    message?: PublicMessage;
    app_permissions: string;
    entitlements: InteractionEntitlement[];
    entitlement_sku_ids?: Snowflake[]; // DEPRECATED
    authorizing_integration_owners: AuthorizingIntegrationOwners;
    context?: InteractionContextType;
    attachment_size_limit: number;
}

export type InteractionCreateSchema =
    | PingInteractionCreateSchema
    | ApplicationCommandInteractionCreateSchema
    | ApplicationCommandAutocompleteInteractionCreateSchema
    | MessageComponentInteractionCreateSchema
    | ModalSubmitInteractionCreateSchema;

export interface PingInteractionCreateSchema extends InteractionCreateBase {
    type: 1;
    data?: undefined;
}

export interface ApplicationCommandInteractionCreateSchema extends InteractionCreateBase {
    type: 2;
    data: InteractionApplicationCommandData;
}

export interface ApplicationCommandAutocompleteInteractionCreateSchema extends InteractionCreateBase {
    type: 4;
    data: InteractionApplicationCommandData;
}

export interface MessageComponentInteractionCreateSchema extends InteractionCreateBase {
    type: 3;
    data: InteractionMessageComponentData;
}

export interface ModalSubmitInteractionCreateSchema extends InteractionCreateBase {
    type: 5;
    data: InteractionModalSubmitData;
}

export type InteractionCreateData = InteractionApplicationCommandData | InteractionMessageComponentData | InteractionModalSubmitData;

export interface InteractionApplicationCommandData {
    id: Snowflake;
    name: string;
    type: number;
    version?: Snowflake;
    resolved?: ResolvedData;
    options?: InteractionApplicationCommandDataOption[];
    guild_id?: Snowflake;
    target_id?: Snowflake;
}

export interface InteractionApplicationCommandDataOption {
    name: string;
    type: number;
    value?: string | number | boolean;
    options?: InteractionApplicationCommandDataOption[];
    focused?: boolean;
}

export interface InteractionMessageComponentData {
    custom_id: string;
    component_type: MessageComponentType;
    values?: string[];
    resolved?: ResolvedData;
}

export interface InteractionModalSubmitData {
    custom_id: string;
    components: InteractionModalSubmitTopLevelComponentData[];
    resolved?: ResolvedData;
    attachments?: object[];
}

export type InteractionModalSubmitTopLevelComponentData =
    | InteractionModalSubmitActionRowComponentData
    | InteractionModalSubmitLabelComponentData
    | InteractionModalSubmitTextDisplayComponentData;

export interface InteractionModalSubmitActionRowComponentData {
    type: MessageComponentType.ActionRow;
    id?: number;
    components: InteractionModalSubmitComponentData[];
}

export interface InteractionModalSubmitLabelComponentData {
    type: MessageComponentType.Label;
    id?: number;
    component: InteractionModalSubmitComponentData;
}

export interface InteractionModalSubmitTextDisplayComponentData {
    type: MessageComponentType.TextDisplay;
    id?: number;
    content: string;
}

export type InteractionModalSubmitComponentData =
    | InteractionModalSubmitTextInputComponentData
    | InteractionModalSubmitSelectComponentData
    | InteractionModalSubmitFileUploadComponentData
    | InteractionModalSubmitRadioGroupComponentData
    | InteractionModalSubmitCheckboxGroupComponentData
    | InteractionModalSubmitCheckboxComponentData;

export interface InteractionModalSubmitTextInputComponentData {
    type: MessageComponentType.TextInput;
    id?: number;
    custom_id: string;
    value: string;
}

export interface InteractionModalSubmitSelectComponentData {
    type:
        | MessageComponentType.StringSelect
        | MessageComponentType.UserSelect
        | MessageComponentType.RoleSelect
        | MessageComponentType.MentionableSelect
        | MessageComponentType.ChannelSelect;
    id?: number;
    custom_id: string;
    values: string[];
}

export interface InteractionModalSubmitFileUploadComponentData {
    type: MessageComponentType.FileUpload;
    id?: number;
    custom_id: string;
    values: Snowflake[];
}

export interface InteractionModalSubmitRadioGroupComponentData {
    type: MessageComponentType.RadioGroup;
    id?: number;
    custom_id: string;
    value?: string | null;
}

export interface InteractionModalSubmitCheckboxGroupComponentData {
    type: MessageComponentType.CheckboxGroup;
    id?: number;
    custom_id: string;
    values: string[];
}

export interface InteractionModalSubmitCheckboxComponentData {
    type: MessageComponentType.Checkbox;
    id?: number;
    custom_id: string;
    value: boolean;
}

export enum EntitlementType {
    PURCHASE = 1,
    PREMIUM_SUBSCRIPTION = 2,
    DEVELOPER_GIFT = 3,
    TEST_MODE_PURCHASE = 4,
    FREE_PURCHASE = 5,
    USER_GIFT = 6,
    PREMIUM_PURCHASE = 7,
    APPLICATION_SUBSCRIPTION = 8,
    FREE_STAFF_PURCHASE = 9,
    QUEST_REWARD = 10,
    FRACTIONAL_REDEMPTION = 11,
    VIRTUAL_CURRENCY_REDEMPTION = 12,
    GUILD_POWERUP = 13,
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
    user?: object;
    parent_id?: Snowflake;
    branches?: Snowflake[];
    promotion_id?: Snowflake | null;
    subscription_id?: Snowflake | null;
    gift_code_flags?: number;
    gift_code_batch_id?: Snowflake;
    gifter_user_id?: Snowflake;
    gift_style?: number;
    fulfillment_status?: number;
    fulfilled_at?: string | null;
    source_type?: number;
    tenant_metadata?: object;
    sku?: object;
    subscription_plan?: object;
}

export type AuthorizingIntegrationOwners = GuildInstallAuthorizingIntegrationOwners | UserInstallAuthorizingIntegrationOwners;

export interface GuildInstallAuthorizingIntegrationOwners {
    0: Snowflake;
    1?: Snowflake;
}

export interface UserInstallAuthorizingIntegrationOwners {
    0?: Snowflake;
    1: Snowflake;
}

export interface AuthorizingIntegrationOwnersContext {
    application_id: Snowflake;
    channel_id?: Snowflake;
    guild_id?: Snowflake;
    user_id: Snowflake;
}

export function getAuthorizingIntegrationOwners({ application_id, channel_id, guild_id, user_id }: AuthorizingIntegrationOwnersContext): AuthorizingIntegrationOwners {
    if (guild_id) {
        return { "0": guild_id };
    }

    if (channel_id === application_id) {
        return { "0": "0" };
    }

    return { "1": user_id };
}

interface InteractionGuild {
    id: Snowflake;
    features: string[];
    locale: string;
}
