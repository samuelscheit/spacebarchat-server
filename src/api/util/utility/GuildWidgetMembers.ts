import type { GuildWidgetMemberStatus } from "@spacebar/schemas";
import { getMostRelevantSession, type Session } from "@spacebar/util";

const widgetMemberStatuses = new Set<GuildWidgetMemberStatus>(["online", "idle", "dnd"]);

export function getWidgetMemberStatus(sessions: Pick<Session, "activities" | "getPublicStatus" | "is_admin_session" | "last_seen" | "status">[], activeSince: Date) {
    const activePublicSessions = sessions.filter((session) => {
        if (session.is_admin_session) return false;
        if ((session.last_seen?.getTime() ?? 0) <= activeSince.getTime()) return false;

        return widgetMemberStatuses.has(session.getPublicStatus() as GuildWidgetMemberStatus);
    });

    const session = getMostRelevantSession(activePublicSessions as Session[]);
    const status = session?.getPublicStatus();

    return widgetMemberStatuses.has(status as GuildWidgetMemberStatus) ? (status as GuildWidgetMemberStatus) : undefined;
}
