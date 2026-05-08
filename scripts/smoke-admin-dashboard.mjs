const dashboardUrl = new URL(process.env.SPACEBAR_ADMIN_DASHBOARD_URL ?? process.env.ADMIN_DASHBOARD_URL ?? "http://127.0.0.1:3300/_spacebar/admin");
const dashboardPath = dashboardUrl.pathname.replace(/\/+$/, "");
const healthUrl = new URL(`${dashboardPath}/health`, dashboardUrl);
const timeoutMs = Number(process.env.SPACEBAR_ADMIN_SMOKE_TIMEOUT_MS ?? 5000);
const token = process.env.SPACEBAR_ADMIN_TOKEN;

async function fetchWithTimeout(url, init = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        throw new Error(`Expected JSON from ${response.url}`);
    }
}

const health = await fetchWithTimeout(healthUrl, {
    headers: { accept: "application/json" },
});

if (!health.ok) {
    throw new Error(`Dashboard health check failed: ${health.status} ${health.statusText}`);
}

const body = await readJson(health);
if (body.service !== "spacebar-admin-dashboard" || body.ok !== true) {
    throw new Error(`Unexpected dashboard health payload: ${JSON.stringify(body)}`);
}

console.log(`dashboard health ok: ${healthUrl.toString()}`);

if (token) {
    const page = await fetchWithTimeout(dashboardUrl, {
        headers: {
            accept: "text/html",
            authorization: token.startsWith("Bearer ") || token.startsWith("Bot ") ? token : `Bearer ${token}`,
        },
    });

    if (!page.ok) {
        throw new Error(`Dashboard SSR check failed: ${page.status} ${page.statusText}`);
    }

    const html = await page.text();
    if (!html.includes("Spacebar")) {
        throw new Error("Dashboard SSR check returned unexpected HTML");
    }

    console.log(`dashboard ssr ok: ${dashboardUrl.toString()}`);
} else {
    console.log("dashboard ssr auth check skipped: set SPACEBAR_ADMIN_TOKEN to verify authenticated SSR");
}
