import Link from "next/link";
import { DisputeRefundButton } from "@/components/admin/dispute-refund-button";
import { DisputeResolve } from "@/components/admin/dispute-resolve";
import { DisputeRespond } from "@/components/admin/dispute-respond";
import { CATEGORY_LABEL, DISPUTE_STATUS, isFinal, type DisputeStatusKey } from "@/lib/dispute";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

type SP = Record<string, string | string[] | undefined>;

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "open", label: "Chờ xử lý" },
  { value: "done", label: "Đã xử lý" },
];

/**
 * Danh sách khiếu nại dùng chung. Đối tác chỉ thấy khiếu nại của khách sạn mình và phản hồi được;
 * quản trị viên thấy mọi khiếu nại, quyết định hoàn tiền/bác bỏ và xác nhận đã hoàn tiền.
 */
export async function DisputesView({ searchParams, user }: { searchParams: Promise<SP>; user: Pick<SessionUser, "id" | "role"> }) {
  const isAdmin = user.role === "ADMIN";
  const base = isAdmin ? "/admin" : "/host";
  const sp = await searchParams;
  const raw = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const show = FILTERS.find((f) => f.value === raw)?.value ?? "all";
  const scope = isAdmin ? {} : { hotel: { ownerId: user.id } };

  const [items, openCount] = await Promise.all([
    prisma.dispute.findMany({
      where: { ...scope, ...(show === "open" ? { status: { in: ["OPEN", "UNDER_REVIEW"] as DisputeStatusKey[] } } : show === "done" ? { status: { in: ["RESOLVED", "REJECTED"] as DisputeStatusKey[] } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        hotel: { select: { name: true, ownerId: true } },
        booking: { select: { code: true, totalPrice: true, checkIn: true, checkOut: true, room: { select: { name: true } } } },
      },
    }),
    prisma.dispute.count({ where: { ...scope, status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);

  return (
    <>
      <h1 className="font-display mb-1 text-3xl font-semibold">Khiếu nại</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        {isAdmin
          ? "Sàn đứng giữa khách và khách sạn: đối tác phản hồi, sàn xem xét rồi quyết định hoàn tiền hoặc bác bỏ. Phần đối tác chịu được trừ vào đợt chi trả kế tiếp."
          : "Khách gửi khiếu nại sau khi lưu trú. Hãy phản hồi sớm và rõ ràng; sàn sẽ dựa vào đó để quyết định. Nếu sàn chấp nhận và bạn phải chịu một phần, khoản đó được trừ vào đợt chi trả kế tiếp."}
      </p>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link key={f.value} href={f.value === "all" ? `${base}/disputes` : `${base}/disputes?show=${f.value}`} className={`rounded-full border px-3 py-1.5 font-medium ${show === f.value ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>
            {f.label}{f.value === "open" && openCount > 0 && ` (${openCount})`}
          </Link>
        ))}
      </div>

      <ul className="space-y-3">
        {items.length === 0 && <li className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted">Không có khiếu nại nào.</li>}
        {items.map((d) => {
          const st = DISPUTE_STATUS[d.status];
          return (
            <li key={d.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm"><b>{d.hotel.name}</b> · đơn <span className="font-mono text-xs font-semibold">{d.booking.code}</span></p>
                  <p className="text-xs text-muted">{d.user.name}{isAdmin ? ` (${d.user.email})` : ""} · {d.booking.room.name} · {formatDate(d.booking.checkIn)} → {formatDate(d.booking.checkOut)} · {formatVND(d.booking.totalPrice)} · gửi {formatDateTime(d.createdAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.text}</span>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[d.category]}</p>
              <p className="mt-1 whitespace-pre-line break-words text-sm">{d.description}</p>

              {d.hostResponse && (
                <div className="mt-3 rounded-2xl bg-brand/5 p-3 text-sm">
                  <p className="font-semibold text-brand">Phản hồi của khách sạn{d.hostRespondedAt ? ` · ${formatDateTime(d.hostRespondedAt)}` : ""}</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-muted">{d.hostResponse}</p>
                </div>
              )}
              {!isAdmin && !isFinal(d.status) && <DisputeRespond disputeId={d.id} initial={d.hostResponse} />}

              {isFinal(d.status) && (
                <div className={`mt-3 rounded-2xl p-3 text-sm ${d.status === "RESOLVED" ? "bg-emerald-50" : "bg-slate-100"}`}>
                  <p className="font-semibold">Quyết định của sàn{d.resolvedAt ? ` · ${formatDateTime(d.resolvedAt)}` : ""}</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-muted">{d.resolution}</p>
                  {d.status === "RESOLVED" && (
                    <p className="mt-1 font-semibold text-emerald-800">
                      Hoàn khách {formatVND(d.refundAmount)}: đối tác chịu {formatVND(d.partnerBearsAmount)}, sàn chịu {formatVND(d.refundAmount - d.partnerBearsAmount)}
                      {d.partnerBearsAmount > 0 ? (d.payoutId ? " · đã trừ vào đợt chi trả" : " · chờ trừ vào đợt chi trả kế tiếp") : ""}
                    </p>
                  )}
                  {isAdmin && d.status === "RESOLVED" && d.refundAmount > 0 && (d.refundedAt ? <p className="mt-1 text-xs text-muted">Đã hoàn tiền cho khách ngày {formatDate(d.refundedAt)}.</p> : <DisputeRefundButton disputeId={d.id} />)}
                </div>
              )}
              {isAdmin && !isFinal(d.status) && <DisputeResolve disputeId={d.id} totalPrice={d.booking.totalPrice} hasOwner={!!d.hotel.ownerId} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
