import { cancelJob } from "../../actions";
import { CodeBlock, ErrorBanner, PageHeader, PaginationControls, Panel, RowLink, SearchForm, StatusPill } from "../../components";
import { parseOffsetParam, queryString, safeAdminFetch } from "../../lib/admin-api";
import type { AdminJob, PageResult } from "../../lib/types";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string; offset?: string }> }) {
    const params = await searchParams;
    const offset = parseOffsetParam(params.offset);
    const jobs = await safeAdminFetch<PageResult<AdminJob>>(`/jobs${queryString({ q: params.q, limit: 50, offset })}`);

    return (
        <>
            <PageHeader title="Jobs" description="Track destructive and long-running admin work with progress, errors, and cancellation requests." />
            <ErrorBanner message={jobs.error} />
            <SearchForm defaultValue={params.q} placeholder="Search job id, type, actor, or idempotency key" />
            <Panel title={`Job Queue${jobs.data ? ` · ${jobs.data.pagination.total}` : ""}`}>
                <table>
                    <thead>
                        <tr>
                            <th>Job</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th className="hide-sm">Updated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(jobs.data?.items ?? []).map((job) => (
                            <tr key={job.id}>
                                <td>
                                    <strong>{job.type}</strong>
                                    <div className="mono">{job.id}</div>
                                </td>
                                <td>
                                    <StatusPill value={job.status} />
                                </td>
                                <td>
                                    {job.progress.label ? <div>{job.progress.label}</div> : null}
                                    <span className="mono">
                                        {job.progress.current}
                                        {job.progress.total === null ? "" : ` / ${job.progress.total}`}
                                    </span>
                                </td>
                                <td className="hide-sm">{new Date(job.updatedAt).toLocaleString()}</td>
                                <td>
                                    <div className="row-actions">
                                        {job.status === "queued" || job.status === "running" ? (
                                            <form action={cancelJob}>
                                                <input type="hidden" name="jobId" value={job.id} />
                                                <button type="submit" className="secondary">
                                                    Cancel
                                                </button>
                                            </form>
                                        ) : null}
                                        <RowLink href={`/jobs/${job.id}`} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {jobs.data ? <PaginationControls pagination={jobs.data.pagination} params={{ q: params.q }} /> : null}
            </Panel>
            <Panel title="Latest Payloads">
                <CodeBlock value={(jobs.data?.items ?? []).slice(0, 3)} />
            </Panel>
        </>
    );
}
