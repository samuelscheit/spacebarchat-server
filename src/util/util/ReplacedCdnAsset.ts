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

export interface DeleteReplacedCdnAssetOptions {
    deleteAsset?: (path: string) => Promise<unknown>;
    logWarning?: (message: string, error: unknown) => void;
}

async function deleteCdnAsset(path: string) {
    const { deleteFile } = await import("./cdn.js");
    return deleteFile(path);
}

export async function deleteReplacedCdnAsset(
    pathPrefix: string,
    previousHash: string | null | undefined,
    nextHash: string | null | undefined,
    options: DeleteReplacedCdnAssetOptions = {},
) {
    if (!previousHash || previousHash === nextHash) return;

    const path = `${pathPrefix}/${previousHash}`;

    try {
        await (options.deleteAsset ?? deleteCdnAsset)(path);
    } catch (error) {
        (options.logWarning ?? console.warn)(`[CDN] Failed to delete replaced asset at ${path}`, error);
    }
}
