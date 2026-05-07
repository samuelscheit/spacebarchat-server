import { deleteChannel } from "../../actions";
import { ActionResultBanner, DestructiveActionFields, PageHeader, Panel, ReturnToField } from "../../components";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ actionSuccess?: string; actionError?: string }> }) {
    const params = await searchParams;

    return (
        <>
            <PageHeader title="Channels" description="Run targeted channel deletion through the admin API event boundary." />
            <ActionResultBanner success={params.actionSuccess} error={params.actionError} />
            <Panel title="Delete Channel">
                <form action={deleteChannel} className="panel-body grid">
                    <ReturnToField value="/channels" />
                    <input name="channelId" placeholder="Channel ID" />
                    <DestructiveActionFields confirmation="the channel ID" reasonPlaceholder="Deletion reason" />
                    <div className="row-actions">
                        <button className="danger" type="submit">
                            Delete Channel
                        </button>
                    </div>
                </form>
            </Panel>
        </>
    );
}
