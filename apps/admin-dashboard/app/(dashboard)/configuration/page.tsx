import { reloadConfiguration, updateConfiguration } from "../../actions";
import { ConfigurationEditor } from "../../configuration-editor";
import { ActionResultBanner, CodeBlock, DatabaseMode, ErrorBanner, PageHeader, Panel, ReturnToField } from "../../components";
import { safeAdminFetch } from "../../lib/admin-api";
import type { AdminConfiguration } from "../../lib/types";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage({ searchParams }: { searchParams: Promise<{ actionSuccess?: string; actionError?: string }> }) {
    const params = await searchParams;
    const configuration = await safeAdminFetch<AdminConfiguration>("/configuration");
    const serialized = JSON.stringify(configuration.data?.values ?? {}, null, 2);

    return (
        <>
            <PageHeader
                title="Configuration"
                description="Edit the active server configuration through the same persistence mode used by the API process."
                action={configuration.data ? <DatabaseMode source={configuration.data.source} readonly={configuration.data.readonly} /> : null}
            />
            <ErrorBanner message={configuration.error} />
            <ActionResultBanner success={params.actionSuccess} error={params.actionError} />
            <div className="grid">
                <ConfigurationEditor
                    action={updateConfiguration}
                    initialText={serialized}
                    initialValue={configuration.data?.values ?? {}}
                    readonly={Boolean(configuration.data?.readonly)}
                    returnTo="/configuration"
                />
                <Panel title="Runtime">
                    <div className="panel-body grid">
                        <form action={reloadConfiguration}>
                            <ReturnToField value="/configuration" />
                            <button type="submit" className="secondary">
                                Reload Configuration
                            </button>
                        </form>
                        <CodeBlock
                            value={{
                                source: configuration.data?.source ?? null,
                                path: configuration.data?.path ?? null,
                                readonly: configuration.data?.readonly ?? null,
                            }}
                        />
                    </div>
                </Panel>
            </div>
        </>
    );
}
