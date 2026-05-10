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

export interface UserProfileEffectsResponse {
    profile_effect_configs: UserProfileEffectConfig[];
}

export interface UserProfileEffectConfig {
    type: number;
    id: string;
    sku_id: string;
    title: string;
    description: string;
    accessibilityLabel: string;
    animationType: number;
    thumbnailPreviewSrc: string;
    reducedMotionSrc: string;
    staticFrameSrc: string;
    effects: UserProfileEffectAnimation[];
}

export interface UserProfileEffectAnimation {
    src: string;
    loop: boolean;
    height: number;
    width: number;
    duration: number;
    start: number;
    loopDelay: number;
    position: UserProfileEffectPosition;
    zIndex: number;
    randomizedSources: UserProfileEffectSource[];
}

export interface UserProfileEffectPosition {
    x: number;
    y: number;
}

export interface UserProfileEffectSource {
    src: string;
}
