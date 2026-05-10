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

export enum ApplicationUndeletableReason {
    UNKNOWN = 0,
    USER_THRESHOLD_EXCEEDED = 1,
    SOCIAL_SDK_APP_DELETION_ERROR = 2,
    PARENT_HAS_CHILD_APPLICATIONS = 3,
}

export interface ApplicationCanDeleteResponse {
    deletable?: boolean | null;
    reason?: ApplicationUndeletableReason | null;
}
