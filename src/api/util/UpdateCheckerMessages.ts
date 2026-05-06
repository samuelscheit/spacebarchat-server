export const STAFF_USER_FLAG = 1n << 0n;

export function hasStaffUserFlag(flags: number | string | bigint): boolean {
    return (BigInt(flags) & STAFF_USER_FLAG) === STAFF_USER_FLAG;
}

export interface BranchCommit {
    sha: string;
    html_url?: string;
    commit?: {
        message?: string;
        committer?: {
            date?: string;
        };
    };
}

export interface CompareCommit {
    sha: string;
    html_url?: string;
    commit?: {
        message?: string;
    };
}

export interface UpdateNotification {
    repository: string;
    branch: string;
    currentCommit: string;
    latestCommit: BranchCommit;
    compareUrl: string | null;
    commits: CompareCommit[];
}

export function shouldNotifyUpdate(currentCommit: string | null, latestCommit: string | null, lastNotifiedCommit: string | null): boolean {
    if (!currentCommit || !latestCommit) return false;
    if (currentCommit === latestCommit) return false;
    return latestCommit !== lastNotifiedCommit;
}

export function summarizeCommitMessages(commits: CompareCommit[], limit = 8): string {
    const subjects = commits.map((commit) => commit.commit?.message?.split("\n")[0]?.trim()).filter((subject): subject is string => !!subject);

    if (!subjects.length) return "No commit summary was available from GitHub.";

    const visible = subjects.slice(0, limit).map((subject) => `- ${subject}`);
    const remaining = subjects.length - visible.length;
    if (remaining > 0) visible.push(`- ...and ${remaining} more commit${remaining === 1 ? "" : "s"}.`);
    return visible.join("\n");
}

export function buildUpdateNotificationMessage(notification: UpdateNotification) {
    const shortCurrent = notification.currentCommit.slice(0, 7);
    const shortLatest = notification.latestCommit.sha.slice(0, 7);
    const compareLine = notification.compareUrl ? `\n\nCompare changes: ${notification.compareUrl}` : "";

    return {
        content: `A new Spacebar server update is available for ${notification.repository}@${notification.branch}.`,
        embeds: [
            {
                type: "rich",
                title: "Spacebar update available",
                description: `Your instance is running \`${shortCurrent}\`, and \`${shortLatest}\` is now available.${compareLine}`,
                color: 0x5865f2,
                fields: [
                    {
                        name: "What changed",
                        value: summarizeCommitMessages(notification.commits),
                        inline: false,
                    },
                    {
                        name: "Next step",
                        value: "Pull the latest server changes, rebuild, and restart this instance when you are ready.",
                        inline: false,
                    },
                ],
                footer: {
                    text: "Spacebar automatic update check",
                },
                timestamp: notification.latestCommit.commit?.committer?.date ? new Date(notification.latestCommit.commit.committer.date) : undefined,
            },
        ],
    };
}
