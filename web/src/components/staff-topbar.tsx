import Link from "next/link";
import { UserRound } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";

const ROLE_LABEL = { ADMIN: "Quản trị sàn", HOST: "Đối tác khách sạn", USER: "" } as const;

/** Thanh trên cùng riêng cho quản trị viên và đối tác: không có liên kết sang giao diện khách. */
export async function StaffTopBar({ base }: { base: "/admin" | "/host" }) {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-3">
          <Link href={base} aria-label="Trang chủ khu vực quản lý" className="shrink-0">
            <Logo light />
          </Link>
          {user && <span className="hidden rounded-full bg-sun px-3 py-1 text-xs font-bold sm:inline">{ROLE_LABEL[user.role]}</span>}
        </div>
        {user && (
          <div className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold">
            <Link href={`${base}/account`} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-white/85 hover:bg-white/10">
              <UserRound size={16} aria-hidden />
              <span className="hidden max-w-36 truncate sm:inline">{user.name}</span>
              <span className="sr-only sm:hidden">Tài khoản của {user.name}</span>
            </Link>
            <LogoutButton tone="dark" />
          </div>
        )}
      </div>
    </header>
  );
}

export function StaffTopBarFallback() {
  return <div className="h-14 bg-ink" aria-hidden />;
}
