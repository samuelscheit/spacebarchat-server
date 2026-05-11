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
import type {
    ClaimedQuestConfigResponse,
    ClaimedQuestResponse,
    ClaimedQuestRewardResponse,
    QuestAssetsResponse,
    QuestClaimedQuestsResponse,
    QuestGradientResponse,
    QuestMessagesResponse,
} from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { toQuestUserStatusResponse } from "../@me";
import { assertValidQuestId } from "../../../util/utility/QuestRoutes";

export type ClaimedQuestsProvider = (userId: string) => QuestClaimedQuestsResponse | undefined | Promise<QuestClaimedQuestsResponse | undefined>;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function buildEmptyClaimedQuestsResponse(): QuestClaimedQuestsResponse {
    return {
        quests: [],
    };
}

export function getConfiguredClaimedQuests(_userId: string): QuestClaimedQuestsResponse {
    // Spacebar does not currently persist Discord quest enrollment, progress, or claim state.
    return buildEmptyClaimedQuestsResponse();
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isValidQuestSnowflake(value: unknown): value is string {
    try {
        assertValidQuestId(value);
        return true;
    } catch {
        return false;
    }
}

function serializeRequiredTimestamp(value: unknown): string | undefined {
    const timestamp = value instanceof Date ? value.toISOString() : value;
    if (typeof timestamp !== "string") return undefined;

    return Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined;
}

function toRequiredString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function toOptionalNullableString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return typeof value === "string" ? value : undefined;
}

function toRequiredNullableString(value: unknown): string | null | undefined {
    if (value === null || value === undefined) return null;

    return typeof value === "string" ? value : undefined;
}

function isJsonValue(value: unknown): value is JsonValue {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (!isObject(value)) return false;

    return Object.values(value).every(isJsonValue);
}

function cloneJsonObject(value: Record<string, JsonValue>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function toOptionalJsonObject(value: unknown): Record<string, unknown> | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!isObject(value) || !isJsonValue(value)) return undefined;

    return cloneJsonObject(value);
}

function toQuestGradientResponse(source: unknown): QuestGradientResponse | undefined {
    if (!isObject(source)) return undefined;

    const primary = toRequiredString(source.primary);
    const secondary = toRequiredString(source.secondary);
    if (primary === undefined || secondary === undefined) return undefined;

    return {
        primary,
        secondary,
    };
}

function toQuestAssetsResponse(source: unknown): QuestAssetsResponse | undefined {
    if (!isObject(source)) return undefined;

    const hero = toRequiredString(source.hero);
    const heroVideo = toRequiredNullableString(source.hero_video);
    const questBarHero = toRequiredString(source.quest_bar_hero);
    const questBarHeroVideo = toRequiredNullableString(source.quest_bar_hero_video);
    const gameTile = toRequiredString(source.game_tile);
    const logotype = toRequiredString(source.logotype);
    if (hero === undefined || heroVideo === undefined || questBarHero === undefined || questBarHeroVideo === undefined || gameTile === undefined || logotype === undefined) {
        return undefined;
    }

    return {
        hero,
        hero_video: heroVideo,
        quest_bar_hero: questBarHero,
        quest_bar_hero_video: questBarHeroVideo,
        game_tile: gameTile,
        logotype,
    };
}

function toQuestMessagesResponse(source: unknown): QuestMessagesResponse | undefined {
    if (!isObject(source)) return undefined;

    const questName = toRequiredString(source.quest_name);
    const gameTitle = toRequiredString(source.game_title);
    const gamePublisher = toRequiredString(source.game_publisher);
    if (questName === undefined || gameTitle === undefined || gamePublisher === undefined) return undefined;

    return {
        quest_name: questName,
        game_title: gameTitle,
        game_publisher: gamePublisher,
    };
}

function toClaimedQuestRewardResponse(source: unknown): ClaimedQuestRewardResponse | undefined {
    if (!isObject(source)) return undefined;

    if (!isNonNegativeInteger(source.type) || !isValidQuestSnowflake(source.sku_id)) return undefined;

    const name = toRequiredString(source.name);
    const nameWithArticle = toRequiredString(source.name_with_article);
    const asset = toRequiredString(source.asset);
    const assetVideo = toOptionalNullableString(source.asset_video);
    const collectibleProduct = toOptionalJsonObject(source.collectible_product);
    if (name === undefined || nameWithArticle === undefined || asset === undefined || assetVideo === undefined || collectibleProduct === undefined) return undefined;
    if (source.orb_quantity !== undefined && !isNonNegativeInteger(source.orb_quantity)) return undefined;

    return {
        type: source.type,
        sku_id: source.sku_id,
        name,
        name_with_article: nameWithArticle,
        asset,
        ...(source.asset_video !== undefined ? { asset_video: assetVideo } : {}),
        ...(source.orb_quantity !== undefined ? { orb_quantity: source.orb_quantity } : {}),
        ...(source.collectible_product !== undefined ? { collectible_product: collectibleProduct } : {}),
    };
}

function toClaimedQuestConfigResponse(source: unknown, questId: string): ClaimedQuestConfigResponse | undefined {
    if (!isObject(source) || source.id !== questId) return undefined;

    const startsAt = serializeRequiredTimestamp(source.starts_at);
    const expiresAt = serializeRequiredTimestamp(source.expires_at);
    const colors = toQuestGradientResponse(source.colors);
    const assets = toQuestAssetsResponse(source.assets);
    const messages = toQuestMessagesResponse(source.messages);
    const rewards = Array.isArray(source.rewards) ? source.rewards.map(toClaimedQuestRewardResponse) : undefined;
    if (startsAt === undefined || expiresAt === undefined || colors === undefined || assets === undefined || messages === undefined || rewards === undefined) return undefined;
    if (!Array.isArray(source.features) || !source.features.every(isNonNegativeInteger)) return undefined;
    if (rewards.some((reward) => reward === undefined)) return undefined;

    return {
        id: questId,
        starts_at: startsAt,
        expires_at: expiresAt,
        features: [...source.features],
        colors,
        assets,
        messages,
        rewards: rewards as ClaimedQuestRewardResponse[],
    };
}

function toClaimedQuestResponse(source: unknown, userId: string): ClaimedQuestResponse | undefined {
    if (!isObject(source) || !isValidQuestSnowflake(source.id)) return undefined;

    const config = toClaimedQuestConfigResponse(source.config, source.id);
    const userStatus = toQuestUserStatusResponse(source.user_status, userId, source.id);
    if (config === undefined || userStatus === undefined || userStatus === null || userStatus.claimed_at === null) return undefined;

    return {
        id: source.id,
        config,
        user_status: userStatus,
    };
}

export function toClaimedQuestsResponse(source: unknown, userId: string): QuestClaimedQuestsResponse {
    if (!isObject(source)) return buildEmptyClaimedQuestsResponse();

    return {
        quests: Array.isArray(source.quests)
            ? source.quests.map((quest) => toClaimedQuestResponse(quest, userId)).filter((quest): quest is ClaimedQuestResponse => quest !== undefined)
            : [],
    };
}

export async function getClaimedQuests(userId: string, claimedQuestsProvider: ClaimedQuestsProvider = getConfiguredClaimedQuests): Promise<QuestClaimedQuestsResponse> {
    const claimedQuests = await claimedQuestsProvider(userId);

    return toClaimedQuestsResponse(claimedQuests ?? buildEmptyClaimedQuestsResponse(), userId);
}

export function createClaimedQuestsRouter(claimedQuestsProvider: ClaimedQuestsProvider = getConfiguredClaimedQuests) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Claimed Quests",
            description:
                "Returns the current user's locally backed claimed quests. Spacebar does not currently persist Discord quest enrollment, progress, or claim state, so the default provider returns the documented empty claimed-quest collection instead of fabricating Discord quests.",
            responses: {
                200: {
                    body: "QuestClaimedQuestsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const claimedQuests = await getClaimedQuests(req.user_id, claimedQuestsProvider);

            return res.status(200).json(claimedQuests);
        },
    );

    return router;
}

export default createClaimedQuestsRouter();
