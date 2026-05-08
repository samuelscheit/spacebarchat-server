export interface FixtureManifest {
    guild?: string;
    guilds?: Record<string, string>;
    channels?: Record<string, string>;
    roles?: Record<string, string>;
    users?: Record<string, string>;
    messages?: Record<string, string>;
    emojis?: Record<string, string>;
    stickers?: Record<string, string>;
    applications?: Record<string, string>;
    files?: Record<string, string>;
    disposable?: string[];
    [key: string]: unknown;
}

export interface FixturePlaceholder {
    id: string;
    placeholder: string;
    kind: string;
    name: string;
}

export function flattenFixtureIds(manifest?: FixtureManifest): Map<string, FixturePlaceholder> {
    const ids = new Map<string, FixturePlaceholder>();
    if (!manifest) {
        return ids;
    }

    if (typeof manifest.guild === "string") {
        ids.set(manifest.guild, {
            id: manifest.guild,
            placeholder: "{guild_id}",
            kind: "guild",
            name: "guild",
        });
    }

    addNamedIds(ids, manifest.guilds, "guild", "guild_id");
    addNamedIds(ids, manifest.channels, "channel", "channel_id");
    addNamedIds(ids, manifest.roles, "role", "role_id");
    addNamedIds(ids, manifest.users, "user", "user_id");
    addNamedIds(ids, manifest.messages, "message", "message_id");
    addNamedIds(ids, manifest.emojis, "emoji", "emoji_id");
    addNamedIds(ids, manifest.stickers, "sticker", "sticker_id");
    addNamedIds(ids, manifest.applications, "application", "application_id");

    return ids;
}

function addNamedIds(target: Map<string, FixturePlaceholder>, source: Record<string, string> | undefined, kind: string, placeholderName: string): void {
    if (!source) {
        return;
    }

    for (const [name, id] of Object.entries(source)) {
        target.set(id, {
            id,
            placeholder: `{${placeholderName}}`,
            kind,
            name,
        });
    }
}

export function isFixtureSnowflake(id: string, manifest?: FixtureManifest): boolean {
    return flattenFixtureIds(manifest).has(id);
}

export interface FixtureValidationResult {
    ok: boolean;
    missing: string[];
}

export interface DisposableFixtureValidationResult {
    ok: boolean;
    missing: string[];
    not_disposable: string[];
    required: string[];
}

export interface FixtureTemplateEntry {
    path: string;
    placeholder: string;
}

export function validateRequiredFixtures(manifest: FixtureManifest, requiredFixtures: readonly string[] = []): FixtureValidationResult {
    const missing = requiredFixtures.filter((fixturePath) => typeof fixtureValueAtPath(manifest, fixturePath) === "undefined");
    return {
        ok: missing.length === 0,
        missing,
    };
}

export function validateDisposableFixtures(manifest: FixtureManifest, requiredDisposableFixtures: readonly string[] = []): DisposableFixtureValidationResult {
    const required = Array.from(new Set(requiredDisposableFixtures)).sort();
    const disposable = new Set(Array.isArray(manifest.disposable) ? manifest.disposable.filter((entry): entry is string => typeof entry === "string") : []);
    const missing = required.filter((fixturePath) => typeof fixtureValueAtPath(manifest, fixturePath) === "undefined");
    const notDisposable = required.filter((fixturePath) => !missing.includes(fixturePath) && !disposable.has(fixturePath));
    return {
        ok: missing.length === 0 && notDisposable.length === 0,
        missing,
        not_disposable: notDisposable,
        required,
    };
}

export function buildFixtureManifestTemplate(requiredFixtures: readonly string[], requiredDisposableFixtures: readonly string[] = []): FixtureManifest {
    const output: FixtureManifest = {};
    for (const fixturePath of Array.from(new Set(requiredFixtures)).sort()) {
        setValueAtPath(output, fixturePath, placeholderForFixturePath(fixturePath));
    }
    const disposable = Array.from(new Set(requiredDisposableFixtures)).sort();
    if (disposable.length > 0) {
        output.disposable = disposable;
    }
    return output;
}

export function describeFixtureTemplate(requiredFixtures: readonly string[]): FixtureTemplateEntry[] {
    return Array.from(new Set(requiredFixtures))
        .sort()
        .map((fixturePath) => ({
            path: fixturePath,
            placeholder: placeholderForFixturePath(fixturePath),
        }));
}

export function redactFixtureManifest(manifest: FixtureManifest): FixtureManifest {
    const output: FixtureManifest = {};
    if (typeof manifest.guild === "string") {
        output.guild = "{guild_id}";
    }
    setIfDefined(output, "guilds", redactNamedIds(manifest.guilds, "{guild_id}"));
    setIfDefined(output, "channels", redactNamedIds(manifest.channels, "{channel_id}"));
    setIfDefined(output, "roles", redactNamedIds(manifest.roles, "{role_id}"));
    setIfDefined(output, "users", redactNamedIds(manifest.users, "{user_id}"));
    setIfDefined(output, "messages", redactNamedIds(manifest.messages, "{message_id}"));
    setIfDefined(output, "emojis", redactNamedIds(manifest.emojis, "{emoji_id}"));
    setIfDefined(output, "stickers", redactNamedIds(manifest.stickers, "{sticker_id}"));
    setIfDefined(output, "applications", redactNamedIds(manifest.applications, "{application_id}"));
    setIfDefined(output, "files", redactNamedIds(manifest.files, "{local_file_path}"));
    if (Array.isArray(manifest.disposable)) {
        output.disposable = manifest.disposable
            .filter((entry): entry is string => typeof entry === "string")
            .map(redactDisposablePath)
            .sort();
    }

    for (const [key, value] of Object.entries(manifest)) {
        if (key in output) {
            continue;
        }
        output[key] = redactUnknownValue(value);
    }

    return output;
}

export function fixtureValueAtPath(value: unknown, fixturePath: string): unknown {
    return fixturePath.split(".").reduce<unknown>((current, part) => {
        if (typeof current !== "object" || current === null || Array.isArray(current)) {
            return undefined;
        }

        return (current as Record<string, unknown>)[part];
    }, value);
}

export function fixtureStringAtPath(value: unknown, fixturePath: string): string | undefined {
    const resolved = fixtureValueAtPath(value, fixturePath);
    return typeof resolved === "string" ? resolved : undefined;
}

function setValueAtPath(target: FixtureManifest, fixturePath: string, value: string): void {
    const parts = fixturePath.split(".");
    let current: Record<string, unknown> = target;
    for (const part of parts.slice(0, -1)) {
        const child = current[part];
        if (typeof child !== "object" || child === null || Array.isArray(child)) {
            current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
    }
    current[parts.at(-1) ?? fixturePath] = value;
}

function placeholderForFixturePath(fixturePath: string): string {
    const [root] = fixturePath.split(".");
    switch (root) {
        case "guild":
        case "guilds":
            return "{guild_id}";
        case "channels":
            return "{channel_id}";
        case "roles":
            return "{role_id}";
        case "users":
            return "{user_id}";
        case "messages":
            return "{message_id}";
        case "emojis":
            return "{emoji_id}";
        case "stickers":
            return "{sticker_id}";
        case "applications":
            return "{application_id}";
        case "disposable":
            return "{fixture_path}";
        case "files":
            return "{local_file_path}";
        default:
            return "{fixture_value}";
    }
}

function redactDisposablePath(value: string): string {
    return /^(?!\d+$)[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(value) ? value : "{redacted}";
}

function redactNamedIds(source: Record<string, string> | undefined, placeholder: string): Record<string, string> | undefined {
    if (!source) {
        return undefined;
    }

    return Object.fromEntries(
        Object.keys(source)
            .sort()
            .map((key) => [key, placeholder]),
    );
}

function setIfDefined(target: FixtureManifest, key: string, value: unknown): void {
    if (typeof value !== "undefined") {
        target[key] = value;
    }
}

function redactUnknownValue(value: unknown): unknown {
    if (typeof value === "string") {
        return "{redacted}";
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactUnknownValue(item));
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, redactUnknownValue(child)]),
    );
}
