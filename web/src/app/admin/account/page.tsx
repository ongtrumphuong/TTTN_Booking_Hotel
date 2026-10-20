import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { AccountView } from "@/components/account-view";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Tài khoản" };

async function Content() {
  await requireAdmin("/admin/account");
  return <AccountView returnTo="/admin/account" />;
}

export default function AdminAccountPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
