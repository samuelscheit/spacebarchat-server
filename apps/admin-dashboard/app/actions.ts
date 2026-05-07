"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { adminFetch } from "./lib/admin-api";
import { dashboardAbsoluteUrl, setAdminSessionToken, validateAdminToken } from "./lib/admin-session";
import {
    buildCdnAttachmentFsckRequest,
    buildCdnAttachmentMigrationRequest,
    buildChannelDeletionRequest,
    buildDiscoveryGuildUpdateRequest,
    buildForceJoinGuildRequest,
    buildJobCancellationRequest,
    buildUpdateConfigurationRequest,
    buildUserDeletionRequest,
    submitActionRequest,
} from "./lib/action-requests.mjs";

function formString(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
}

function actionErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function safeReturnTo(formData: FormData, fallback: string) {
    const value = formString(formData, "returnTo");
    if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
    return value;
}

function redirectWithActionResult(formData: FormData, fallback: string, key: "actionSuccess" | "actionError", message: string): never {
    const target = new URL(safeReturnTo(formData, fallback), "http://spacebar.local");
    target.searchParams.delete("actionSuccess");
    target.searchParams.delete("actionError");
    target.searchParams.set(key, message);
    redirect(`${target.pathname}${target.search}${target.hash}`);
}

async function runDashboardAction(formData: FormData, fallback: string, successMessage: string, operation: () => Promise<void>) {
    try {
        await operation();
    } catch (error) {
        redirectWithActionResult(formData, fallback, "actionError", actionErrorMessage(error));
    }

    redirectWithActionResult(formData, fallback, "actionSuccess", successMessage);
}

export async function reloadConfiguration(formData: FormData) {
    await runDashboardAction(formData, "/configuration", "Configuration reload requested.", async () => {
        await adminFetch("/configuration/reload", { method: "POST" });
        revalidatePath("/configuration");
    });
}

export async function loginAdmin(formData: FormData) {
    const value = formData.get("token");
    const token = typeof value === "string" ? value : "";
    const validation = await validateAdminToken(token);

    if (!validation.ok) {
        redirect(`/login?reason=${validation.reason}`);
    }

    await setAdminSessionToken(token);
    redirect(await dashboardAbsoluteUrl("/"));
}

export async function updateConfiguration(formData: FormData) {
    await runDashboardAction(formData, "/configuration", "Configuration saved.", async () => {
        await submitActionRequest(buildUpdateConfigurationRequest(formData), adminFetch);
        revalidatePath("/configuration");
    });
}

export async function updateDiscoveryGuild(formData: FormData) {
    await runDashboardAction(formData, "/discovery", "Discovery guild updated.", async () => {
        await submitActionRequest(buildDiscoveryGuildUpdateRequest(formData), adminFetch);
        revalidatePath("/discovery");
    });
}

export async function startUserDeletion(formData: FormData) {
    await runDashboardAction(formData, "/users", "User deletion job queued.", async () => {
        await submitActionRequest(buildUserDeletionRequest(formData, randomUUID), adminFetch);
        revalidatePath("/users");
        revalidatePath("/jobs");
    });
}

export async function deleteChannel(formData: FormData) {
    await runDashboardAction(formData, "/channels", "Channel deletion completed.", async () => {
        await submitActionRequest(buildChannelDeletionRequest(formData), adminFetch);
        revalidatePath("/channels");
    });
}

export async function forceJoinGuild(formData: FormData) {
    const guildId = formString(formData, "guildId");
    await runDashboardAction(formData, guildId ? `/guilds/${guildId}` : "/guilds", "Guild membership updated.", async () => {
        const request = buildForceJoinGuildRequest(formData);
        await submitActionRequest(request, adminFetch);
        const updatedGuildId = request.path.split("/")[2];
        revalidatePath(`/guilds/${updatedGuildId}`);
    });
}

export async function startCdnAttachmentFsck(formData: FormData) {
    await runDashboardAction(formData, "/media", "Attachment fsck job queued.", async () => {
        await submitActionRequest(buildCdnAttachmentFsckRequest(formData, randomUUID), adminFetch);
        revalidatePath("/media");
        revalidatePath("/jobs");
    });
}

export async function startCdnAttachmentMigration(formData: FormData) {
    await runDashboardAction(formData, "/media", "Attachment migration job queued.", async () => {
        await submitActionRequest(buildCdnAttachmentMigrationRequest(formData, randomUUID), adminFetch);
        revalidatePath("/media");
        revalidatePath("/jobs");
    });
}

export async function cancelJob(formData: FormData) {
    await runDashboardAction(formData, "/jobs", "Job cancellation requested.", async () => {
        await submitActionRequest(buildJobCancellationRequest(formData), adminFetch);
        revalidatePath("/jobs");
    });
}
