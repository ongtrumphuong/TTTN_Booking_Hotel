import { DisputeForm } from "@/components/dispute-form";
import { CATEGORY_LABEL, DISPUTE_STATUS, DISPUTE_WINDOW_DAYS, canDispute, isNoShowWithFee } from "@/lib/dispute";
import { todayUTC } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import type { Dispute } from "@prisma/client";

type Props = { booking: { id: string; status: string; paymentStatus: string; checkIn: Date; checkOut: Date; noShow?: boolean; totalPrice?: number; refundAmount?: number | null }; dispute: Dispute | null };

/** Mục "Khiếu nại" ở chi tiết đơn của khách: hiện tiến trình nếu đã gửi, hoặc form nếu đủ điều kiện. */
export function DisputeSection({ booking, dispute }: Props) {
  if (dispute) {
    const st = DISPUTE_STATUS[dispute.status];
    return (
      <section className="mt-6 rounded-3xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Khiếu nại của bạn</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.text}</span>
        </div>
        <p className="mt-1 text-xs text-muted">Gửi ngày {formatDate(dispute.createdAt)} · {CATEGORY_LABEL[dispute.category]}</p>
        <p className="mt-3 whitespace-pre-line break-words text-sm">{dispute.description}</p>
        {dispute.hostResponse && (
          <div className="mt-3 rounded-2xl bg-brand/5 p-3 text-sm">
            <p className="font-semibold text-brand">Phản hồi của khách sạn</p>
            <p className="mt-0.5 whitespace-pre-line break-words text-muted">{dispute.hostResponse}</p>
          </div>
        )}
        {dispute.resolution && (
          <div className={`mt-3 rounded-2xl p-3 text-sm ${dispute.status === "RESOLVED" ? "bg-emerald-50" : "bg-slate-100"}`}>
            <p className="font-semibold">Quyết định của sàn</p>
            <p className="mt-0.5 whitespace-pre-line break-words text-muted">{dispute.resolution}</p>
            {dispute.status === "RESOLVED" && (
              <p className="mt-1 font-semibold text-emerald-800">
                Hoàn cho bạn {formatVND(dispute.refundAmount)} {dispute.refundedAt ? `(đã hoàn ngày ${formatDate(dispute.refundedAt)})` : "(đang chờ hoàn tiền về phương thức bạn đã thanh toán)"}
              </p>
            )}
          </div>
        )}
      </section>
    );
  }
  const eligible = canDispute(booking, todayUTC(), false);
  if (!eligible.ok) return null;
  return (
    <section className="mt-6 rounded-3xl border border-border bg-white p-6">
      <details>
        <summary className="cursor-pointer font-display text-xl font-semibold">{isNoShowWithFee(booking) ? "Bạn đã đến nhưng bị ghi là không đến?" : "Gặp vấn đề với kỳ lưu trú?"}</summary>
        <p className="mb-4 mt-2 text-sm text-muted">
          {isNoShowWithFee(booking) ? "Hãy mô tả bạn đã đến nhận phòng lúc nào, ở quầy nào, và đính kèm bằng chứng nếu có; sàn sẽ làm việc với khách sạn và có thể hoàn lại phí đã bị giữ. " : "Gửi khiếu nại để sàn làm việc với khách sạn. "}Bạn có thể gửi đến {DISPUTE_WINDOW_DAYS} ngày sau ngày trả phòng; mỗi đơn một khiếu nại.
        </p>
        <DisputeForm bookingId={booking.id} />
      </details>
    </section>
  );
}
