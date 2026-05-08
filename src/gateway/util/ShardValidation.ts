/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export interface GatewayShard {
    shard_id: bigint;
    shard_count: bigint;
}

const IntegerString = /^-?\d+$/;

function toShardInteger(value: unknown) {
    if (typeof value === "bigint") return value;

    if (typeof value === "number") {
        if (!Number.isFinite(value) || !Number.isInteger(value)) return undefined;
        return BigInt(value);
    }

    if (typeof value === "string") {
        if (!IntegerString.test(value)) return undefined;
        return BigInt(value);
    }

    return undefined;
}

export function parseGatewayShard(shard: unknown): GatewayShard | undefined {
    if (!Array.isArray(shard) || shard.length !== 2) return undefined;

    const shard_id = toShardInteger(shard[0]);
    const shard_count = toShardInteger(shard[1]);

    if (shard_id == null || shard_count == null) return undefined;
    if (shard_id < 0n || shard_count <= 0n || shard_id >= shard_count) return undefined;

    return { shard_id, shard_count };
}
