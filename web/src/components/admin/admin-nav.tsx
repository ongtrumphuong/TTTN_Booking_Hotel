"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, CalendarCheck, CalendarDays, Handshake, LayoutDashboard, MessageSquareText, ScanLine, ScrollText, TicketPercent, UserRound, Users, Wallet } from "lucide-react";

const HOST_ITEMS = [
  { href: "/host", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/host/hotels", label: "Khách sạn của tôi", icon: BedDouble },
  { href: "/host/bookings", label: "Đơn đặt phòng", icon: CalendarCheck },
  { href: "/host/calendar", label: "Lịch phòng", icon: CalendarDays },
  { href: "/host/checkin", label: "Nhận phòng (quét vé)", icon: ScanLine },
  { href: "/host/reviews", label: "Đánh giá", icon: MessageSquareText },
  { href: "/host/payouts", label: "Đối soát & chi trả", icon: Wallet },
  { href: "/host/account", label: "Tài khoản", icon: UserRound },
];

const ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/admin/hotels", label: "Khách sạn", icon: BedDouble },
  { href: "/admin/bookings", label: "Đơn đặt phòng", icon: CalendarCheck },
  { href: "/admin/calendar", label: "Lịch phòng", icon: CalendarDays },
  { href: "/admin/checkin", label: "Nhận phòng (quét vé)", icon: ScanLine },
  { href: "/admin/reviews", label: "Đánh giá", icon: MessageSquareText },
  { href: "/admin/vouchers", label: "Mã giảm giá", icon: TicketPercent },
  { href: "/admin/partners", label: "Đối tác", icon: Handshake },
  { href: "/admin/payouts", label: "Đối soát", icon: Wallet },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/audit", label: "Nhật ký thao tác", icon: ScrollText },
  { href: "/admin/account", label: "Tài khoản", icon: UserRound },
];

export function AdminNav({ variant = "admin" }: { variant?: "admin" | "host" }) {
  const pathname = usePathname();
  const items = variant === "host" ? HOST_ITEMS : ITEMS;
  return (
    <nav aria-label={variant === "host" ? "Khu vực đối tác" : "Quản trị"} className="flex gap-1 overflow-x-auto rounded-3xl bg-ink p-2 md:flex-col md:p-3">
      {items.map(({ href, label, icon: Icon, exact }) => {
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
