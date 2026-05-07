/** @type {import('next').NextConfig} */
const dashboardBasePath = (process.env.SPACEBAR_ADMIN_DASHBOARD_BASE_PATH ?? "/_spacebar/admin").replace(/\/+$/, "");

const nextConfig = {
    basePath: dashboardBasePath || undefined,
    reactStrictMode: true,
};

export default nextConfig;
