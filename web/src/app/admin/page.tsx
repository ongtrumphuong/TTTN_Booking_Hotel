import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BedDouble, CalendarCheck, Hotel, Percent, TrendingUp, Undo2, Users, Wallet } from "lucide-react";
import { AdminFallback } from "@/components/admin/fallback";
import { AreaChart, BarChart, formatCompactVND } from "@/components/admin/charts";
import { STATUS_LABEL } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { RANGES, getDashboardStats, type Range } from "@/lib/stats";

export const metadata: Metadata = { title: "Quản trị" };

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const longDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pct = (n: number) => `${n.toFixed(n < 10 && n > 0 ? 1 : 0)}%`;

async function Overview({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin("/admin"); // kiểm tra ngay tại nơi đọc dữ liệu, không chỉ dựa vào layout
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.range) ? sp.range[0] : sp.range);
  const range: Range = RANGES.find((r) => r === raw) ?? 30;

  const [stats, hotels, rooms, users, bookings, recent] = await Promise.all([
    getDashboardStats(range),
    prisma.hotel.count(),
    prisma.room.count(),
    prisma.user.count(),
    prisma.booking.count(),
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } }, room: { include: { hotel: { select: { name: true } } } } },
    }),
  ]);

  const kpis = [
    { label: `Doanh thu ${range} ngày qua`, value: formatVND(stats.totalRevenue), icon: Wallet },
    { label: "Đơn mới trong kỳ", value: String(stats.newBookings), icon: CalendarCheck },
    { label: "Giá trị trung bình/đơn", value: stats.avgOrderValue ? formatVND(stats.avgOrderValue) : "—", icon: TrendingUp },
    { label: "Tỷ lệ hủy trong kỳ", value: pct(stats.cancelRate * 100), icon: Percent },
    { label: `Lấp đầy ${range} ngày tới`, value: pct(stats.avgOccupancy), icon: BedDouble },
    { label: "Chờ hoàn tiền", value: String(stats.pendingRefunds), icon: Undo2, href: "/admin/bookings?status=REFUND", warn: stats.pendingRefunds > 0 },
  ];
  const totals = [
    { label: "Khách sạn", value: hotels, icon: Hotel },
    { label: "Loại phòng", value: rooms, icon: BedDouble },
    { label: "Người dùng", value: users, icon: Users },
    { label: "Tổng đơn", value: bookings, icon: CalendarCheck },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Tổng quan</h1>
        <div className="flex gap-2 text-sm" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={r === 30 ? "/admin" : `/admin?range=${r}`}
              aria-current={r === range ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 font-medium ${r === range ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}
            >
              {r} ngày
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon, href, warn }) => {
          const card = (
            <div className={`h-full rounded-2xl border bg-white p-5 ${warn ? "border-amber-300 bg-amber-50/50" : "border-border"}`}>
              <span className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${warn ? "bg-amber-100 text-amber-700" : "bg-brand/10 text-brand"}`}>
                <Icon size={20} aria-hidden />
              </span>
              <p className="text-2xl font-extrabold">{value}</p>
              <p className="text-sm text-muted">{label}</p>
            </div>
          );
          return href ? <Link key={label} href={href}>{card}</Link> : <div key={label}>{card}</div>;
        })}
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-white p-5" aria-labelledby="rev-title">
        <h2 id="rev-title" className="text-lg font-extrabold">Doanh thu theo ngày</h2>
        <p className="mb-3 text-xs text-muted">Tổng tiền các đơn đã thanh toán và chưa hủy, tính theo ngày đặt.</p>
        <BarChart
          title={`Doanh thu ${range} ngày qua`}
          unit="Doanh thu"
          format={formatCompactVND}
          data={stats.revenue.map((p) => ({ label: shortDate(p.date), value: p.revenue, tooltip: `${longDate(p.date)}: ${formatVND(p.revenue)} (${p.bookings} đơn)` }))}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-white p-5" aria-labelledby="occ-title">
        <h2 id="occ-title" className="text-lg font-extrabold">Tỷ lệ lấp đầy {range} ngày tới</h2>
        <p className="mb-3 text-xs text-muted">
          Số phòng đã được đặt hoặc đang giữ chỗ trên tổng {stats.capacity} phòng đang bán.
        </p>
        <AreaChart
          title={`Tỷ lệ lấp đầy ${range} ngày tới`}
          unit="Tỷ lệ lấp đầy"
          format={(n) => `${Math.round(n)}%`}
          max={100}
          data={stats.occupancy.map((p) => ({ label: shortDate(p.date), value: p.percent, tooltip: `${longDate(p.date)}: ${pct(p.percent)} (${p.occupied}/${stats.capacity} phòng)` }))}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-white p-5">
          <h2 className="font-display mb-3 text-xl font-semibold">Khách sạn doanh thu cao nhất</h2>
          {stats.topHotels.length === 0 ? (
            <p className="text-sm text-muted">Chưa có doanh thu trong kỳ.</p>
          ) : (
            <ol className="space-y-3">
              {stats.topHotels.map((h, i) => (
                <li key={h.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">{i + 1}. {h.name}</span>
                    <span className="shrink-0 font-bold">{formatVND(h.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-border" aria-hidden>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(h.revenue / stats.topHotels[0].revenue) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{h.bookings} đơn</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Đặt phòng gần đây</h2>
            <Link href="/admin/bookings" className="text-sm font-semibold text-brand hover:underline">Xem tất cả →</Link>
          </div>
          <ul className="divide-y divide-border">
            {recent.length === 0 && <li className="py-3 text-sm text-muted">Chưa có đơn đặt phòng.</li>}
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
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-3xl border border-border bg-white p-4">
            <Icon size={18} className="text-muted" aria-hidden />
            <div>
              <p className="text-lg font-extrabold leading-tight">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Overview searchParams={props.searchParams} />
    </Suspense>
  );
}
