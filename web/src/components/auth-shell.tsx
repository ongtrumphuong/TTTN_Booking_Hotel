import { Suspense } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { Logo } from "./logo";
import { afterLoginPath } from "@/lib/role-routing";
import { getCurrentUser, safeRedirect } from "@/lib/session";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function Content({ mode, searchParams, partner }: { mode: "login" | "register"; searchParams: SP; partner: boolean }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
  const callbackUrl = safeRedirect(raw, partner ? "/host" : "/");

  const current = await getCurrentUser();
  if (current) redirect(afterLoginPath(current.role, callbackUrl)); // đã đăng nhập thì vào thẳng giao diện của vai trò mình

  const isLogin = mode === "login";
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">{isLogin ? "Chào mừng trở lại" : partner ? "Trở thành đối tác" : "Tạo tài khoản mới"}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {isLogin ? "Đăng nhập để quản lý đặt phòng của bạn." : partner ? "Đăng ký để đưa khách sạn của bạn lên sàn, nhận đơn đặt phòng và được sàn chi trả sau khi trừ hoa hồng." : "Đăng ký để đặt phòng nhanh hơn và lưu khách sạn yêu thích."}
      </p>
      <AuthForm mode={mode} callbackUrl={callbackUrl} partner={partner} />
    </>
  );
}

const SIDE_PHOTO = "https://images.unsplash.com/photo-1698809807960-758cf416e96e?auto=format&fit=crop&w=1000&q=80";

export function AuthShell({ mode, searchParams, partner = false }: { mode: "login" | "register"; searchParams: SP; partner?: boolean }) {
  return (
    <div className="mx-auto grid min-h-[72vh] max-w-5xl items-stretch gap-6 px-4 py-10 md:grid-cols-[1.05fr_1fr]">
      <div className="relative isolate hidden min-h-[520px] overflow-hidden rounded-[2rem] p-10 text-white md:flex md:flex-col md:justify-between">
        <Image src={SIDE_PHOTO} alt="" fill priority sizes="520px" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/30" />
        <Logo light />
        <div>
          <p className="font-display text-3xl font-semibold leading-snug">Mỗi chuyến đi đẹp bắt đầu từ một chỗ nghỉ tử tế.</p>
          <ul className="mt-6 space-y-2.5 text-sm text-white/85">
            {["Xác nhận đặt phòng ngay lập tức", "Chính sách hủy rõ ràng từng khách sạn", "Thanh toán an toàn qua VNPay"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-sun"><Check size={12} aria-hidden /></span> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col justify-center rounded-[2rem] border border-border bg-white p-8 shadow-xl shadow-ink/5 md:p-10">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-border" />}>
          <Content mode={mode} searchParams={searchParams} partner={partner} />
        </Suspense>
      </div>
    </div>
  );
}
