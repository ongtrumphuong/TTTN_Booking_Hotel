import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BedDouble, CalendarCheck, Clock, Hotel, Wallet } from "lucide-react";
import { AdminFallback } from "@/components/admin/fallback";
import { STATUS_LABEL } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/session";
import { listUnsettled, sumRows } from "@/lib/settlement";

export const metadata: Metadata = { title: "Khu vực đối tác" };

async function Overview() {
  const user = await requireHost("/host");
  const mine = { room: { hotel: { ownerId: user.id } } };
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [hotels, pendingHotels, monthBookings, upcoming, unsettled, received, recent] = await Promise.all([
    prisma.hotel.count({ where: { ownerId: user.id } }),
    prisma.hotel.count({ where: { ownerId: user.id, approval: "PENDING" } }),
    prisma.booking.count({ where: { ...mine, createdAt: { gte: monthStart }, status: { not: "CANCELLED" } } }),
    prisma.booking.count({ where: { ...mine, status: "CONFIRMED", checkOut: { gte: monthStart } } }),
    listUnsettled(prisma, user.id),
    prisma.payout.aggregate({ where: { ownerId: user.id }, _sum: { amount: true } }),
    prisma.booking.findMany({
      where: mine,
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } }, room: { include: { hotel: { select: { name: true } } } } },
    }),
  ]);
  const owed = sumRows(unsettled);

  const kpis = [
    { label: "Khách sạn", value: `${hotels}${pendingHotels ? ` (${pendingHotels} chờ duyệt)` : ""}`, icon: Hotel },
    { label: "Đơn mới trong tháng", value: String(monthBookings), icon: CalendarCheck },
    { label: "Đơn đã xác nhận sắp tới", value: String(upcoming), icon: Clock },
    { label: "Sàn sẽ chi trả (chưa đối soát)", value: formatVND(owed.payout), icon: Wallet },
    { label: "Đã nhận từ sàn", value: formatVND(received._sum.amount ?? 0), icon: BedDouble },
  ];

  return (
    <>
      <h1 className="font-display mb-6 text-3xl font-semibold">Xin chào, {user.name}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl border border-border bg-white p-5">
            <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={20} aria-hidden /></span>
            <p className="text-2xl font-extrabold">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Đặt phòng gần đây</h2>
          <Link href="/host/bookings" className="text-sm font-semibold text-brand hover:underline">Xem tất cả →</Link>
        </div>
        <ul className="divide-y divide-border">
          {recent.length === 0 && <li className="py-3 text-sm text-muted">Chưa có đơn đặt phòng. Khi khách đặt phòng ở khách sạn của bạn, đơn sẽ hiện ở đây.</li>}
          {recent.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.room.hotel.name} · {b.room.name}</p>
                <p className="text-xs text-muted">{b.user.name} · {formatDate(b.checkIn)}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_LABEL[b.status].cls}`}>{STATUS_LABEL[b.status].text}</span>
                <p className="mt-1 font-bold">{formatVND(b.totalPrice)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function HostHome() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Overview />
    </Suspense>
  );
}
