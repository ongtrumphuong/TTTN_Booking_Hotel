import Link from "next/link";
import { Heart, LayoutDashboard, UserRound } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { getCurrentUser } from "@/lib/session";

export function AuthButtonsFallback() {
  return <div className="h-9 w-40 animate-pulse rounded-lg bg-border" aria-hidden />;
}

export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold sm:gap-2">
        <Link href="/login" className="rounded-lg px-3 py-2 text-foreground hover:bg-background sm:px-4">Đăng nhập</Link>
        <Link href="/register" className="rounded-lg bg-brand px-3 py-2 text-white hover:bg-brand-dark sm:px-4">Đăng ký</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold">
      {user.role === "HOST" && (
        <Link href="/host" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-brand hover:bg-brand/10">
          <LayoutDashboard size={16} aria-hidden /> <span className="hidden sm:inline">Đối tác</span>
        </Link>
      )}
      {user.role === "ADMIN" && (
        <Link href="/admin" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-brand hover:bg-brand/10">
          <LayoutDashboard size={16} aria-hidden /> <span className="hidden sm:inline">Quản trị</span>
        </Link>
      )}
      <Link href="/favorites" aria-label="Khách sạn yêu thích" title="Yêu thích" className="rounded-lg px-3 py-2 hover:bg-background">
        <Heart size={16} aria-hidden />
      </Link>
      <Link href="/bookings" className="hidden rounded-lg px-3 py-2 hover:bg-background lg:block">Đặt phòng của tôi</Link>
      <Link href="/account" className="flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-background">
        <UserRound size={16} aria-hidden />
        <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
        <span className="sr-only sm:hidden">Tài khoản của {user.name}</span>
      </Link>
      <LogoutButton />
    </div>
  );
}
