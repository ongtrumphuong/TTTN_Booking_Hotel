import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { AccountView } from "@/components/account-view";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Tài khoản" };

async function Content() {
  await requireHost("/host/account");
  return <AccountView returnTo="/host/account" />;
}

export default function HostAccountPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
