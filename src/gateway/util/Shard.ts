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

export type GatewayShard = {
    id: bigint;
    count: bigint;
};

function toShardBigInt(value: unknown): bigint | undefined {
    if (typeof value === "bigint") return value;

    if (typeof value === "number") {
        if (!Number.isSafeInteger(value)) return undefined;
        return BigInt(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!/^-?\d+$/.test(trimmed)) return undefined;

        return BigInt(trimmed);
    }

    return undefined;
}

export function createGatewayShard(shard: readonly unknown[] | undefined): GatewayShard | undefined {
    if (!shard) return undefined;
    if (!Array.isArray(shard) || shard.length !== 2) return undefined;

    const [idValue, countValue] = shard;
    const id = toShardBigInt(idValue);
    const count = toShardBigInt(countValue);
    if (id == null || count == null || id < 0n || count <= 0n || id >= count) return undefined;

    return { id, count };
}

export function getShardIdForGuild(guildId: string, shardCount: bigint): bigint {
    if (shardCount <= 0n) throw new RangeError("shardCount must be greater than 0");

    return (BigInt(guildId) >> 22n) % shardCount;
}

export function isGuildOnShard(guildId: string, shard: GatewayShard | undefined): boolean {
    if (!shard) return true;

    return getShardIdForGuild(guildId, shard.count) === shard.id;
}
