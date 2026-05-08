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

import { isRealGatewaySessionId, Session, TimeSpan } from "@spacebar/util";
import { setInterval } from "node:timers";

export const UNUSED_LEGACY_SESSION_LAST_SEEN = "1970/01/01";
export const UNUSED_LEGACY_SESSION_QUERY = "last_seen = :lastSeen";
export const UNUSED_LEGACY_SESSION_ID_QUERY = "(session_id = :allSessionId OR session_id LIKE :temporarySessionPattern)";
export const UNUSED_LEGACY_SESSION_MAX_AGE_MS = 1000 * 60 * 60;
export const UNUSED_LEGACY_SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 5;
export const UNUSED_LEGACY_SESSION_QUERY_PARAMETERS = {
    lastSeen: UNUSED_LEGACY_SESSION_LAST_SEEN,
    allSessionId: "all",
    temporarySessionPattern: "TEMP_%",
};

type UnusedLegacySessionRow = {
    session_created_at: Date;
    session_session_id: string;
};

function canExpireUnusedLegacySession(session: UnusedLegacySessionRow, now: Date) {
    return (
        !isRealGatewaySessionId(session.session_session_id) &&
        TimeSpan.fromDates(session.session_created_at.getTime(), now.getTime()).totalMillis > UNUSED_LEGACY_SESSION_MAX_AGE_MS
    );
}

export async function expireUnusedLegacySessions(now = new Date()) {
    for await (const session of (await Session.createQueryBuilder("session")
        .where(UNUSED_LEGACY_SESSION_QUERY, { lastSeen: UNUSED_LEGACY_SESSION_QUERY_PARAMETERS.lastSeen })
        .andWhere(UNUSED_LEGACY_SESSION_ID_QUERY, {
            allSessionId: UNUSED_LEGACY_SESSION_QUERY_PARAMETERS.allSessionId,
            temporarySessionPattern: UNUSED_LEGACY_SESSION_QUERY_PARAMETERS.temporarySessionPattern,
        })
        .select()
        .stream()) as AsyncIterable<UnusedLegacySessionRow>) {
        // session object has all fields prefixed with `session_`... thanks typeorm
        if (canExpireUnusedLegacySession(session, now)) {
            console.log(`[API/Instance.ts] Deleting unused session ${session.session_session_id} created at ${session.session_created_at}`);
            await Session.delete({ session_id: session.session_session_id });
        }
    }
}

export async function initInstance() {
    // TODO: clean up database and delete tombstone data
    // TODO: set first user as instance administrator/or generate one if none exists and output it in the terminal

    // create default guild and add it to auto join
    // TODO: check if any current user is not part of autoJoinGuilds
    // const { autoJoin } = Config.get().guild;

    // if (autoJoin.enabled && !autoJoin.guilds?.length) {
    // 	const guild = await Guild.findOne({ where: {}, select: ["id"] });
    // 	if (guild) {
    // 		await Config.set({ guild: { autoJoin: { guilds: [guild.id] } } });
    // 	}
    // }

    // Expire unused sessions left behind by legacy tokens without clearing current auth sessions.
    setInterval(() => void expireUnusedLegacySessions(), UNUSED_LEGACY_SESSION_CLEANUP_INTERVAL_MS);
}
