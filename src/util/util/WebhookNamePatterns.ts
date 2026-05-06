import { HTTPError } from "lambert-server";

export type CompiledWebhookNameRegexPattern = {
    pattern: string;
    regex: RegExp;
};

let cachedPatternsKey: string | undefined;
let cachedCompiledPatterns: CompiledWebhookNameRegexPattern[] | undefined;

export function compileWebhookNameRegexPatterns(blockedNameRegexPatterns: string[]) {
    const patterns = blockedNameRegexPatterns.filter(Boolean);
    const patternsKey = JSON.stringify(patterns);
    if (cachedPatternsKey === patternsKey && cachedCompiledPatterns) return cachedCompiledPatterns;

    const compiledPatterns = patterns.map((pattern) => {
        try {
            return { pattern, regex: new RegExp(pattern, "i") };
        } catch {
            throw new HTTPError(`Invalid webhook name blacklist regex "${pattern}"`, 500);
        }
    });

    cachedPatternsKey = patternsKey;
    cachedCompiledPatterns = compiledPatterns;

    return compiledPatterns;
}

export function findBlockedWebhookNamePattern(name: string, blockedNameRegexPatterns: string[]) {
    for (const { pattern, regex } of compileWebhookNameRegexPatterns(blockedNameRegexPatterns)) {
        if (regex.test(name)) return pattern;
    }

    return undefined;
}
