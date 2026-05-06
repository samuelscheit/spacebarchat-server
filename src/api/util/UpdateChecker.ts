import { Channel, Config, getRevInfoOrFail, Rights, User } from "@spacebar/util";
import { sendMessage } from "./handlers/Message";
import type { Embed } from "@spacebar/schemas";
import cluster from "node:cluster";
import { BranchCommit, buildUpdateNotificationMessage, CompareCommit, hasStaffUserFlag, shouldNotifyUpdate, UpdateNotification } from "./UpdateCheckerMessages";

export { buildUpdateNotificationMessage, hasStaffUserFlag, shouldNotifyUpdate, summarizeCommitMessages } from "./UpdateCheckerMessages";

const systemFlag = 1n << 12n;
const updateBotId = "0";
let updateCheckerTimer: NodeJS.Timeout | undefined;
let updateCheckerInFlight = false;

export interface UpdateCheckerConfig {
    enabled: boolean;
    repository: string;
    branch: string;
    intervalSeconds: number;
    requestTimeoutSeconds: number;
    lastNotifiedCommit: string | null;
}

export async function fetchLatestBranchCommit(config: UpdateCheckerConfig, signal?: AbortSignal): Promise<BranchCommit | null> {
    const response = await fetch(`https://api.github.com/repos/${config.repository}/branches/${config.branch}`, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "spacebar-server-update-checker",
        },
        signal,
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub branch lookup failed with HTTP ${response.status}`);

    const data = (await response.json()) as { commit?: BranchCommit };
    return data.commit?.sha ? data.commit : null;
}

export async function fetchCommitsSince(config: UpdateCheckerConfig, currentCommit: string, latestCommit: string, signal?: AbortSignal) {
    const response = await fetch(`https://api.github.com/repos/${config.repository}/compare/${currentCommit}...${latestCommit}`, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "spacebar-server-update-checker",
        },
        signal,
    });

    if (response.status === 404) return { html_url: null, commits: [] as CompareCommit[] };
    if (!response.ok) throw new Error(`GitHub compare lookup failed with HTTP ${response.status}`);

    const data = (await response.json()) as { html_url?: string; commits?: CompareCommit[] };
    return {
        html_url: data.html_url ?? null,
        commits: data.commits ?? [],
    };
}

export async function findStaffUsers(): Promise<Pick<User, "id" | "flags">[]> {
    const users = await User.find({
        select: {
            id: true,
            flags: true,
        },
        where: {
            disabled: false,
            deleted: false,
        },
    });

    return users.filter((user) => hasStaffUserFlag(user.flags));
}

async function ensureUpdateBotUser(): Promise<User> {
    const existing = await User.findOne({ where: { id: updateBotId } });
    if (existing) return existing;

    const user = User.create({
        id: updateBotId,
        username: "Spacebar Updates",
        discriminator: "0000",
        avatar: undefined,
        public_flags: Number(systemFlag),
        flags: Number(systemFlag),
        purchased_flags: 0,
        premium_usage_flags: 0,
        premium: false,
        premium_type: 0,
        bot: true,
        system: true,
        bio: "",
        created_at: new Date(),
        verified: true,
        disabled: false,
        deleted: false,
        rights: Rights.FLAGS.SEND_MESSAGES.toString(),
        data: {
            valid_tokens_since: new Date(),
        },
        fingerprints: [],
    }) as User;

    return user.save();
}

export async function notifyStaffUsers(notification: UpdateNotification): Promise<number> {
    const [botUser, staffUsers] = await Promise.all([ensureUpdateBotUser(), findStaffUsers()]);
    if (!staffUsers.length) return 0;

    const message = buildUpdateNotificationMessage(notification);
    let sent = 0;

    for (const staffUser of staffUsers) {
        try {
            const dmChannel = await Channel.createDMChannel([botUser.id], staffUser.id);
            await sendMessage({
                channel_id: dmChannel.id,
                author_id: botUser.id,
                content: message.content,
                embeds: message.embeds as Embed[],
            });
            sent++;
        } catch (error) {
            console.error(`[UpdateChecker] Failed to notify staff user ${staffUser.id}:`, error);
        }
    }

    return sent;
}

export async function runUpdateCheck(): Promise<void> {
    if (updateCheckerInFlight) return;
    updateCheckerInFlight = true;

    try {
        const config = Config.get().updates;
        if (!config.enabled) return;

        const revInfo = getRevInfoOrFail();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.max(config.requestTimeoutSeconds, 1) * 1000);
        timeout.unref?.();

        try {
            const latestCommit = await fetchLatestBranchCommit(config, controller.signal);
            if (!shouldNotifyUpdate(revInfo.rev, latestCommit?.sha ?? null, config.lastNotifiedCommit)) return;

            const compare = await fetchCommitsSince(config, revInfo.rev!, latestCommit!.sha, controller.signal);
            const sent = await notifyStaffUsers({
                repository: config.repository,
                branch: config.branch,
                currentCommit: revInfo.rev!,
                latestCommit: latestCommit!,
                compareUrl: compare.html_url,
                commits: compare.commits,
            });

            if (sent > 0) {
                await Config.set({
                    updates: {
                        ...config,
                        lastNotifiedCommit: latestCommit!.sha,
                    },
                });
            }
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        console.error("[UpdateChecker] Failed to check for server updates:", error);
    } finally {
        updateCheckerInFlight = false;
    }
}

export function startUpdateChecker(): void {
    if (process.env.NODE_ENV === "test" || process.env.DISABLE_UPDATE_CHECKS === "true") return;
    if (cluster.isWorker && cluster.worker?.id !== 1) return;

    const config = Config.get().updates;
    if (!config.enabled || updateCheckerTimer) return;

    const intervalMs = Math.max(config.intervalSeconds, 60) * 1000;
    updateCheckerTimer = setInterval(() => void runUpdateCheck(), intervalMs);
    updateCheckerTimer.unref?.();

    const initialCheck = setTimeout(() => void runUpdateCheck(), 30_000);
    initialCheck.unref?.();
}

export function stopUpdateChecker(): void {
    if (!updateCheckerTimer) return;
    clearInterval(updateCheckerTimer);
    updateCheckerTimer = undefined;
}
