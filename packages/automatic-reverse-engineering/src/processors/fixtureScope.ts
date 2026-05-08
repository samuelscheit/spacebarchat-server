import { FixtureManifest, flattenFixtureIds } from "../fixtures/manifest.js";

const guardedKinds = new Set(["guild", "channel", "user", "role"]);
const snowflakePattern = /^\d{17,20}$/;

export interface FixtureScopeViolation {
    kind: string;
    id: string;
    path: string;
}

export interface FixtureScopeResult {
    ok: boolean;
    violations: FixtureScopeViolation[];
}

export interface FixtureScopeOptions {
    allowedIds?: Iterable<string>;
}

export function validateFixtureUrlScope(url: string, fixtures?: FixtureManifest, options: FixtureScopeOptions = {}): FixtureScopeResult {
    const fixtureIds = flattenFixtureIds(fixtures);
    const allowedIds = new Set(options.allowedIds ?? []);
    const violations: FixtureScopeViolation[] = [];
    const path = pathFromUrl(url);
    const parts = path.split("/").filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (!snowflakePattern.test(part)) {
            continue;
        }

        const kind = kindForPreviousPart(parts[index - 1]);
        if (!kind || !guardedKinds.has(kind) || fixtureIds.has(part) || allowedIds.has(part)) {
            continue;
        }

        violations.push({
            kind,
            id: part,
            path,
        });
    }

    return {
        ok: violations.length === 0,
        violations,
    };
}

export function assertFixtureUrlScope(url: string, fixtures?: FixtureManifest, options: FixtureScopeOptions = {}): void {
    const result = validateFixtureUrlScope(url, fixtures, options);
    if (!result.ok) {
        throw new Error(`URL touches non-fixture IDs: ${result.violations.map((violation) => `${violation.kind}:${violation.id}`).join(", ")}`);
    }
}

function kindForPreviousPart(part: string | undefined): string | undefined {
    switch (part) {
        case "guilds":
            return "guild";
        case "channels":
            return "channel";
        case "users":
            return "user";
        case "roles":
            return "role";
        default:
            return undefined;
    }
}

function pathFromUrl(input: string): string {
    try {
        return new URL(input).pathname;
    } catch {
        return input;
    }
}
