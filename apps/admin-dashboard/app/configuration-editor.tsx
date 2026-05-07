"use client";

import { useMemo, useState } from "react";

type ConfigurationAction = (formData: FormData) => void | Promise<void>;

interface DiffEntry {
    path: string;
    type: "added" | "changed" | "removed";
    before?: string;
    after?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown) {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
}

function compactValue(value: string) {
    return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

function flattenJson(value: unknown, path = "$", output = new Map<string, string>()) {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            output.set(path, "[]");
            return output;
        }

        value.forEach((item, index) => flattenJson(item, `${path}[${index}]`, output));
        return output;
    }

    if (isRecord(value)) {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            output.set(path, "{}");
            return output;
        }

        for (const [key, item] of entries) flattenJson(item, `${path}.${key}`, output);
        return output;
    }

    output.set(path, stableValue(value));
    return output;
}

function diffJson(before: unknown, after: unknown) {
    const previous = flattenJson(before);
    const next = flattenJson(after);
    const paths = Array.from(new Set([...previous.keys(), ...next.keys()])).sort();
    const entries: DiffEntry[] = [];

    for (const path of paths) {
        const oldValue = previous.get(path);
        const newValue = next.get(path);
        if (oldValue === newValue) continue;
        if (oldValue === undefined) {
            entries.push({ path, type: "added", after: compactValue(newValue ?? "") });
        } else if (newValue === undefined) {
            entries.push({ path, type: "removed", before: compactValue(oldValue) });
        } else {
            entries.push({ path, type: "changed", before: compactValue(oldValue), after: compactValue(newValue) });
        }
    }

    return entries;
}

export function ConfigurationEditor({
    action,
    initialText,
    initialValue,
    readonly,
    returnTo,
}: {
    action: ConfigurationAction;
    initialText: string;
    initialValue: unknown;
    readonly: boolean;
    returnTo: string;
}) {
    const [text, setText] = useState(initialText);
    const parsed = useMemo(() => {
        try {
            return { ok: true as const, value: JSON.parse(text) as unknown };
        } catch (error) {
            return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
        }
    }, [text]);
    const diff = useMemo(() => (parsed.ok ? diffJson(initialValue, parsed.value) : []), [initialValue, parsed]);

    return (
        <div className="grid two">
            <section className="panel">
                <div className="panel-header">
                    <h2>Editor</h2>
                </div>
                <form action={action} className="panel-body grid">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <textarea
                        name="configuration"
                        value={text}
                        onChange={(event) => setText((event.currentTarget as unknown as { value: string }).value)}
                        spellCheck={false}
                        aria-invalid={!parsed.ok}
                    />
                    <div className={`validation-banner ${parsed.ok ? "validation-ok" : "validation-error"}`} aria-live="polite">
                        {parsed.ok ? "Valid JSON" : parsed.error}
                    </div>
                    <div className="destructive-fields">
                        <input name="reason" placeholder="Configuration change reason" required />
                        <input name="confirmation" placeholder="Type SAVE CONFIGURATION to confirm" autoComplete="off" required />
                    </div>
                    <div className="row-actions">
                        <button type="button" className="secondary" disabled={!parsed.ok} onClick={() => parsed.ok && setText(JSON.stringify(parsed.value, null, 2))}>
                            Format JSON
                        </button>
                        <button type="submit" disabled={readonly || !parsed.ok}>
                            Save Configuration
                        </button>
                    </div>
                </form>
            </section>
            <section className="panel">
                <div className="panel-header">
                    <h2>Diff Preview</h2>
                </div>
                <div className="panel-body grid">
                    {parsed.ok ? (
                        <>
                            <pre className="code-block json-preview">{JSON.stringify(parsed.value, null, 2)}</pre>
                            {diff.length ? (
                                <ul className="diff-list">
                                    {diff.slice(0, 80).map((entry) => (
                                        <li key={`${entry.type}:${entry.path}`} className={`diff-entry diff-${entry.type}`}>
                                            <strong>{entry.type}</strong>
                                            <code>{entry.path}</code>
                                            {entry.type === "added" ? <span>{entry.after}</span> : null}
                                            {entry.type === "removed" ? <span>{entry.before}</span> : null}
                                            {entry.type === "changed" ? (
                                                <span>
                                                    {entry.before} to {entry.after}
                                                </span>
                                            ) : null}
                                        </li>
                                    ))}
                                    {diff.length > 80 ? <li className="diff-entry">Additional changes hidden: {diff.length - 80}</li> : null}
                                </ul>
                            ) : (
                                <div className="empty-inline">No changes</div>
                            )}
                        </>
                    ) : (
                        <div className="empty-inline">Fix JSON before previewing changes.</div>
                    )}
                </div>
            </section>
        </div>
    );
}
