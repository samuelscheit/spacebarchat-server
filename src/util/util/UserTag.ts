import { FieldErrors } from "./FieldError";

export const USERS_USERNAME_DISCRIMINATOR_INDEX = "users_username_discriminator_idx";

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

export function chooseAvailableDiscriminator(takenDiscriminators: Iterable<string>, start: number) {
    const taken = new Set(takenDiscriminators);
    if (taken.size >= 9999) return undefined;

    for (let offset = 0; offset < 9999; offset++) {
        const discriminator = (((start - 1 + offset) % 9999) + 1).toString().padStart(4, "0");
        if (!taken.has(discriminator)) return discriminator;
    }

    return undefined;
}
