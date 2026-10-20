"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/hotels", label: "Tất cả khách sạn" },
  { href: "/#diem-den", label: "Điểm đến phổ biến" },
  { href: "/favorites", label: "Khách sạn yêu thích" },
  { href: "/bookings", label: "Đặt phòng của tôi" },
  { href: "/partner", label: "Dành cho đối tác" },
];

/** Menu điều hướng cho màn hình nhỏ; tự đóng khi chuyển trang hoặc nhấn Esc. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Đóng menu khi chuyển trang: điều chỉnh state ngay trong lúc render thay vì gọi setState trong effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Đóng menu" : "Mở menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-lg hover:bg-background"
      >
        {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>
      {open && (
        <nav
          id="mobile-nav-panel"
          aria-label="Điều hướng chính"
          className="absolute inset-x-0 top-16 z-30 border-b border-border bg-white px-4 py-3 shadow-lg"
        >
          <ul className="mx-auto max-w-6xl">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-background">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
