import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/password-forms";
import { isResetTokenValid } from "@/lib/password-reset";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Đặt lại mật khẩu", robots: NOINDEX };

async function Content({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const sp = await searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? "";
  if (!(await isResetTokenValid(token))) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">Liên kết không hợp lệ hoặc đã hết hạn.</p>
        <Link href="/forgot-password" className="font-semibold text-brand hover:underline">Yêu cầu liên kết mới</Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-extrabold">Đặt mật khẩu mới</h1>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-border" />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
