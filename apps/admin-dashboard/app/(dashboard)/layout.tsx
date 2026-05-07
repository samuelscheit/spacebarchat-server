import type { ReactNode } from "react";
import { AppShell } from "../components";
import { requireAdminSession } from "../lib/admin-session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const session = await requireAdminSession();

    return <AppShell operator={session.user.username}>{children}</AppShell>;
}
