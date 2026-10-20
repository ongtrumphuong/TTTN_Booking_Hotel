import Link from "next/link";
import { holdingWhere, isoDate, parseStay, todayUTC } from "@/lib/booking";
import { formatVND } from "@/lib/format";
import { occupancy } from "@/lib/occupancy";
import { nightlyPrices } from "@/lib/pricing";
import { loadPricing } from "@/lib/pricing-db";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

const DAYS = 21;
const DAY_MS = 86_400_000;
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

/** Lịch phòng 3 tuần: cho thấy phòng nào kín ngày nào, đã chặn và giá từng đêm. Dùng chung cho /admin và /host. */
export async function OccupancyCalendar({ user, searchParams, base }: { user: Pick<SessionUser, "id" | "role">; searchParams: Promise<SP>; base: "/admin" | "/host" }) {
  const sp = await searchParams;
  const hotels = await prisma.hotel.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (hotels.length === 0) {
    return <div className="rounded-3xl border border-border bg-white p-10 text-center text-sm text-muted">Chưa có khách sạn nào để hiển thị lịch.</div>;
  }
  const hotel = hotels.find((h) => h.id === one(sp.hotel)) ?? hotels[0];

  const today = todayUTC();
  const fromParam = parseStay(one(sp.from), "2100-01-02")?.checkIn;
  const from = fromParam && fromParam.getTime() > today.getTime() - 60 * DAY_MS && fromParam.getTime() < today.getTime() + 365 * DAY_MS ? fromParam : today;
  const to = new Date(from.getTime() + DAYS * DAY_MS);
  const prev = new Date(from.getTime() - 7 * DAY_MS);
  const next = new Date(from.getTime() + 7 * DAY_MS);
  const link = (f: Date, h = hotel.id) => `${base}/calendar?hotel=${h}&from=${isoDate(f)}`;

  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id, isActive: true },
    orderBy: { pricePerNight: "asc" },
    select: {
      id: true,
      name: true,
      quantity: true,
      pricePerNight: true,
      weekendPercent: true,
      blocks: { where: { startDate: { lt: to }, endDate: { gt: from } }, select: { startDate: true, endDate: true, rooms: true } },
      bookings: { where: { checkIn: { lt: to }, checkOut: { gt: from }, ...holdingWhere() }, select: { checkIn: true, checkOut: true, rooms: true } },
    },
  });
  const pricing = await loadPricing(prisma, rooms, from, to);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Lịch phòng</h1>
          <p className="text-sm text-muted">Số phòng còn trống mỗi đêm trong {DAYS} ngày. Di chuột vào ô để xem chi tiết.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {hotels.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {hotels.map((h) => (
                <Link key={h.id} href={link(from, h.id)} aria-current={h.id === hotel.id ? "true" : undefined} className={`rounded-full px-3 py-1.5 ${h.id === hotel.id ? "bg-brand text-white" : "border border-border bg-white hover:bg-background"}`}>
                  {h.name}
                </Link>
              ))}
            </div>
          )}
          <Link href={link(prev)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">← Tuần trước</Link>
          <Link href={link(today)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">Hôm nay</Link>
          <Link href={link(next)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">Tuần sau →</Link>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted">{hotel.name}</p>
      {rooms.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-10 text-center text-sm text-muted">Khách sạn này chưa có loại phòng đang bán.</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-border bg-white">
          <table className="w-full min-w-[900px] border-collapse text-center text-xs">
            <thead>
              <tr className="bg-sand">
                <th className="sticky left-0 z-10 bg-sand px-3 py-2 text-left text-sm">Loại phòng</th>
                {Array.from({ length: DAYS }, (_, i) => {
                  const d = new Date(from.getTime() + i * DAY_MS);
                  const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                  return (
                    <th key={i} className={`px-1 py-2 font-semibold ${weekend ? "text-sun" : ""}`}>
                      <div>{WEEKDAY[d.getUTCDay()]}</div>
                      <div className="text-[11px] font-medium text-muted">{String(d.getUTCDate()).padStart(2, "0")}/{String(d.getUTCMonth() + 1).padStart(2, "0")}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const days = occupancy(r.quantity, r.bookings, r.blocks, from, DAYS);
                const prices = nightlyPrices(pricing.get(r.id)!, from, to);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left align-middle">
                      <div className="text-sm font-bold">{r.name}</div>
                      <div className="text-[11px] font-medium text-muted">{r.quantity} phòng · {formatVND(r.pricePerNight)}</div>
                    </th>
                    {days.map((d, i) => {
                      const full = d.free === 0;
                      const cls = full ? "bg-red-100 text-red-800" : d.booked + d.blocked > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800";
                      const p = prices[i];
                      return (
                        <td key={i} className="p-0.5">
                          <div
                            className={`rounded-lg px-1 py-1.5 ${cls}`}
                            title={`${isoDate(d.date).split("-").reverse().join("/")}: đã đặt ${d.booked}, chặn ${d.blocked}, còn ${d.free}/${r.quantity} phòng. Giá ${formatVND(p.price)}${p.reasons.length ? ` (${p.reasons.join(", ")})` : ""}`}
                          >
                            <div className="text-sm font-bold">{d.free}</div>
                            <div className={`text-[10px] ${p.percent !== 0 ? "font-bold" : "text-muted"}`}>{Math.round(p.price / 1000)}k</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li><span className="mr-1.5 inline-block size-3 rounded bg-emerald-100 align-middle" />Còn trống hoàn toàn</li>
        <li><span className="mr-1.5 inline-block size-3 rounded bg-amber-100 align-middle" />Đã có đơn hoặc chặn một phần</li>
        <li><span className="mr-1.5 inline-block size-3 rounded bg-red-200 align-middle" />Kín phòng</li>
        <li>Số lớn: phòng còn trống · số nhỏ: giá đêm (nghìn đồng, chữ đậm là có phụ thu hoặc giảm giá)</li>
      </ul>
    </>
  );
}
