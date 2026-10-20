import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { AuthButtonsFallback, UserMenu } from "./user-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex items-center gap-1">
          <Suspense fallback={<div className="size-10 xl:hidden" aria-hidden />}>
            <MobileNav />
          </Suspense>
          <Link href="/" aria-label="Không Gian Số Stay - Trang chủ" className="shrink-0">
            <Logo />
          </Link>
        </div>
        <nav className="hidden items-center gap-7 whitespace-nowrap text-sm font-medium text-muted xl:flex">
          <Link href="/hotels" className="hover:text-brand">Khách sạn</Link>
          <Link href="/hotels?city=Đà Nẵng" className="hover:text-brand">Đà Nẵng</Link>
          <Link href="/hotels?city=Hà Nội" className="hover:text-brand">Hà Nội</Link>
          <Link href="/hotels?city=Phú Quốc" className="hover:text-brand">Phú Quốc</Link>
        </nav>
        <Suspense fallback={<AuthButtonsFallback />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
