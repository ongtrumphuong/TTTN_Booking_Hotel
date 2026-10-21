"use client";

import { useState, useTransition } from "react";
import { respondDisputeAction } from "@/app/actions/dispute";

/** Đối tác phản hồi khiếu nại (sửa lại được cho đến khi sàn quyết định). */
export function DisputeRespond({ disputeId, initial }: { disputeId: string; initial: string | null }) {
  const [open, setOpen] = useState(!initial);
  const [text, setText] = useState(initial ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-lg border border-brand px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/5">Sửa phản hồi</button>;
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await respondDisputeAction(disputeId, text);
          setError(r.error);
          if (r.ok) setOpen(false);
        });
      }}
    >
      <label htmlFor={`resp-${disputeId}`} className="block text-xs font-semibold text-muted">Phản hồi của khách sạn (sàn sẽ đọc để quyết định)</label>
      <textarea id={`resp-${disputeId}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand" placeholder="Trình bày sự việc từ phía khách sạn, kèm bằng chứng nếu có..." />
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-60">{pending ? "Đang gửi..." : "Gửi phản hồi"}</button>
    </form>
  );
}
