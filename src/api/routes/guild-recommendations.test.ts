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

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { Config, Guild } from "@spacebar/util";
import { ErrorHandler } from "../middlewares";
import guildRecommendationsRouter from "./guild-recommendations";

type MutableConfig = {
    get: typeof Config.get;
};

type MutableGuild = {
    find: typeof Guild.find;
};

const mutableConfig = Config as unknown as MutableConfig;
const mutableGuild = Guild as unknown as MutableGuild;

async function withGuildRecommendationsServer(callback: (url: string) => Promise<void>) {
    const app = express();
    app.use("/guild-recommendations", guildRecommendationsRouter);
    app.use(ErrorHandler);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert(address && typeof address === "object");

    try {
        await callback(`http://${address.address}:${address.port}/guild-recommendations`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function getJson(url: string): Promise<{ statusCode: number | undefined; body: unknown }> {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: "GET" }, (res) => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        body: data ? JSON.parse(data) : null,
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on("error", reject);
        req.end();
    });
}

test("guild recommendations route returns 404 and skips guild lookups when disabled by default", async () => {
    const originalFind = mutableGuild.find;
    let guildLookupCalled = false;
    mutableGuild.find = (async () => {
        guildLookupCalled = true;
        return [] as Guild[];
    }) as typeof Guild.find;

    try {
        await withGuildRecommendationsServer(async (url) => {
            const response = await getJson(url);

            assert.equal(response.statusCode, 404);
            const body = response.body as { code?: number; message?: string };

            assert.equal(body.code, 404);
            assert.match(body.message ?? "", /Guild recommendations are disabled/);
        });
        assert.equal(guildLookupCalled, false);
    } finally {
        mutableGuild.find = originalFind;
    }
});

test("guild recommendations route queries guilds when explicitly enabled", async () => {
    const originalGet = mutableConfig.get;
    const originalFind = mutableGuild.find;
    let receivedFindOptions: unknown;

    mutableConfig.get = (() => {
        const config = originalGet();
        return {
            ...config,
            guild: {
                ...config.guild,
                discovery: {
                    ...config.guild.discovery,
                    useRecommendation: true,
                    showAllGuilds: false,
                },
            },
        };
    }) as typeof Config.get;
    mutableGuild.find = (async (options?: unknown) => {
        receivedFindOptions = options;
        return [
            {
                id: "100",
                name: "Discoverable guild",
                icon: null,
                banner: null,
                splash: null,
                description: "Visible when recommendations are enabled",
                features: ["DISCOVERABLE"],
                preferred_locale: "en-US",
                premium_subscription_count: 0,
                member_count: 1,
                verification_level: 0,
                default_message_notifications: 0,
                explicit_content_filter: 0,
                mfa_level: 0,
                large: false,
                max_members: 500000,
                max_presences: null,
                max_video_channel_users: 25,
                owner_id: "10",
                premium_tier: 0,
                region: "deprecated",
                system_channel_id: null,
                rules_channel_id: null,
                public_updates_channel_id: null,
                afk_channel_id: null,
                afk_timeout: 300,
                system_channel_flags: 0,
                widget_channel_id: null,
                widget_enabled: false,
                welcome_screen: null,
                nsfw_level: 0,
                premium_progress_bar_enabled: false,
                unavailable: false,
            },
        ] as unknown as Guild[];
    }) as typeof Guild.find;

    try {
        await withGuildRecommendationsServer(async (url) => {
            const response = await getJson(url);
            const body = response.body as {
                recommended_guilds?: { id?: string }[];
                load_id?: string;
            };

            assert.equal(response.statusCode, 200);
            assert.equal(body.recommended_guilds?.[0]?.id, "100");
            assert.match(body.load_id ?? "", /^server_recs\/[0-9a-f]{32}$/);
        });
        assert.equal((receivedFindOptions as { take?: number }).take, 24);
        assert.ok((receivedFindOptions as { where?: unknown }).where);
    } finally {
        mutableConfig.get = originalGet;
        mutableGuild.find = originalFind;
    }
});
