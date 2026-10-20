import { Suspense } from "react";
import { AdminFallback } from "@/components/admin/fallback";
import Link from "next/link";
import type { Metadata } from "next";
import { BedDouble, CalendarCheck, Hotel, Users, Wallet } from "lucide-react";
import { STATUS_LABEL } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản trị" };

async function Overview() {
  await requireAdmin("/admin"); // kiểm tra ngay tại nơi đọc dữ liệu, không chỉ dựa vào layout
  const [hotels, rooms, users, bookings, revenue, pending, recent] = await Promise.all([
    prisma.hotel.count(),
    prisma.room.count(),
    prisma.user.count(),
    prisma.booking.count(),
    prisma.booking.aggregate({ _sum: { totalPrice: true }, where: { paymentStatus: "PAID" } }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } }, room: { include: { hotel: { select: { name: true } } } } },
    }),
  ]);

  const items = [
    { label: "Khách sạn", value: String(hotels), icon: Hotel },
    { label: "Loại phòng", value: String(rooms), icon: BedDouble },
    { label: "Người dùng", value: String(users), icon: Users },
    { label: "Lượt đặt phòng", value: String(bookings), icon: CalendarCheck },
    { label: "Doanh thu đã thu", value: formatVND(revenue._sum.totalPrice ?? 0), icon: Wallet },
    { label: "Đơn chờ thanh toán", value: String(pending), icon: CalendarCheck },
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">Tổng quan</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-white p-5">
            <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Icon size={20} aria-hidden />
            </span>
            <p className="text-2xl font-extrabold">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Đặt phòng gần đây</h2>
        <Link href="/admin/bookings" className="text-sm font-semibold text-brand hover:underline">Xem tất cả →</Link>
      </div>
      <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-white">
        {recent.length === 0 && <li className="p-5 text-sm text-muted">Chưa có đơn đặt phòng.</li>}
        {recent.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-semibold">{b.room.hotel.name} · {b.room.name}</p>
              <p className="text-muted">{b.user.name} · {formatDate(b.checkIn)} → {formatDate(b.checkOut)}</p>
            </div>
            <div className="text-right">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_LABEL[b.status].cls}`}>{STATUS_LABEL[b.status].text}</span>
              <p className="mt-1 font-bold">{formatVND(b.totalPrice)}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Overview />
    </Suspense>
  );
}
