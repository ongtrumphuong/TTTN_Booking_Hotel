import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { VoucherForm, VoucherToggle } from "@/components/admin/voucher-form";
import { holdingWhere } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Mã giảm giá" };

async function Vouchers() {
  await requireAdmin("/admin/vouchers");
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const usage = await prisma.booking.groupBy({
    by: ["voucherCode"],
    where: { voucherCode: { in: vouchers.map((v) => v.code) }, OR: [holdingWhere(), { status: "COMPLETED" }] },
    _count: { _all: true },
  });
  const used = new Map(usage.map((u) => [u.voucherCode, u._count._all]));

  return (
    <>
      <h1 className="font-display mb-6 text-3xl font-semibold">Mã giảm giá <span className="text-base font-medium text-muted">({vouchers.length})</span></h1>
      <VoucherForm />

      <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Ưu đãi</th>
              <th className="px-4 py-3">Điều kiện</th>
              <th className="px-4 py-3">Thời hạn</th>
              <th className="px-4 py-3">Đã dùng</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vouchers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Chưa có mã giảm giá nào.</td></tr>
            )}
            {vouchers.map((v) => (
              <tr key={v.id} className="align-top">
                <td className="px-4 py-3"><p className="font-mono font-bold">{v.code}</p>{v.description && <p className="text-xs text-muted">{v.description}</p>}</td>
                <td className="px-4 py-3">
                  {v.percentOff ? `Giảm ${v.percentOff}%` : `Giảm ${formatVND(v.amountOff ?? 0)}`}
                  {v.maxDiscount ? <span className="block text-xs text-muted">Tối đa {formatVND(v.maxDiscount)}</span> : null}
                </td>
                <td className="px-4 py-3 text-xs">
                  {v.minSubtotal > 0 ? `Đơn từ ${formatVND(v.minSubtotal)}` : "Không yêu cầu tối thiểu"}
                  <span className="block text-muted">{v.perUserLimit} lượt/khách</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {v.startsAt ? formatDate(v.startsAt) : "Ngay"} → {v.endsAt ? formatDate(v.endsAt) : "Không hết hạn"}
                </td>
                <td className="px-4 py-3">{used.get(v.code) ?? 0}{v.usageLimit ? ` / ${v.usageLimit}` : ""}</td>
                <td className="px-4 py-3"><VoucherToggle id={v.id} active={v.isActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function VouchersPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Vouchers />
    </Suspense>
  );
}
