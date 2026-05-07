import Link from "next/link";
import { randomUUID } from "node:crypto";
import {
    Activity,
    BadgeAlert,
    Boxes,
    Cable,
    CheckCircle2,
    ChevronRight,
    CircleSlash,
    Cog,
    Database,
    FileClock,
    Image,
    LayoutDashboard,
    LogOut,
    Search,
    Shield,
    Sparkles,
    Users,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/users", label: "Users", icon: Users },
    { href: "/guilds", label: "Guilds", icon: Boxes },
    { href: "/discovery", label: "Discovery", icon: Sparkles },
    { href: "/channels", label: "Channels", icon: Cable },
    { href: "/media", label: "Media", icon: Image },
    { href: "/configuration", label: "Configuration", icon: Cog },
    { href: "/jobs", label: "Jobs", icon: Activity },
    { href: "/activity", label: "Activity", icon: FileClock },
];

export function AppShell({ children, operator }: { children: ReactNode; operator?: string }) {
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <Link href="/" className="brand">
                    <span className="brand-mark">S</span>
                    <span>
                        <strong>Spacebar</strong>
                        <small>Admin</small>
                    </span>
                </Link>
                <nav className="nav-list">
                    {navItems.map((item) => (
                        <Link key={item.href} href={item.href} className="nav-item">
                            <item.icon size={17} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    {operator ? <span className="operator-name">{operator}</span> : null}
                    <Link href="/logout" className="nav-item logout-link" prefetch={false}>
                        <LogOut size={17} />
                        <span>Logout</span>
                    </Link>
                </div>
            </aside>
            <main className="main-surface">{children}</main>
        </div>
    );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
    return (
        <header className="page-header">
            <div>
                <h1>{title}</h1>
                {description ? <p>{description}</p> : null}
            </div>
            {action ? <div className="page-action">{action}</div> : null}
        </header>
    );
}

export function Metric({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
    return (
        <div className={`metric metric-${tone}`}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

export function StatusPill({ value }: { value: string | boolean | null | undefined }) {
    const normalized = String(value ?? "unknown");
    const positive = ["succeeded", "online", "true", "available", "database"].includes(normalized);
    const negative = ["failed", "deleted", "disabled", "false", "readonly"].includes(normalized);
    const Icon = positive ? CheckCircle2 : negative ? CircleSlash : BadgeAlert;

    return (
        <span className={`status-pill ${positive ? "status-good" : negative ? "status-bad" : "status-neutral"}`}>
            <Icon size={13} />
            {normalized}
        </span>
    );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
    return (
        <section className="panel">
            <div className="panel-header">
                <h2>{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
    return (
        <div className="empty-state">
            <Shield size={22} />
            <strong>{title}</strong>
            {detail ? <span>{detail}</span> : null}
        </div>
    );
}

export function ErrorBanner({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <div className="error-banner">
            <BadgeAlert size={16} />
            <span>{message}</span>
        </div>
    );
}

export function ActionResultBanner({ success, error }: { success?: string; error?: string }) {
    const message = error || success;
    if (!message) return null;

    const failed = Boolean(error);
    const Icon = failed ? BadgeAlert : CheckCircle2;

    return (
        <div className={`action-banner ${failed ? "action-banner-error" : "action-banner-success"}`}>
            <Icon size={16} />
            <span>{message}</span>
        </div>
    );
}

export function ReturnToField({ value }: { value: string }) {
    return <input type="hidden" name="returnTo" value={value} />;
}

export function SearchForm({ defaultValue, placeholder = "Search" }: { defaultValue?: string; placeholder?: string }) {
    return (
        <form className="search-form">
            <Search size={16} />
            <input name="q" defaultValue={defaultValue} placeholder={placeholder} />
            <button type="submit">Apply</button>
        </form>
    );
}

export function PaginationControls({
    pagination,
    params = {},
    offsetParam = "offset",
}: {
    pagination: { limit: number; offset: number; total: number };
    params?: Record<string, string | number | boolean | undefined>;
    offsetParam?: string;
}) {
    const currentPage = pagination.total === 0 ? 0 : Math.floor(pagination.offset / pagination.limit) + 1;
    const totalPages = pagination.total === 0 ? 0 : Math.ceil(pagination.total / pagination.limit);
    const previousOffset = Math.max(0, pagination.offset - pagination.limit);
    const nextOffset = pagination.offset + pagination.limit;
    const hasPrevious = pagination.offset > 0;
    const hasNext = nextOffset < pagination.total;

    function hrefFor(offset: number) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== "") search.set(key, String(value));
        }
        if (offset > 0) {
            search.set(offsetParam, String(offset));
        } else {
            search.delete(offsetParam);
        }
        const value = search.toString();
        return value ? `?${value}` : "?";
    }

    return (
        <nav className="pagination" aria-label="Pagination">
            <span>
                Page {currentPage} of {totalPages} · {pagination.total} total
            </span>
            <div className="row-actions">
                {hasPrevious ? (
                    <Link href={hrefFor(previousOffset)} className="button secondary">
                        Previous
                    </Link>
                ) : (
                    <span className="button secondary button-disabled">Previous</span>
                )}
                {hasNext ? (
                    <Link href={hrefFor(nextOffset)} className="button secondary">
                        Next
                    </Link>
                ) : (
                    <span className="button secondary button-disabled">Next</span>
                )}
            </div>
        </nav>
    );
}

export function RowLink({ href }: { href: string }) {
    return (
        <Link href={href} className="row-link" aria-label="Open detail">
            <ChevronRight size={16} />
        </Link>
    );
}

export function CodeBlock({ value }: { value: unknown }) {
    return <pre className="code-block">{JSON.stringify(value, null, 2)}</pre>;
}

export function KeyValueList({ items }: { items: [string, ReactNode][] }) {
    return (
        <dl className="kv-list">
            {items.map(([key, value]) => (
                <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

export function DatabaseMode({ source, readonly }: { source: string; readonly: boolean }) {
    return (
        <span className="db-mode">
            <Database size={14} />
            {source}
            {readonly ? " readonly" : ""}
        </span>
    );
}

export function DestructiveActionFields({
    confirmation,
    reasonPlaceholder = "Operator reason",
    idempotency = false,
}: {
    confirmation: string;
    reasonPlaceholder?: string;
    idempotency?: boolean;
}) {
    return (
        <div className="destructive-fields">
            {idempotency ? <input type="hidden" name="idempotencyKey" value={randomUUID()} /> : null}
            <input name="reason" placeholder={reasonPlaceholder} required />
            <input name="confirmation" placeholder={`Type ${confirmation} to confirm`} autoComplete="off" required />
        </div>
    );
}
