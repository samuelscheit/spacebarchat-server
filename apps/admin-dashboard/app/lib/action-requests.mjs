function stringValue(formData, key) {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
}

function idempotencyKey(formData, createId) {
    return stringValue(formData, "idempotencyKey") || createId();
}

function jsonRequest(path, method, body, headers = {}) {
    return {
        path,
        init: {
            method,
            body: JSON.stringify(body),
            headers,
        },
    };
}

export function buildUpdateConfigurationRequest(formData) {
    return jsonRequest("/configuration", "PUT", {
        values: JSON.parse(stringValue(formData, "configuration")),
        reason: stringValue(formData, "reason"),
        confirmation: stringValue(formData, "confirmation"),
    });
}

export function buildDiscoveryGuildUpdateRequest(formData) {
    const guildId = stringValue(formData, "guildId");

    return jsonRequest(`/discovery/guilds/${guildId}?include_excluded=true`, "PATCH", {
        discoveryWeight: Number(stringValue(formData, "discoveryWeight")),
        discoveryExcluded: formData.get("discoveryExcluded") === "on",
    });
}

export function buildUserDeletionRequest(formData, createId) {
    const userId = stringValue(formData, "userId");

    return jsonRequest(
        `/users/${userId}/delete`,
        "POST",
        {
            deleteMessages: formData.get("deleteMessages") === "on",
            reason: stringValue(formData, "reason"),
            confirmation: stringValue(formData, "confirmation"),
        },
        {
            "idempotency-key": idempotencyKey(formData, createId),
        },
    );
}

export function buildChannelDeletionRequest(formData) {
    const channelId = stringValue(formData, "channelId");

    return jsonRequest(`/channels/${channelId}`, "DELETE", {
        reason: stringValue(formData, "reason"),
        confirmation: stringValue(formData, "confirmation"),
    });
}

export function buildForceJoinGuildRequest(formData) {
    const guildId = stringValue(formData, "guildId");
    const userId = stringValue(formData, "userId");

    return jsonRequest(`/guilds/${guildId}/force-join`, "POST", {
        userId: userId || undefined,
        makeOwner: formData.get("makeOwner") === "on",
        makeAdmin: formData.get("makeAdmin") === "on",
    });
}

export function buildCdnAttachmentFsckRequest(formData, createId) {
    return jsonRequest(
        "/media/attachments/fsck",
        "POST",
        {
            dryRun: true,
            missingLimit: Number(stringValue(formData, "missingLimit") || 50),
            reason: stringValue(formData, "reason") || undefined,
        },
        {
            "idempotency-key": idempotencyKey(formData, createId),
        },
    );
}

export function buildCdnAttachmentMigrationRequest(formData, createId) {
    return jsonRequest(
        "/media/attachments/migrate",
        "POST",
        {
            dryRun: formData.get("dryRun") === "on",
            force: formData.get("force") === "on",
            missingLimit: Number(stringValue(formData, "missingLimit") || 50),
            reason: stringValue(formData, "reason"),
            confirmation: stringValue(formData, "confirmation"),
        },
        {
            "idempotency-key": idempotencyKey(formData, createId),
        },
    );
}

export function buildJobCancellationRequest(formData) {
    return {
        path: `/jobs/${stringValue(formData, "jobId")}/cancel`,
        init: { method: "POST" },
    };
}

export async function submitActionRequest(request, adminFetch) {
    return adminFetch(request.path, request.init);
}
