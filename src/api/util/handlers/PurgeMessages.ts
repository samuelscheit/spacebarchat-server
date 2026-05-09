/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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

export const PURGE_DELETE_BATCH_SIZE = 100;

export async function deleteMessagesInBatches(
    fetchIds: (limit: number) => Promise<string[]>,
    deleteIds: (ids: string[]) => Promise<unknown>,
    afterDeleteBatch?: (ids: string[]) => Promise<unknown>,
    batchSize = PURGE_DELETE_BATCH_SIZE,
) {
    if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error("Purge delete batch size must be a positive integer");

    let deletedCount = 0;

    while (true) {
        const ids = await fetchIds(batchSize);
        if (ids.length === 0) break;

        await deleteIds(ids);
        deletedCount += ids.length;
        if (afterDeleteBatch) await afterDeleteBatch(ids);
    }

    return deletedCount;
}
