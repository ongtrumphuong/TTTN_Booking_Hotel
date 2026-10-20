import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountView } from "@/components/account-view";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Tài khoản của tôi", robots: NOINDEX };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-border" />}>
        <AccountView returnTo="/account" />
      </Suspense>
    </div>
  );
}
