import { FeatureDefinition } from "../types.js";
import { buildFixtureManifestTemplate, describeFixtureTemplate, FixtureManifest } from "./manifest.js";

export type FixtureSeedSetup = "manual" | "official_api" | "browser_session" | "local_file";

export interface FixtureSeedPlanResource {
    fixture_path: string;
    kind: string;
    placeholder: string;
    setup: FixtureSeedSetup;
    required_by: string[];
    disposable: boolean;
    depends_on?: string[];
    notes: string[];
}

export interface FixtureSeedPlanStep {
    id: string;
    title: string;
    setup: FixtureSeedSetup;
    fixture_paths: string[];
    depends_on?: string[];
    official_api?: {
        method: string;
        route: string;
        auth: "bot_or_application";
        body_shape: Record<string, unknown>;
    };
    notes: string[];
}

export interface FixtureSeedPlan {
    features: string[];
    required_fixtures: string[];
    required_disposable_fixtures: string[];
    template: FixtureManifest;
    resources: FixtureSeedPlanResource[];
    steps: FixtureSeedPlanStep[];
    boundaries: string[];
}

const runnerAuthoredMessageFixtures = new Set(["messages.delete_target", "messages.edit_target"]);

export function buildFixtureSeedPlan(features: readonly FeatureDefinition[]): FixtureSeedPlan {
    const sortedFeatures = [...features].sort((a, b) => a.id.localeCompare(b.id));
    const requiredFixtures = Array.from(new Set(sortedFeatures.flatMap((feature) => feature.requiredFixtures ?? []))).sort();
    const requiredDisposableFixtures = Array.from(new Set(sortedFeatures.flatMap((feature) => feature.safety?.requiredDisposableFixtures ?? []))).sort();
    const requiredBy = requiredByFeature(sortedFeatures, requiredFixtures);
    const disposable = new Set(requiredDisposableFixtures);
    const resources = requiredFixtures.map((fixturePath) => fixtureResource(fixturePath, requiredBy.get(fixturePath) ?? [], disposable.has(fixturePath)));

    return {
        features: sortedFeatures.map((feature) => feature.id),
        required_fixtures: requiredFixtures,
        required_disposable_fixtures: requiredDisposableFixtures,
        template: buildFixtureManifestTemplate(requiredFixtures, requiredDisposableFixtures),
        resources,
        steps: resources.map(seedStepForResource),
        boundaries: [
            "Use dedicated Discord test accounts, private test guilds, and normal browser login sessions only.",
            "Keep bot tokens, browser storage state, cookies, raw IDs, and private content outside generated artifacts.",
            "Use official Discord APIs only for setup resources that can safely be created by the bot/application account.",
            "Seed runner-owned message fixtures through the dedicated runner browser session because bot-authored messages cannot prove user edit/delete behavior.",
        ],
    };
}

function requiredByFeature(features: readonly FeatureDefinition[], requiredFixtures: readonly string[]): Map<string, string[]> {
    const result = new Map(requiredFixtures.map((fixturePath) => [fixturePath, [] as string[]]));
    for (const feature of features) {
        for (const fixturePath of feature.requiredFixtures ?? []) {
            result.get(fixturePath)?.push(feature.id);
        }
    }
    for (const featureIds of result.values()) {
        featureIds.sort();
    }
    return result;
}

function fixtureResource(fixturePath: string, requiredBy: string[], disposable: boolean): FixtureSeedPlanResource {
    return {
        fixture_path: fixturePath,
        kind: kindForFixturePath(fixturePath),
        placeholder: describeFixtureTemplate([fixturePath])[0]?.placeholder ?? "{fixture_value}",
        setup: setupForFixturePath(fixturePath),
        required_by: requiredBy,
        disposable,
        depends_on: dependsOnForFixturePath(fixturePath),
        notes: notesForFixturePath(fixturePath, disposable),
    };
}

function seedStepForResource(resource: FixtureSeedPlanResource): FixtureSeedPlanStep {
    return {
        id: `seed-${resource.fixture_path.replace(/[^a-zA-Z0-9]+/g, "-")}`,
        title: `Prepare ${resource.fixture_path}`,
        setup: resource.setup,
        fixture_paths: [resource.fixture_path],
        depends_on: resource.depends_on,
        official_api: officialApiForResource(resource),
        notes: resource.notes,
    };
}

function kindForFixturePath(fixturePath: string): string {
    const [root, name] = fixturePath.split(".");
    switch (root) {
        case "guild":
        case "guilds":
            return "guild";
        case "channels":
            if (name === "voice") {
                return "voice_channel";
            }
            if (name === "dm") {
                return "dm_channel";
            }
            return "text_channel";
        case "roles":
            return "role";
        case "users":
            return "user";
        case "messages":
            return "message";
        case "emojis":
            return "emoji";
        case "stickers":
            return "sticker";
        case "applications":
            return "application";
        case "files":
            return "local_file";
        default:
            return "fixture_value";
    }
}

function setupForFixturePath(fixturePath: string): FixtureSeedSetup {
    const [root, name] = fixturePath.split(".");
    if (root === "files") {
        return "local_file";
    }
    if (root === "messages") {
        return runnerAuthoredMessageFixtures.has(fixturePath) ? "browser_session" : "official_api";
    }
    if (root === "channels" && name === "dm") {
        return "browser_session";
    }
    if (root === "channels" || root === "roles" || root === "emojis" || root === "stickers") {
        return "official_api";
    }
    if (root === "guild" || root === "guilds" || root === "users" || root === "applications") {
        return "manual";
    }
    return "manual";
}

function dependsOnForFixturePath(fixturePath: string): string[] | undefined {
    const [root, name] = fixturePath.split(".");
    if (root === "channels" && name === "dm") {
        return ["users.dm_peer"];
    }
    if (root === "channels" || root === "roles" || root === "emojis" || root === "stickers") {
        return ["guild"];
    }
    if (root === "messages") {
        return ["channels.general"];
    }
    return undefined;
}

function notesForFixturePath(fixturePath: string, disposable: boolean): string[] {
    const [root, name] = fixturePath.split(".");
    const notes: string[] = [];
    if (root === "guild" || root === "guilds") {
        notes.push("Create a private throwaway guild and invite only the runner account, DM peer account when needed, and bot/application used for seeding.");
    }
    if (root === "channels" && name === "dm") {
        notes.push("Open or prepare the direct-message channel with the dedicated DM peer from the runner browser session.");
    } else if (root === "channels") {
        notes.push(name === "voice" ? "Create a voice channel in the private test guild." : "Create a text channel in the private test guild.");
    }
    if (root === "roles") {
        notes.push("Create a role whose permissions can be safely changed during destructive scenario runs.");
    }
    if (root === "users") {
        notes.push("Use a dedicated test account only; do not use production users or private conversations.");
    }
    if (root === "messages" && runnerAuthoredMessageFixtures.has(fixturePath)) {
        notes.push("Seed this message as the runner account in the browser so edit/delete UI behavior exercises user-owned content.");
    } else if (root === "messages") {
        notes.push("Seed a throwaway message in channels.general; a bot/application-created message is acceptable when the scenario does not require runner ownership.");
    }
    if (root === "files") {
        notes.push("Use a small non-private throwaway file outside the repository and artifact directories.");
    }
    if (disposable) {
        notes.push("List this fixture path under disposable in fixtures.local.json before running destructive scenarios.");
    }
    return notes;
}

function officialApiForResource(resource: FixtureSeedPlanResource): FixtureSeedPlanStep["official_api"] {
    if (resource.setup !== "official_api") {
        return undefined;
    }

    switch (resource.kind) {
        case "text_channel":
            return {
                method: "POST",
                route: "/guilds/{guild_id}/channels",
                auth: "bot_or_application",
                body_shape: { name: "{fixture_label}", type: "text" },
            };
        case "voice_channel":
            return {
                method: "POST",
                route: "/guilds/{guild_id}/channels",
                auth: "bot_or_application",
                body_shape: { name: "{fixture_label}", type: "voice" },
            };
        case "role":
            return {
                method: "POST",
                route: "/guilds/{guild_id}/roles",
                auth: "bot_or_application",
                body_shape: { name: "{fixture_label}", permissions: "{minimal_permissions}" },
            };
        case "message":
            return {
                method: "POST",
                route: "/channels/{channel_id}/messages",
                auth: "bot_or_application",
                body_shape: { content: "{redacted_seed_label}" },
            };
        case "emoji":
            return {
                method: "POST",
                route: "/guilds/{guild_id}/emojis",
                auth: "bot_or_application",
                body_shape: { name: "{fixture_label}", image: "{redacted_image_data}" },
            };
        case "sticker":
            return {
                method: "POST",
                route: "/guilds/{guild_id}/stickers",
                auth: "bot_or_application",
                body_shape: { name: "{fixture_label}", file: "{local_file_path}" },
            };
        default:
            return undefined;
    }
}
