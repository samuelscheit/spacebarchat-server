import { Channel, Config, type ConfigValue, getRevInfoOrFail, Rights, shouldRunUpdateCheckerInCurrentProcess, User } from "@spacebar/util";
import { sendMessage } from "./handlers/Message";
import type { Embed } from "@spacebar/schemas";
import cluster from "node:cluster";
import { Raw } from "typeorm";
import {
    BranchCommit,
    buildUpdateNotificationMessage,
    CommitComparison,
    CommitComparisonStatus,
    CompareCommit,
    NotificationDeliveryResult,
    shouldFetchUpdateComparison,
    shouldNotifyUpdate,
    shouldRecordNotificationDelivery,
    STAFF_USER_FLAG,
    UpdateNotification,
} from "./UpdateCheckerMessages";

export {
    buildUpdateNotificationMessage,
    hasStaffUserFlag,
    shouldFetchUpdateComparison,
    shouldNotifyUpdate,
    shouldRecordNotificationDelivery,
    summarizeCommitMessages,
} from "./UpdateCheckerMessages";

const systemFlag = 1n << 12n;
const updateBotId = "0";
let updateCheckerIntervalTimer: NodeJS.Timeout | undefined;
let updateCheckerInitialTimer: NodeJS.Timeout | undefined;
let updateCheckerInFlight = false;

export interface UpdateCheckerConfig {
    enabled: boolean;
    repository: string;
    branch: string;
    intervalSeconds: number;
    requestTimeoutSeconds: number;
    lastNotifiedCommit: string | null;
}

export interface UpdateCheckerDependencies {
    getConfig(): UpdateCheckerConfig;
    getCurrentCommit(): string | null;
    fetchLatestBranchCommit(config: UpdateCheckerConfig, signal?: AbortSignal): Promise<BranchCommit | null>;
    fetchCommitsSince(config: UpdateCheckerConfig, currentCommit: string, latestCommit: string, signal?: AbortSignal): Promise<CommitComparison>;
    notifyStaffUsers(notification: UpdateNotification): Promise<NotificationDeliveryResult>;
    setLastNotifiedCommit(config: UpdateCheckerConfig, lastNotifiedCommit: string): Promise<void>;
    logError(message: string, error: unknown): void;
}

const githubApiBaseUrl = "https://api.github.com";

function encodeGitHubRepositoryPath(repository: string): string {
    const parts = repository.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`Invalid GitHub repository '${repository}'. Expected owner/repo.`);

    return parts.map((part) => encodeURIComponent(part)).join("/");
}

export function buildGitHubBranchApiUrl(config: Pick<UpdateCheckerConfig, "repository" | "branch">): string {
    return `${githubApiBaseUrl}/repos/${encodeGitHubRepositoryPath(config.repository)}/branches/${encodeURIComponent(config.branch)}`;
}

export function buildGitHubCompareApiUrl(config: Pick<UpdateCheckerConfig, "repository">, currentCommit: string, latestCommit: string): string {
    return `${githubApiBaseUrl}/repos/${encodeGitHubRepositoryPath(config.repository)}/compare/${encodeURIComponent(currentCommit)}...${encodeURIComponent(latestCommit)}`;
}

function parseCommitComparisonStatus(status: string | undefined): CommitComparisonStatus | null {
    if (status === "ahead" || status === "behind" || status === "diverged" || status === "identical") return status;
    return null;
}

export async function withUpdateCheckRequestTimeout<T>(timeoutSeconds: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(timeoutSeconds, 1) * 1000);
    timeout.unref?.();

    try {
        return await operation(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchLatestBranchCommit(config: UpdateCheckerConfig, signal?: AbortSignal): Promise<BranchCommit | null> {
    const response = await fetch(buildGitHubBranchApiUrl(config), {
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

export async function fetchCommitsSince(config: UpdateCheckerConfig, currentCommit: string, latestCommit: string, signal?: AbortSignal): Promise<CommitComparison> {
    const response = await fetch(buildGitHubCompareApiUrl(config, currentCommit, latestCommit), {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "spacebar-server-update-checker",
        },
        signal,
    });

    if (response.status === 404) return { html_url: null, status: null, commits: [] as CompareCommit[] };
    if (!response.ok) throw new Error(`GitHub compare lookup failed with HTTP ${response.status}`);

    const data = (await response.json()) as { html_url?: string; status?: string; commits?: CompareCommit[] };
    return {
        html_url: data.html_url ?? null,
        status: parseCommitComparisonStatus(data.status),
        commits: data.commits ?? [],
    };
}

export async function findStaffUsers(): Promise<Pick<User, "id" | "flags">[]> {
    return User.find({
        select: {
            id: true,
            flags: true,
        },
        where: {
            disabled: false,
            deleted: false,
            flags: Raw((alias) => `(${alias} & :staffFlag) = :staffFlag`, { staffFlag: Number(STAFF_USER_FLAG) }),
        },
    });
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

export async function notifyStaffUsers(notification: UpdateNotification): Promise<NotificationDeliveryResult> {
    const [botUser, staffUsers] = await Promise.all([ensureUpdateBotUser(), findStaffUsers()]);
    if (!staffUsers.length) return { attempted: 0, sent: 0 };

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

    return { attempted: staffUsers.length, sent };
}

const defaultUpdateCheckerDependencies: UpdateCheckerDependencies = {
    getConfig: () => Config.get().updates,
    getCurrentCommit: () => getRevInfoOrFail().rev,
    fetchLatestBranchCommit,
    fetchCommitsSince,
    notifyStaffUsers,
    setLastNotifiedCommit: async (config, lastNotifiedCommit) => {
        const update: Partial<ConfigValue> = {
            updates: {
                ...config,
                lastNotifiedCommit,
            },
        };

        await Config.set(update);
    },
    logError: (message, error) => console.error(message, error),
};

export async function runUpdateCheck(dependencies: UpdateCheckerDependencies = defaultUpdateCheckerDependencies): Promise<void> {
    if (updateCheckerInFlight) return;
    updateCheckerInFlight = true;

    try {
        const config = dependencies.getConfig();
        if (!config.enabled) return;

        const currentCommit = dependencies.getCurrentCommit();
        const latestCommit = await withUpdateCheckRequestTimeout(config.requestTimeoutSeconds, (signal) => dependencies.fetchLatestBranchCommit(config, signal));
        if (!shouldFetchUpdateComparison(currentCommit, latestCommit?.sha ?? null, config.lastNotifiedCommit)) return;
        if (!currentCommit || !latestCommit) return;

        const compare = await withUpdateCheckRequestTimeout(config.requestTimeoutSeconds, (signal) =>
            dependencies.fetchCommitsSince(config, currentCommit, latestCommit.sha, signal),
        );
        if (!shouldNotifyUpdate(currentCommit, latestCommit.sha, config.lastNotifiedCommit, compare.status)) return;

        const delivery = await dependencies.notifyStaffUsers({
            repository: config.repository,
            branch: config.branch,
            currentCommit,
            latestCommit,
            compareUrl: compare.html_url,
            commits: compare.commits,
        });

        if (shouldRecordNotificationDelivery(delivery)) await dependencies.setLastNotifiedCommit(config, latestCommit.sha);
    } catch (error) {
        dependencies.logError("[UpdateChecker] Failed to check for server updates:", error);
    } finally {
        updateCheckerInFlight = false;
    }
}

export function startUpdateChecker(): void {
    if (process.env.NODE_ENV === "test" || process.env.DISABLE_UPDATE_CHECKS === "true") return;
    if (!shouldRunUpdateCheckerInCurrentProcess(cluster.isWorker)) return;

    const config = Config.get().updates;
    if (!config.enabled || updateCheckerIntervalTimer || updateCheckerInitialTimer) return;

    const intervalMs = Math.max(config.intervalSeconds, 60) * 1000;
    updateCheckerIntervalTimer = setInterval(() => void runUpdateCheck(), intervalMs);
    updateCheckerIntervalTimer.unref?.();

    updateCheckerInitialTimer = setTimeout(() => {
        updateCheckerInitialTimer = undefined;
        void runUpdateCheck();
    }, 30_000);
    updateCheckerInitialTimer.unref?.();
}

export function stopUpdateChecker(): void {
    if (updateCheckerIntervalTimer) {
        clearInterval(updateCheckerIntervalTimer);
        updateCheckerIntervalTimer = undefined;
    }

    if (updateCheckerInitialTimer) {
        clearTimeout(updateCheckerInitialTimer);
        updateCheckerInitialTimer = undefined;
    }
}

export function getUpdateCheckerTimerState() {
    return {
        initial: updateCheckerInitialTimer !== undefined,
        interval: updateCheckerIntervalTimer !== undefined,
    };
}
