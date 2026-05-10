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

export interface VoiceFiltersCatalogResponse {
    limited_time_voices: VoiceFiltersCatalogLimitedTimeVoicesResponse;
    models?: VoiceFilterModelsResponse;
    voices?: VoiceFilterResponse[];
}

export interface VoiceFilterModelsResponse {
    [model_id: string]: VoiceFilterModelResponse;
}

export interface VoiceFiltersCatalogLimitedTimeVoicesResponse {
    current_set: string[];
    current_set_start?: string;
    current_set_end?: string;
    next_set: string[];
    next_set_start?: string;
    next_set_end?: string;
}

export interface VoiceFilterModelResponse {
    url: string;
}

export interface VoiceFilterResponse {
    id: string;
    models?: string[] | VoiceFilterEmptyModelReferencesResponse;
    requires_premium: boolean;
    limited_time_free_ends?: string;
    limited_time_free_starts?: string;
    available: boolean;
}

export type VoiceFilterEmptyModelReferencesResponse = Record<string, never>;
