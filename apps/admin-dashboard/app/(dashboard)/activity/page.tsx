import Link from "next/link";
import { Fragment } from "react";
import { CodeBlock, ErrorBanner, PageHeader, PaginationControls, Panel, SearchForm, StatusPill } from "../../components";
import { parseOffsetParam, queryString, safeAdminFetch } from "../../lib/admin-api";
import type { AdminAuditRecord, PageResult } from "../../lib/types";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; offset?: string }> }) {
    const params = await searchParams;
    const offset = parseOffsetParam(params.offset);
    const activity = await safeAdminFetch<PageResult<AdminAuditRecord>>(`/activity${queryString({ q: params.q, limit: 50, offset })}`);

    return (
        <>
            <PageHeader title="Activity" description="Admin audit activity with actor, target, status, and operation metadata." />
            <ErrorBanner message={activity.error} />
            <SearchForm defaultValue={params.q} placeholder="Search actor, operation, target, or job id" />
            <Panel title="Activity Feed">
                <table>
                    <thead>
                        <tr>
                            <th>When</th>
                            <th>Actor</th>
                            <th>Operation</th>
                            <th>Status</th>
                            <th className="hide-sm">Reason</th>
                            <th className="hide-sm">Severity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(activity.data?.items ?? []).map((record) => (
                            <Fragment key={record.id}>
                                <tr>
                                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                                    <td className="mono">{record.actorId}</td>
                                    <td>
                                        <strong>{record.action}</strong>
                                        <div className="mono">
                                            {record.targetType}:{record.targetId}
                                        </div>
                                    </td>
                                    <td>
                                        <StatusPill value={record.status} />
                                    </td>
                                    <td className="hide-sm">{record.reason ?? "—"}</td>
                                    <td className="hide-sm">{record.severity}</td>
                                </tr>
                                <tr className="activity-detail-row">
                                    <td colSpan={6}>
                                        <details>
                                            <summary>Metadata and related job</summary>
                                            <div className="activity-detail-grid">
                                                <div className="activity-related">
                                                    <span className="muted">Record</span>
                                                    <strong className="mono">{record.id}</strong>
                                                    <span className="muted">Related Job</span>
                                                    {record.jobId ? (
                                                        <Link href={`/jobs/${record.jobId}`} className="button secondary">
                                                            {record.jobId}
                                                        </Link>
                                                    ) : (
                                                        <span>None</span>
                                                    )}
                                                </div>
                                                <CodeBlock
                                                    value={{
                                                        reason: record.reason,
                                                        metadata: record.metadata,
                                                        jobId: record.jobId,
                                                    }}
                                                />
                                            </div>
                                        </details>
                                    </td>
                                </tr>
                            </Fragment>
                        ))}
                    </tbody>
                </table>
                {activity.data ? <PaginationControls pagination={activity.data.pagination} params={{ q: params.q }} /> : null}
            </Panel>
            <Panel title="Recent Activity Payloads">
                <CodeBlock value={(activity.data?.items ?? []).slice(0, 10)} />
            </Panel>
        </>
    );
}
