"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, CalendarCheck, LayoutDashboard, MessageSquareText, TicketPercent, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/admin/hotels", label: "Khách sạn", icon: BedDouble },
  { href: "/admin/bookings", label: "Đơn đặt phòng", icon: CalendarCheck },
  { href: "/admin/reviews", label: "Đánh giá", icon: MessageSquareText },
  { href: "/admin/vouchers", label: "Mã giảm giá", icon: TicketPercent },
  { href: "/admin/users", label: "Người dùng", icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Quản trị" className="flex gap-1 overflow-x-auto rounded-3xl bg-ink p-2 md:flex-col md:p-3">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
              active ? "bg-brand text-white shadow-lg shadow-black/20" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={18} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
