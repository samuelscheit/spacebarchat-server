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

export enum ConnectionSyncSuggestionsSetting {
    mutual_contact_info_only = 1,
    anyone_with_contact_info = 2,
}

export interface ConnectionSyncExternalFriendListEntry {
    /**
     * @pattern ^\+[1-9]\d{1,14}$
     */
    friend_id: string;
}

export interface ConnectionSyncExternalFriendListEntriesPutSchema {
    /**
     * @maxItems 10000
     */
    friend_list_entries: ConnectionSyncExternalFriendListEntry[];
    background: boolean;
    allowed_in_suggestions: ConnectionSyncSuggestionsSetting;
    include_mutual_friends_count: boolean;
    add_reverse_friend_suggestions?: boolean;
}
