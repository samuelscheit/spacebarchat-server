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

export interface ExperimentsResponse {
    fingerprint?: string;
    assignments: number[][];
    guild_experiments: number[][];
}

export interface ApexExperimentUnitAssignments {
    evaluation_id: string;
    assignments: number[][];
}

export interface ApexExperimentsResponse {
    assignments: {
        [unit_type: string]: {
            [unit_id: string]: ApexExperimentUnitAssignments;
        };
    };
    installation?: string;
}

export const enum ApexExperimentVariantType {
    ACTIVE = 1,
    UNUSED = 2,
    BURNED = 3,
    PRESERVED = 4,
}

export interface ApexExperimentVariantMetadata {
    id: number;
    label: string;
    type: ApexExperimentVariantType;
}

export interface ApexExperimentMetadata {
    id: number;
    name: string;
    title: string;
    revision: number;
    unit_type: number;
    variants: ApexExperimentVariantMetadata[];
}

export interface ApexExperimentsMetadataResponse {
    experiments: ApexExperimentMetadata[];
}
