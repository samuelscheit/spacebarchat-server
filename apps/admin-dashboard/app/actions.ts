"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { adminFetch } from "./lib/admin-api";
import { setAdminSessionToken, validateAdminToken } from "./lib/admin-session";

function stringValue(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
}

function idempotencyKey(formData: FormData) {
    return stringValue(formData, "idempotencyKey") || randomUUID();
}

export async function reloadConfiguration() {
    await adminFetch("/configuration/reload", { method: "POST" });
    revalidatePath("/configuration");
}

export async function loginAdmin(formData: FormData) {
    const token = stringValue(formData, "token");
    const validation = await validateAdminToken(token);

    if (!validation.ok) {
        redirect(`/login?reason=${validation.reason}`);
    }

    await setAdminSessionToken(token);
    redirect("/");
}

export async function updateConfiguration(formData: FormData) {
    const raw = stringValue(formData, "configuration");
    await adminFetch("/configuration", {
        method: "PUT",
        body: JSON.stringify({
            values: JSON.parse(raw),
            reason: stringValue(formData, "reason"),
            confirmation: stringValue(formData, "confirmation"),
        }),
    });
    revalidatePath("/configuration");
}

export async function updateDiscoveryGuild(formData: FormData) {
    const guildId = stringValue(formData, "guildId");
    const discoveryWeight = Number(stringValue(formData, "discoveryWeight"));
    const discoveryExcluded = formData.get("discoveryExcluded") === "on";

    await adminFetch(`/discovery/guilds/${guildId}?include_excluded=true`, {
        method: "PATCH",
        body: JSON.stringify({
            discoveryWeight,
            discoveryExcluded,
        }),
    });
    revalidatePath("/discovery");
}

export async function startUserDeletion(formData: FormData) {
    const userId = stringValue(formData, "userId");
    const deleteMessages = formData.get("deleteMessages") === "on";

    await adminFetch(`/users/${userId}/delete`, {
        method: "POST",
        body: JSON.stringify({
            deleteMessages,
            reason: stringValue(formData, "reason"),
            confirmation: stringValue(formData, "confirmation"),
        }),
        headers: {
            "idempotency-key": idempotencyKey(formData),
        },
    });
    revalidatePath("/users");
    revalidatePath("/jobs");
}

export async function deleteChannel(formData: FormData) {
    const channelId = stringValue(formData, "channelId");
    await adminFetch(`/channels/${channelId}`, {
        method: "DELETE",
        body: JSON.stringify({
            reason: stringValue(formData, "reason"),
            confirmation: stringValue(formData, "confirmation"),
        }),
    });
    revalidatePath("/channels");
}

export async function forceJoinGuild(formData: FormData) {
    const guildId = stringValue(formData, "guildId");
    const userId = stringValue(formData, "userId");

    await adminFetch(`/guilds/${guildId}/force-join`, {
        method: "POST",
        body: JSON.stringify({
            userId: userId || undefined,
            makeOwner: formData.get("makeOwner") === "on",
            makeAdmin: formData.get("makeAdmin") === "on",
        }),
    });
    revalidatePath(`/guilds/${guildId}`);
}

export async function startCdnAttachmentFsck(formData: FormData) {
    await adminFetch("/media/attachments/fsck", {
        method: "POST",
        body: JSON.stringify({
            dryRun: true,
            missingLimit: Number(stringValue(formData, "missingLimit") || 50),
            reason: stringValue(formData, "reason") || undefined,
        }),
        headers: {
            "idempotency-key": idempotencyKey(formData),
        },
    });
    revalidatePath("/media");
    revalidatePath("/jobs");
}

export async function startCdnAttachmentMigration(formData: FormData) {
    await adminFetch("/media/attachments/migrate", {
        method: "POST",
        body: JSON.stringify({
            dryRun: formData.get("dryRun") === "on",
            force: formData.get("force") === "on",
            missingLimit: Number(stringValue(formData, "missingLimit") || 50),
            reason: stringValue(formData, "reason"),
            confirmation: stringValue(formData, "confirmation"),
        }),
        headers: {
            "idempotency-key": idempotencyKey(formData),
        },
    });
    revalidatePath("/media");
    revalidatePath("/jobs");
}

export async function cancelJob(formData: FormData) {
    const jobId = stringValue(formData, "jobId");
    await adminFetch(`/jobs/${jobId}/cancel`, { method: "POST" });
    revalidatePath("/jobs");
}
