import { Suspense } from "react";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ConfirmForm } from "@/components/assistant/confirm-form";
import { verifyProposal } from "@/lib/assistant/proposal";
import { parseStay, todayUTC, unavailableQuantity } from "@/lib/booking";
import { policyText } from "@/lib/cancellation";
import { formatDate, formatVND } from "@/lib/format";
import { stayPrice } from "@/lib/pricing";
import { loadRoomPricing } from "@/lib/pricing-db";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Xác nhận giữ phòng", robots: NOINDEX };

const Notice = ({ children }: { children: React.ReactNode }) => (
  <div role="alert" className="rounded-3xl border border-border bg-white p-8 text-center">
    <p className="text-sm text-muted">{children}</p>
    <Link href="/" className="mt-4 inline-block font-semibold text-brand hover:underline">← Về trang chủ</Link>
  </div>
);

async function Confirm({ searchParams }: Pick<PageProps<"/assistant/confirm">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const token = (Array.isArray(sp.t) ? sp.t[0] : sp.t) ?? "";
  const proposal = verifyProposal(token);
  if (!proposal) return <Notice>Đề xuất đã hết hạn hoặc không hợp lệ. Hãy nhờ trợ lý tìm lại.</Notice>;

  await requireUser(`/assistant/confirm?t=${encodeURIComponent(token)}`);

  const stay = parseStay(proposal.checkIn, proposal.checkOut);
  const room = await prisma.room.findFirst({ where: { id: proposal.roomId, isActive: true, hotel: { isActive: true } }, include: { hotel: true } });
  if (!stay || stay.checkIn < todayUTC() || !room) return <Notice>Phòng này không còn khả dụng cho ngày đã chọn. Hãy nhờ trợ lý tìm lại.</Notice>;

  const left = room.quantity - (await unavailableQuantity(prisma, room.id, stay.checkIn, stay.checkOut));
  const fits = left >= proposal.rooms && proposal.guests <= room.capacity * proposal.rooms;
  const total = stayPrice(await loadRoomPricing(prisma, room, stay.checkIn, stay.checkOut), stay.checkIn, stay.checkOut) * proposal.rooms; // luôn tính lại ở máy chủ

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      <div className="rounded-3xl border border-border bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Trợ lý ảo đề xuất</p>
        <h1 className="font-display mt-1 text-3xl font-semibold">Xác nhận giữ phòng</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Hãy xem lại thông tin. Trợ lý chỉ gợi ý; phòng chỉ được giữ khi bạn bấm nút bên dưới.</p>
        <dl className="mb-6 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Khách sạn</dt><dd className="font-semibold">{room.hotel.name}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Loại phòng</dt><dd className="font-semibold">{room.name} × {proposal.rooms}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Nhận phòng</dt><dd className="font-semibold">{formatDate(stay.checkIn)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Trả phòng</dt><dd className="font-semibold">{formatDate(stay.checkOut)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Số khách</dt><dd className="font-semibold">{proposal.guests}</dd></div>
          <div className="flex justify-between border-t border-border pt-3 text-base"><dt className="font-semibold">Tổng ({stay.nights} đêm)</dt><dd className="text-xl font-extrabold text-brand">{formatVND(total)}</dd></div>
        </dl>
        {fits ? (
          <ConfirmForm token={token} />
        ) : (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Rất tiếc, phòng vừa hết hoặc không đủ sức chứa. Hãy nhờ trợ lý tìm phương án khác.</div>
        )}
        <p className="mt-4 text-xs text-muted"><b className="text-foreground">Chính sách hủy:</b> {policyText(room.hotel.freeCancelDays, room.hotel.lateCancelFeePercent)}</p>
      </div>
      <aside className="h-fit overflow-hidden rounded-3xl border border-border bg-white md:sticky md:top-24">
        {room.images[0] && (
          <div className="relative aspect-video bg-border">
            <Image src={room.images[0]} alt={room.name} fill sizes="360px" className="object-cover" />
          </div>
        )}
        <div className="space-y-1 p-5 text-sm">
          <p className="font-display text-lg font-semibold">{room.hotel.name}</p>
          <p className="text-muted">{room.hotel.address}, {room.hotel.city}</p>
          {room.highlights.length > 0 && <p className="pt-1 text-xs font-semibold text-sun">{room.highlights.join(" · ")}</p>}
        </div>
      </aside>
    </div>
  );
}

export default function AssistantConfirmPage(props: PageProps<"/assistant/confirm">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-border" />}>
        <Confirm searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
