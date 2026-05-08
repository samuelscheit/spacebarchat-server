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

export interface RoleResponse {
    id: string;
    guild_id: string;
    color: number;
    hoist: boolean;
    managed: boolean;
    mentionable: boolean;
    name: string;
    permissions: string;
    position: number;
    icon?: string | null;
    unicode_emoji?: string | null;
    tags?: RoleTags;
    flags: number;
    colors: RoleColors;
}

export interface RoleTags {
    bot_id?: string;
    integration_id?: string;
    premium_subscriber?: boolean;
}
