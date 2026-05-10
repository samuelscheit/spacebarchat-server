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
import type { VoiceFilterModelResponse, VoiceFilterResponse, VoiceFiltersCatalogLimitedTimeVoicesResponse, VoiceFiltersCatalogResponse } from "@spacebar/schemas";
import { FieldErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyLimitedTimeVoices: VoiceFiltersCatalogLimitedTimeVoicesResponse = {
    current_set: [],
    next_set: [],
};

export interface VoiceFiltersCatalogQueryOptions {
    vfm_version: number;
    models: string[];
}

export interface VoiceFiltersCatalogData {
    limited_time_voices?: VoiceFiltersCatalogLimitedTimeVoicesResponse;
    models?: Readonly<Record<string, VoiceFilterModelResponse>>;
    voices?: readonly VoiceFilterResponse[];
}

export type VoiceFiltersCatalogProvider = (options: VoiceFiltersCatalogQueryOptions) => VoiceFiltersCatalogData;

export function getVoiceFiltersCatalog(_options: VoiceFiltersCatalogQueryOptions): VoiceFiltersCatalogData {
    // Spacebar currently has no bundled or persisted voice-filter asset catalog backing.
    return {
        limited_time_voices: emptyLimitedTimeVoices,
        models: {},
        voices: [],
    };
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function stringQueryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(stringQueryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseRequiredInteger(value: unknown, key: string): number {
    const rawValue = firstQueryValue(value);

    if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
        throw FieldErrors({
            [key]: {
                code: "BASE_TYPE_REQUIRED",
                message: `${key} is required`,
            },
        });
    }

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw FieldErrors({
            [key]: {
                code: "BASE_TYPE_INVALID",
                message: `${key} must be a non-negative integer`,
            },
        });
    }

    return parsed;
}

export function parseVoiceFiltersCatalogQuery(query: Request["query"]): VoiceFiltersCatalogQueryOptions {
    return {
        vfm_version: parseRequiredInteger(query.vfm_version, "vfm_version"),
        models: [...new Set([...stringQueryValues(query.models), ...stringQueryValues(query["models[]"])])],
    };
}

function serializeLimitedTimeVoices(source: VoiceFiltersCatalogLimitedTimeVoicesResponse | undefined): VoiceFiltersCatalogLimitedTimeVoicesResponse {
    return {
        current_set: [...(source?.current_set ?? [])],
        ...(source?.current_set_start ? { current_set_start: source.current_set_start } : {}),
        ...(source?.current_set_end ? { current_set_end: source.current_set_end } : {}),
        next_set: [...(source?.next_set ?? [])],
        ...(source?.next_set_start ? { next_set_start: source.next_set_start } : {}),
        ...(source?.next_set_end ? { next_set_end: source.next_set_end } : {}),
    };
}

function serializeModels(
    models: Readonly<Record<string, VoiceFilterModelResponse>> | undefined,
    options: VoiceFiltersCatalogQueryOptions,
): Record<string, VoiceFilterModelResponse> {
    const entries = Object.entries(models ?? {});
    if (options.vfm_version >= 6 && options.models.length === 0) return {};

    const requestedModels = new Set(options.models);
    const filteredEntries = requestedModels.size ? entries.filter(([modelId]) => requestedModels.has(modelId)) : entries;

    return Object.fromEntries(filteredEntries.map(([modelId, model]) => [modelId, { ...model }]));
}

function serializeVoiceFilter(voice: VoiceFilterResponse, vfmVersion: number): VoiceFilterResponse {
    const response: VoiceFilterResponse = {
        id: voice.id,
        requires_premium: voice.requires_premium,
        available: voice.available,
    };

    if (voice.limited_time_free_ends) response.limited_time_free_ends = voice.limited_time_free_ends;
    if (voice.limited_time_free_starts) response.limited_time_free_starts = voice.limited_time_free_starts;
    if (voice.models) response.models = vfmVersion >= 6 ? {} : Array.isArray(voice.models) ? [...voice.models] : { ...voice.models };

    return response;
}

export function buildVoiceFiltersCatalogResponse(catalog: VoiceFiltersCatalogData, options: VoiceFiltersCatalogQueryOptions): VoiceFiltersCatalogResponse {
    return {
        limited_time_voices: serializeLimitedTimeVoices(catalog.limited_time_voices),
        models: serializeModels(catalog.models, options),
        voices: (catalog.voices ?? []).map((voice) => serializeVoiceFilter(voice, options.vfm_version)),
    };
}

export function createVoiceFiltersCatalogRouter(catalogProvider: VoiceFiltersCatalogProvider = getVoiceFiltersCatalog) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Voice Filters Catalog",
            query: {
                vfm_version: {
                    type: "integer",
                    required: true,
                    description: "Version of the voice filter native module.",
                },
                models: {
                    type: "array",
                    description: "ONNX model IDs to include in the response.",
                },
            },
            responses: {
                200: {
                    body: "VoiceFiltersCatalogResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseVoiceFiltersCatalogQuery(req.query);
            res.status(200).json(buildVoiceFiltersCatalogResponse(catalogProvider(options), options));
        },
    );

    return router;
}

export default createVoiceFiltersCatalogRouter();
