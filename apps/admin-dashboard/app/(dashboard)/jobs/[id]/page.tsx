import { cancelJob } from "../../../actions";
import { CodeBlock, ErrorBanner, KeyValueList, PageHeader, Panel, StatusPill } from "../../../components";
import { queryString, safeAdminFetch } from "../../../lib/admin-api";
import type { AdminAuditRecord, AdminJob, PageResult } from "../../../lib/types";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [job, activity] = await Promise.all([
        safeAdminFetch<AdminJob>(`/jobs/${id}`),
        safeAdminFetch<PageResult<AdminAuditRecord>>(`/activity${queryString({ q: id, limit: 20 })}`),
    ]);

    const active = job.data?.status === "queued" || job.data?.status === "running";

    return (
        <>
            <PageHeader
                title={job.data ? job.data.type : "Job"}
                description={id}
                action={
                    active ? (
                        <form action={cancelJob}>
                            <input type="hidden" name="jobId" value={id} />
                            <button type="submit" className="secondary">
                                Cancel
                            </button>
                        </form>
                    ) : null
                }
            />
            <ErrorBanner message={job.error ?? activity.error} />
            {job.data ? (
                <div className="grid two">
                    <Panel title="Job State">
                        <KeyValueList
                            items={[
                                ["Status", <StatusPill value={job.data.status} />],
                                ["Actor", <span className="mono">{job.data.createdBy}</span>],
                                ["Progress", `${job.data.progress.current}${job.data.progress.total === null ? "" : ` / ${job.data.progress.total}`}`],
                                ["Progress Label", job.data.progress.label ?? "—"],
                                ["Idempotency Key", <span className="mono">{job.data.idempotencyKey ?? "—"}</span>],
                                ["Cancel Requested", <StatusPill value={job.data.cancelRequested} />],
                                ["Created", new Date(job.data.createdAt).toLocaleString()],
                                ["Updated", new Date(job.data.updatedAt).toLocaleString()],
                                ["Started", job.data.startedAt ? new Date(job.data.startedAt).toLocaleString() : "—"],
                                ["Completed", job.data.completedAt ? new Date(job.data.completedAt).toLocaleString() : "—"],
                            ]}
                        />
                    </Panel>
                    <Panel title="Errors">
                        <CodeBlock value={job.data.errors} />
                    </Panel>
                    <Panel title="Input">
                        <CodeBlock value={job.data.input} />
                    </Panel>
                    <Panel title="Result">
                        <CodeBlock value={job.data.result} />
                    </Panel>
                </div>
            ) : null}
            <Panel title={`Related Activity${activity.data ? ` · ${activity.data.pagination.total}` : ""}`}>
                <CodeBlock value={activity.data?.items ?? []} />
            </Panel>
        </>
    );
}
