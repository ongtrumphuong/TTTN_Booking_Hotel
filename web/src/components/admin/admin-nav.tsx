"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, CalendarCheck, LayoutDashboard, MessageSquareText, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/admin/hotels", label: "Khách sạn", icon: BedDouble },
  { href: "/admin/bookings", label: "Đơn đặt phòng", icon: CalendarCheck },
  { href: "/admin/reviews", label: "Đánh giá", icon: MessageSquareText },
  { href: "/admin/users", label: "Người dùng", icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Quản trị" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${
              active ? "bg-brand text-white" : "text-muted hover:bg-white hover:text-foreground"
            }`}
          >
            <Icon size={18} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
