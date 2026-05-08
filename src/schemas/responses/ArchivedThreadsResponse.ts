import type { ActiveThreadsChannel, ActiveThreadsThreadMember } from "./ActiveThreadsResponse";

export interface ArchivedThreadsResponse {
    threads: ActiveThreadsChannel[];
    members: ActiveThreadsThreadMember[];
    has_more: boolean;
}
