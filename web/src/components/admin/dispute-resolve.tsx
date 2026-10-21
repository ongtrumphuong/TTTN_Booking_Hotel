"use client";

import { useState, useTransition } from "react";
import { resolveDisputeAction } from "@/app/actions/dispute";
import { formatVND } from "@/lib/format";

/** Sàn quyết định khiếu nại: hoàn tiền (chia phần đối tác chịu và phần sàn chịu) hoặc bác bỏ. */
export function DisputeResolve({ disputeId, totalPrice, hasOwner }: { disputeId: string; totalPrice: number; hasOwner: boolean }) {
  const [decision, setDecision] = useState<"REFUND" | "REJECT">("REFUND");
  const [refund, setRefund] = useState("");
  const [bears, setBears] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const field = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand";
  const refundNum = Number(refund) || 0;
  const bearsNum = Number(bears) || 0;

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(decision === "REFUND" ? `Xác nhận hoàn ${formatVND(refundNum)} cho khách (đối tác chịu ${formatVND(bearsNum)})?` : "Xác nhận bác bỏ khiếu nại này?")) return;
        start(async () => setError((await resolveDisputeAction(disputeId, { decision, refund: refundNum, partnerBears: hasOwner ? bearsNum : 0, note })).error));
      }}
    >
      <p className="text-sm font-bold">Quyết định của sàn</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" checked={decision === "REFUND"} onChange={() => setDecision("REFUND")} /> Chấp nhận, hoàn tiền</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={decision === "REJECT"} onChange={() => setDecision("REJECT")} /> Bác bỏ</label>
      </div>
      {decision === "REFUND" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Số tiền hoàn cho khách (₫, tối đa {formatVND(totalPrice)})</label>
            <input type="number" min={1} max={totalPrice} value={refund} onChange={(e) => { setRefund(e.target.value); if (hasOwner) setBears(e.target.value); }} className={field} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Phần đối tác chịu (₫) {hasOwner ? "" : "(khách sạn của sàn: sàn chịu hết)"}</label>
            <input type="number" min={0} max={refundNum} value={hasOwner ? bears : "0"} disabled={!hasOwner} onChange={(e) => setBears(e.target.value)} className={field} />
            {hasOwner && refundNum > 0 && <p className="mt-1 text-xs text-muted">Sàn chịu {formatVND(Math.max(0, refundNum - bearsNum))}. Phần đối tác chịu được trừ vào đợt chi trả kế tiếp.</p>}
          </div>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">Lý do quyết định (khách và đối tác đều đọc được)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} required className={field} />
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60">{pending ? "Đang lưu..." : "Lưu quyết định"}</button>
    </form>
  );
}
