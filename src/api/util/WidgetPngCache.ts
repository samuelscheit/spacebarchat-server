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

export type WidgetPngCacheResult = {
    data: Promise<Buffer>;
    expiresAt: number;
};

type WidgetPngCacheEntry = WidgetPngCacheResult & {
    pending: boolean;
};

export function getWidgetPngCacheRemainingSeconds(expiresAt: number, now = Date.now()) {
    return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

export function getWidgetPngCacheControl(expiresAt: number, now = Date.now()) {
    const remainingSeconds = getWidgetPngCacheRemainingSeconds(expiresAt, now);
    return `public, max-age=${remainingSeconds}, s-maxage=${remainingSeconds}, immutable`;
}

export class WidgetPngResponseCache {
    private readonly entries = new Map<string, WidgetPngCacheEntry>();

    constructor(private readonly ttlMs: number) {}

    get size() {
        return this.entries.size;
    }

    getOrCreate(key: string, render: () => Promise<Buffer>, now = Date.now()): WidgetPngCacheResult {
        this.pruneExpired(now);

        const existing = this.entries.get(key);
        if (existing && (existing.pending || existing.expiresAt > now)) return existing;

        const entry: WidgetPngCacheEntry = {
            data: this.createRenderPromise(render),
            expiresAt: now + this.ttlMs,
            pending: true,
        };

        entry.data.then(
            () => {
                entry.pending = false;
            },
            () => {
                if (this.entries.get(key) === entry) this.entries.delete(key);
            },
        );

        this.entries.set(key, entry);
        return entry;
    }

    clear() {
        this.entries.clear();
    }

    private createRenderPromise(render: () => Promise<Buffer>) {
        try {
            return Promise.resolve(render());
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private pruneExpired(now: number) {
        for (const [key, entry] of this.entries) {
            if (!entry.pending && entry.expiresAt <= now) this.entries.delete(key);
        }
    }
}
