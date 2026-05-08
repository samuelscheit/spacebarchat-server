import { Snowflake } from "../../Identifiers";

export class RoleColors {
    primary_color: number;
    secondary_color: number | undefined; // only used for "holographic" and "gradient" styles
    tertiary_color?: number | undefined; // only used for "holographic" style

    toJSON(): RoleColors {
        return {
            ...this,
            secondary_color: this.secondary_color ?? undefined,
            tertiary_color: this.tertiary_color ?? undefined,
        };
    }
}

export interface PublicRoleTags {
    bot_id?: Snowflake;
    integration_id?: Snowflake;
    premium_subscriber?: boolean;
}

export interface PublicRole {
    id: Snowflake;
    guild_id?: Snowflake;
    color: number;
    hoist: boolean;
    managed: boolean;
    mentionable: boolean;
    name: string;
    permissions: string;
    position: number;
    icon?: string | null;
    unicode_emoji?: string | null;
    tags?: PublicRoleTags;
    flags: number;
    colors: RoleColors;
}
