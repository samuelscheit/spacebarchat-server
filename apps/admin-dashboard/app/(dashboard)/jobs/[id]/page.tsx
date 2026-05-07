import { cancelJob } from "../../../actions";
import { ActionResultBanner, CodeBlock, ErrorBanner, KeyValueList, PageHeader, Panel, ReturnToField, StatusPill } from "../../../components";
import { queryString, safeAdminFetch } from "../../../lib/admin-api";
import type { AdminAuditRecord, AdminJob, PageResult } from "../../../lib/types";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ actionSuccess?: string; actionError?: string }>;
}) {
    const { id } = await params;
    const actionParams = await searchParams;
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
                            <ReturnToField value={`/jobs/${id}`} />
                            <input type="hidden" name="jobId" value={id} />
                            <button type="submit" className="secondary">
                                Cancel
                            </button>
                        </form>
                    ) : null
                }
            />
            <ErrorBanner message={job.error ?? activity.error} />
            <ActionResultBanner success={actionParams.actionSuccess} error={actionParams.actionError} />
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
