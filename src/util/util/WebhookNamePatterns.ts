import { HTTPError } from "lambert-server";

export function compileWebhookNameRegexPatterns(blockedNameRegexPatterns: string[]) {
    return blockedNameRegexPatterns.filter(Boolean).map((pattern) => {
        try {
            return { pattern, regex: new RegExp(pattern, "i") };
        } catch {
            throw new HTTPError(`Invalid webhook name blacklist regex "${pattern}"`, 500);
        }
    });
}

export function findBlockedWebhookNamePattern(name: string, blockedNameRegexPatterns: string[]) {
    for (const { pattern, regex } of compileWebhookNameRegexPatterns(blockedNameRegexPatterns)) {
        if (regex.test(name)) return pattern;
    }

    return undefined;
}
