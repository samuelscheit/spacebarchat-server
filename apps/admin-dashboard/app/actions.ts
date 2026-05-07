"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { adminFetch } from "./lib/admin-api";
import { setAdminSessionToken, validateAdminToken } from "./lib/admin-session";
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

export async function reloadConfiguration() {
    await adminFetch("/configuration/reload", { method: "POST" });
    revalidatePath("/configuration");
}

export async function loginAdmin(formData: FormData) {
    const value = formData.get("token");
    const token = typeof value === "string" ? value : "";
    const validation = await validateAdminToken(token);

    if (!validation.ok) {
        redirect(`/login?reason=${validation.reason}`);
    }

    await setAdminSessionToken(token);
    redirect("/");
}

export async function updateConfiguration(formData: FormData) {
    await submitActionRequest(buildUpdateConfigurationRequest(formData), adminFetch);
    revalidatePath("/configuration");
}

export async function updateDiscoveryGuild(formData: FormData) {
    await submitActionRequest(buildDiscoveryGuildUpdateRequest(formData), adminFetch);
    revalidatePath("/discovery");
}

export async function startUserDeletion(formData: FormData) {
    await submitActionRequest(buildUserDeletionRequest(formData, randomUUID), adminFetch);
    revalidatePath("/users");
    revalidatePath("/jobs");
}

export async function deleteChannel(formData: FormData) {
    await submitActionRequest(buildChannelDeletionRequest(formData), adminFetch);
    revalidatePath("/channels");
}

export async function forceJoinGuild(formData: FormData) {
    const request = buildForceJoinGuildRequest(formData);
    await submitActionRequest(request, adminFetch);
    const guildId = request.path.split("/")[2];
    revalidatePath(`/guilds/${guildId}`);
}

export async function startCdnAttachmentFsck(formData: FormData) {
    await submitActionRequest(buildCdnAttachmentFsckRequest(formData, randomUUID), adminFetch);
    revalidatePath("/media");
    revalidatePath("/jobs");
}

export async function startCdnAttachmentMigration(formData: FormData) {
    await submitActionRequest(buildCdnAttachmentMigrationRequest(formData, randomUUID), adminFetch);
    revalidatePath("/media");
    revalidatePath("/jobs");
}

export async function cancelJob(formData: FormData) {
    await submitActionRequest(buildJobCancellationRequest(formData), adminFetch);
    revalidatePath("/jobs");
}
