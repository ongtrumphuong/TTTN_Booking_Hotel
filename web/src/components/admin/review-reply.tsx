"use client";

import { useState, useTransition } from "react";
import { replyReviewAction } from "@/app/actions/admin";

/** Ô phản hồi công khai dưới đánh giá của khách. Lưu trống để gỡ phản hồi. */
export function ReviewReply({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-lg border border-brand px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/5">
        {initial ? "Sửa phản hồi" : "Phản hồi"}
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await replyReviewAction(reviewId, text);
          setMsg(r);
          if (r.ok) setOpen(false);
        });
      }}
    >
      <label htmlFor={`reply-${reviewId}`} className="block text-xs font-semibold text-muted">Phản hồi công khai (hiện dưới đánh giá ở trang khách sạn)</label>
      <textarea
        id={`reply-${reviewId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Cảm ơn quý khách đã lưu trú..."
        className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {msg.error && <p role="alert" className="text-xs font-medium text-red-600">{msg.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu phản hồi"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:bg-background">Hủy</button>
      </div>
    </form>
  );
}
