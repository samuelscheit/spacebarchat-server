import type { Session } from "../entities/Session";

export function getMostRelevantSession(sessions: Session[]) {
    const statusMap = {
        online: 0,
        idle: 1,
        dnd: 2,
        invisible: 3,
        offline: 4,
        unknown: 5,
    };
    // sort sessions by relevance
    sessions = sessions.sort((a, b) => {
        const statusPriority = statusMap[a.status] - statusMap[b.status];
        if (statusPriority !== 0) return statusPriority;

        return (a.activities?.length ?? 0) - (b.activities?.length ?? 0);
    });

    return sessions[0];
}
