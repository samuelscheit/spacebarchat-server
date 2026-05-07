import { randomUUID } from "node:crypto";
import { startCdnAttachmentFsck, startCdnAttachmentMigration } from "../../actions";
import { ActionResultBanner, DestructiveActionFields, ErrorBanner, PageHeader, PaginationControls, Panel, ReturnToField, SearchForm, StatusPill } from "../../components";
import { parseOffsetParam, queryString, safeAdminFetch } from "../../lib/admin-api";
import type { AdminAttachment, AdminSticker, PageResult } from "../../lib/types";

export const dynamic = "force-dynamic";

export default async function MediaPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; userId?: string; stickersOffset?: string; attachmentsOffset?: string; actionSuccess?: string; actionError?: string }>;
}) {
    const params = await searchParams;
    const stickersOffset = parseOffsetParam(params.stickersOffset);
    const attachmentsOffset = parseOffsetParam(params.attachmentsOffset);
    const returnTo = `/media${queryString({ q: params.q, userId: params.userId, stickersOffset, attachmentsOffset })}`;
    const [stickers, attachments] = await Promise.all([
        safeAdminFetch<PageResult<AdminSticker>>(`/media/stickers${queryString({ q: params.q, limit: 50, offset: stickersOffset })}`),
        params.userId
            ? safeAdminFetch<PageResult<AdminAttachment>>(`/media/users/${params.userId}/attachments${queryString({ q: params.q, limit: 50, offset: attachmentsOffset })}`)
            : Promise.resolve({ data: null, error: null }),
    ]);

    return (
        <>
            <PageHeader title="Media" description="Review stickers and media ownership without loading attachment graphs." />
            <ErrorBanner message={stickers.error ?? attachments.error} />
            <ActionResultBanner success={params.actionSuccess} error={params.actionError} />
            <SearchForm defaultValue={params.q} placeholder="Search sticker id, name, guild, or user" />
            <div className="grid">
                <Panel title="Attachment Jobs">
                    <div className="panel-body grid two">
                        <form action={startCdnAttachmentFsck} className="stack">
                            <ReturnToField value={returnTo} />
                            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                            <label className="field-label">
                                Missing limit
                                <input name="missingLimit" type="number" min="1" max="10000" defaultValue="50" />
                            </label>
                            <input name="reason" placeholder="Optional fsck reason" />
                            <button type="submit" className="secondary">
                                Start Fsck
                            </button>
                        </form>
                        <form action={startCdnAttachmentMigration} className="stack">
                            <ReturnToField value={returnTo} />
                            <label className="field-label">
                                Missing limit
                                <input name="missingLimit" type="number" min="1" max="10000" defaultValue="50" />
                            </label>
                            <label className="check-row">
                                <input type="checkbox" name="dryRun" defaultChecked />
                                Dry run
                            </label>
                            <label className="check-row">
                                <input type="checkbox" name="force" />
                                Force
                            </label>
                            <DestructiveActionFields confirmation="MIGRATE ATTACHMENTS" reasonPlaceholder="Migration reason" idempotency />
                            <button type="submit">Start Migration</button>
                        </form>
                    </div>
                </Panel>
                <Panel title={`Stickers${stickers.data ? ` · ${stickers.data.pagination.total}` : ""}`}>
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Guild</th>
                                <th>User</th>
                                <th>Type</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(stickers.data?.items ?? []).map((sticker) => (
                                <tr key={sticker.id}>
                                    <td>
                                        <strong>{sticker.name}</strong>
                                        <div className="mono">{sticker.id}</div>
                                    </td>
                                    <td className="mono">{sticker.guildId ?? "—"}</td>
                                    <td className="mono">{sticker.userId ?? "—"}</td>
                                    <td>
                                        {sticker.type}/{sticker.formatType}
                                    </td>
                                    <td>
                                        <StatusPill value={sticker.available ?? "unknown"} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {stickers.data ? (
                        <PaginationControls pagination={stickers.data.pagination} params={{ q: params.q, userId: params.userId, attachmentsOffset }} offsetParam="stickersOffset" />
                    ) : null}
                </Panel>
                <Panel title={`User Attachments${attachments.data ? ` · ${attachments.data.pagination.total}` : ""}`}>
                    <form className="panel-body search-form">
                        <span />
                        {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
                        <input name="userId" defaultValue={params.userId} placeholder="User ID" />
                        <button type="submit">Load</button>
                    </form>
                    {attachments.data ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Size</th>
                                    <th>Channel</th>
                                    <th className="hide-sm">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attachments.data.items.map((attachment) => (
                                    <tr key={attachment.id}>
                                        <td>
                                            <strong>{attachment.filename}</strong>
                                            <div className="mono">{attachment.id}</div>
                                        </td>
                                        <td>{attachment.size.toLocaleString()}</td>
                                        <td className="mono">{attachment.channelId ?? "—"}</td>
                                        <td className="hide-sm">{attachment.timestamp ? new Date(attachment.timestamp).toLocaleString() : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : null}
                    {attachments.data ? (
                        <PaginationControls
                            pagination={attachments.data.pagination}
                            params={{ q: params.q, userId: params.userId, stickersOffset }}
                            offsetParam="attachmentsOffset"
                        />
                    ) : null}
                </Panel>
            </div>
        </>
    );
}
