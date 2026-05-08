import { ActivityType, type Activity } from "../interfaces/Activity";
import type { Status } from "../interfaces/Status";

export function isSpotifyActivity(activity: Activity) {
    return (
        activity.type === ActivityType.LISTENING &&
        (activity.name.toLowerCase() === "spotify" || activity.id?.startsWith("spotify:") === true || activity.metadata?.context_uri?.startsWith("spotify:") === true)
    );
}

export function getPrivateGatewayActivities(status: Status, activities: Activity[] = [], showCurrentGame?: boolean | null) {
    if (status === "offline" || status === "invisible") {
        return { activities: [], hidden_activities: activities };
    }

    if (showCurrentGame ?? true) {
        return { activities, hidden_activities: [] };
    }

    const visibleActivities: Activity[] = [];
    const hiddenActivities: Activity[] = [];

    for (const activity of activities) {
        (isSpotifyActivity(activity) ? visibleActivities : hiddenActivities).push(activity);
    }

    return { activities: visibleActivities, hidden_activities: hiddenActivities };
}
