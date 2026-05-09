import { FieldErrors } from "./FieldError";

export const USER_DISCRIMINATOR_MIN = 1;
export const USER_DISCRIMINATOR_MAX = 9999;
export const USER_DISCRIMINATOR_COUNT = USER_DISCRIMINATOR_MAX - USER_DISCRIMINATOR_MIN + 1;
export const USERS_USERNAME_DISCRIMINATOR_INDEX = "users_username_discriminator_idx";
export const USER_TAG_REGISTRATION_ATTEMPTS = 5;

type DatabaseError = {
    code?: string;
    constraint?: string;
    driverError?: {
        code?: string;
        constraint?: string;
    };
};

export function isUserTagUniqueViolation(error: unknown) {
    const databaseError = error as DatabaseError | undefined;
    const driverError = databaseError?.driverError;

    return (
        (databaseError?.code === "23505" || driverError?.code === "23505") &&
        (databaseError?.constraint === USERS_USERNAME_DISCRIMINATOR_INDEX || driverError?.constraint === USERS_USERNAME_DISCRIMINATOR_INDEX)
    );
}

export function userDiscriminatorAlreadyTakenFieldError(message = "This discriminator is already in use.") {
    return FieldErrors({
        discriminator: {
            code: "INVALID_DISCRIMINATOR",
            message,
        },
    });
}

export function formatUserDiscriminator(value: number) {
    return value.toString().padStart(4, "0");
}

function normalizeDiscriminatorStart(start: number) {
    return ((((Math.trunc(start) - USER_DISCRIMINATOR_MIN) % USER_DISCRIMINATOR_COUNT) + USER_DISCRIMINATOR_COUNT) % USER_DISCRIMINATOR_COUNT) + USER_DISCRIMINATOR_MIN;
}

function parseValidDiscriminator(discriminator: string) {
    if (!/^\d{4}$/.test(discriminator)) return undefined;

    const value = Number(discriminator);
    if (!Number.isInteger(value) || value < USER_DISCRIMINATOR_MIN || value > USER_DISCRIMINATOR_MAX) return undefined;

    return value;
}

export function chooseAvailableDiscriminator(takenDiscriminators: Iterable<string>, start: number) {
    const taken = new Set(takenDiscriminators);
    if (taken.size >= USER_DISCRIMINATOR_COUNT) return undefined;

    const normalizedStart = normalizeDiscriminatorStart(start);
    for (let offset = 0; offset < USER_DISCRIMINATOR_COUNT; offset++) {
        const discriminator = formatUserDiscriminator(((normalizedStart - USER_DISCRIMINATOR_MIN + offset) % USER_DISCRIMINATOR_COUNT) + USER_DISCRIMINATOR_MIN);
        if (!taken.has(discriminator)) return discriminator;
    }

    return undefined;
}

export function chooseIncrementingDiscriminator(takenDiscriminators: Iterable<string>) {
    const taken = [...takenDiscriminators];
    const highestDiscriminator = Math.max(0, ...taken.map((discriminator) => parseValidDiscriminator(discriminator) ?? 0));

    return chooseAvailableDiscriminator(taken, highestDiscriminator + 1);
}

export async function retryOnUserTagUniqueViolation<T>(operation: (attempt: number) => Promise<T>, attempts = USER_TAG_REGISTRATION_ATTEMPTS) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await operation(attempt);
        } catch (error) {
            if (isUserTagUniqueViolation(error)) continue;
            throw error;
        }
    }

    return undefined;
}
