import { loginAdmin } from "../actions";

export const dynamic = "force-dynamic";

const reasonMessages: Record<string, string> = {
    missing: "Enter an admin token to continue.",
    expired: "The admin token is expired or invalid.",
    forbidden: "This token is valid, but OPERATOR rights are required.",
    unreachable: "The admin API could not be reached. Check SPACEBAR_ADMIN_API_URL.",
    logout: "The admin session has been cleared.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
    const params = await searchParams;
    const reason = params.reason ?? "missing";
    const message = reasonMessages[reason] ?? reasonMessages.missing;

    return (
        <main className="auth-shell">
            <section className="auth-panel">
                <div>
                    <span className="brand-mark">S</span>
                    <h1>Spacebar Admin</h1>
                    <p>{message}</p>
                </div>
                <form action={loginAdmin} className="auth-form">
                    <label htmlFor="token">Admin token</label>
                    <textarea id="token" name="token" placeholder="Bearer ..." autoComplete="off" spellCheck={false} required />
                    <button type="submit">Login</button>
                </form>
            </section>
        </main>
    );
}
