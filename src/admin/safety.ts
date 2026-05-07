import { HTTPError } from "lambert-server";

export interface AdminActionSafety {
    reason: string;
    confirmation: string;
    idempotencyKey?: string | null;
}

export type AdminActionSafetyInput = Partial<AdminActionSafety>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function firstHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function stringField(input: Record<string, unknown>, key: string) {
    const value = input[key];
    return typeof value === "string" ? value.trim() : "";
}

export function parseAdminActionSafety(body: unknown, idempotencyKey?: string | null): AdminActionSafetyInput {
    const input = isRecord(body) ? body : {};

    return {
        reason: stringField(input, "reason"),
        confirmation: stringField(input, "confirmation"),
        idempotencyKey,
    };
}

export function stripAdminActionSafetyFields(body: unknown) {
    if (!isRecord(body)) return body;

    const { reason, confirmation, ...rest } = body;
    void reason;
    void confirmation;

    return rest;
}

export function unwrapAdminActionPayload(body: unknown, field = "values") {
    if (isRecord(body) && field in body) return body[field];

    return stripAdminActionSafetyFields(body);
}

export function requireAdminActionSafety(body: unknown, options: { expectedConfirmation: string; idempotencyKey?: string | null }): AdminActionSafety {
    const safety = parseAdminActionSafety(body, options.idempotencyKey);

    if (!safety.reason || safety.reason.length < 3) {
        throw new HTTPError("Admin action reason is required", 400);
    }

    if (safety.confirmation !== options.expectedConfirmation) {
        throw new HTTPError(`Confirmation must exactly match: ${options.expectedConfirmation}`, 400);
    }

    return {
        reason: safety.reason,
        confirmation: safety.confirmation,
        idempotencyKey: safety.idempotencyKey,
    };
}
