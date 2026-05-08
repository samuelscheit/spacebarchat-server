import { SourceRefs } from "../../types.js";

type FetchLike = typeof fetch;

export interface GithubSourceRef {
    key: string;
    repository: string;
    ref?: string;
}

export interface ResolveGithubSourceRefsOptions {
    refs?: GithubSourceRef[];
    fetchImpl?: FetchLike;
}

export const defaultGithubSourceRefs: readonly GithubSourceRef[] = [
    {
        key: "xhyrom_routes_commit",
        repository: "xHyroM/discord-datamining",
        ref: "HEAD",
    },
    {
        key: "userdoccers_commit",
        repository: "discord-userdoccers/discord-userdoccers",
        ref: "HEAD",
    },
];

export async function resolveGithubSourceRefs(options: ResolveGithubSourceRefsOptions = {}): Promise<SourceRefs> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const refs = options.refs ?? defaultGithubSourceRefs;
    const output: SourceRefs = {};

    for (const sourceRef of refs) {
        output[sourceRef.key] = await resolveGithubCommit(sourceRef, fetchImpl);
    }

    return output;
}

async function resolveGithubCommit(sourceRef: GithubSourceRef, fetchImpl: FetchLike): Promise<string> {
    const response = await fetchImpl(githubCommitUrl(sourceRef.repository, sourceRef.ref ?? "HEAD"), {
        headers: {
            accept: "application/vnd.github+json",
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to resolve ${sourceRef.repository}@${sourceRef.ref ?? "HEAD"}: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || typeof payload.sha !== "string" || !/^[a-f0-9]{40}$/i.test(payload.sha)) {
        throw new Error(`GitHub commit response for ${sourceRef.repository} did not include a commit SHA`);
    }

    return payload.sha;
}

function githubCommitUrl(repository: string, ref: string): string {
    return `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
