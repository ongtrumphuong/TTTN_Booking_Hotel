import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { Logo } from "./logo";
import { getCurrentUser, safeRedirect } from "@/lib/session";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function Content({ mode, searchParams }: { mode: "login" | "register"; searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
  const callbackUrl = safeRedirect(raw);

  if (await getCurrentUser()) redirect(callbackUrl);

  const isLogin = mode === "login";
  return (
    <>
      <h1 className="text-2xl font-extrabold">{isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {isLogin ? "Đăng nhập để quản lý đặt phòng của bạn." : "Đăng ký để đặt phòng nhanh hơn và lưu khách sạn yêu thích."}
      </p>
      <AuthForm mode={mode} callbackUrl={callbackUrl} />
    </>
  );
}

export function AuthShell({ mode, searchParams }: { mode: "login" | "register"; searchParams: SP }) {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-10 px-4 py-12 md:grid-cols-2">
      <div className="hidden rounded-3xl bg-gradient-to-br from-ink to-brand p-10 text-white md:block">
        <Logo light />
        <p className="mt-10 text-3xl font-extrabold leading-snug">Đặt phòng khách sạn nhanh, giá tốt, an tâm trọn vẹn.</p>
        <ul className="mt-6 space-y-2 text-sm text-white/80">
          <li>✓ Xác nhận đặt phòng ngay lập tức</li>
          <li>✓ Quản lý lịch sử đặt phòng dễ dàng</li>
          <li>✓ Hỗ trợ 24/7</li>
        </ul>
      </div>
      <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-border" />}>
          <Content mode={mode} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
