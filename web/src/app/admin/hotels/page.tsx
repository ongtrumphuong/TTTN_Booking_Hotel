import { Suspense } from "react";
import { AdminFallback } from "@/components/admin/fallback";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ToggleButton } from "@/components/admin/toggle-button";
import { formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản lý khách sạn" };

async function HotelsList() {
  await requireAdmin("/admin/hotels");
  const hotels = await prisma.hotel.findMany({
    orderBy: { createdAt: "desc" },
    include: { rooms: { select: { pricePerNight: true } }, _count: { select: { reviews: true } } },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Khách sạn <span className="text-base font-medium text-muted">({hotels.length})</span></h1>
        <Link href="/admin/hotels/new" className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
          <Plus size={16} aria-hidden /> Thêm khách sạn
        </Link>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Khách sạn</th>
              <th className="px-4 py-3">Thành phố</th>
              <th className="px-4 py-3">Phòng</th>
              <th className="px-4 py-3">Giá từ</th>
              <th className="px-4 py-3">Hiển thị</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {hotels.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 font-semibold">{h.name} <span className="font-normal text-muted">· {h.starRating}★</span></td>
                <td className="px-4 py-3">{h.city}</td>
                <td className="px-4 py-3">{h.rooms.length}</td>
                <td className="px-4 py-3">{h.rooms.length ? formatVND(Math.min(...h.rooms.map((r) => r.pricePerNight))) : "—"}</td>
                <td className="px-4 py-3"><ToggleButton kind="hotel" id={h.id} active={h.isActive} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/hotels/${h.id}`} className="font-semibold text-brand hover:underline">Chỉnh sửa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminHotelsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <HotelsList />
    </Suspense>
  );
}
