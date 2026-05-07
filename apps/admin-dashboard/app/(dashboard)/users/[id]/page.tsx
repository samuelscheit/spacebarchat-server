import { startUserDeletion } from "../../../actions";
import { ActionResultBanner, CodeBlock, DestructiveActionFields, ErrorBanner, KeyValueList, PageHeader, Panel, ReturnToField, StatusPill } from "../../../components";
import { safeAdminFetch } from "../../../lib/admin-api";
import type { AdminUser } from "../../../lib/types";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ actionSuccess?: string; actionError?: string }> }) {
    const { id } = await params;
    const actionParams = await searchParams;
    const user = await safeAdminFetch<AdminUser>(`/users/${id}`);

    return (
        <>
            <PageHeader
                title={user.data ? user.data.username : "User"}
                description={id}
                action={
                    <form action={startUserDeletion} className="inline-form">
                        <ReturnToField value={`/users/${id}`} />
                        <input type="hidden" name="userId" value={id} />
                        <label className="status-pill status-neutral">
                            <input type="checkbox" name="deleteMessages" defaultChecked />
                            messages
                        </label>
                        <DestructiveActionFields confirmation={id} reasonPlaceholder="Deletion reason" idempotency />
                        <button className="danger" type="submit">
                            Delete User
                        </button>
                    </form>
                }
            />
            <ErrorBanner message={user.error} />
            <ActionResultBanner success={actionParams.actionSuccess} error={actionParams.actionError} />
            {user.data ? (
                <div className="grid two">
                    <Panel title="Profile">
                        <KeyValueList
                            items={[
                                ["ID", <span className="mono">{user.data.id}</span>],
                                ["Email", user.data.email ?? "—"],
                                ["Phone", user.data.phone ?? "—"],
                                ["Verified", <StatusPill value={user.data.verified} />],
                                ["Disabled", <StatusPill value={user.data.disabled} />],
                                ["Deleted", <StatusPill value={user.data.deleted} />],
                                ["MFA", <StatusPill value={user.data.mfaEnabled} />],
                                ["WebAuthn", <StatusPill value={user.data.webauthnEnabled} />],
                            ]}
                        />
                    </Panel>
                    <Panel title="Counts">
                        <CodeBlock value={user.data.counts} />
                    </Panel>
                </div>
            ) : null}
        </>
    );
}
