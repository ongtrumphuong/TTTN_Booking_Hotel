"use client";

import { useState, useTransition } from "react";
import { rescheduleBookingAction } from "@/app/actions/booking";

/** Khách đổi ngày ở: chọn ngày mới, máy chủ kiểm tra luật đổi ngày, phòng trống và giá. */
export function RescheduleForm({ bookingId, checkIn, checkOut, min }: { bookingId: string; checkIn: string; checkOut: string; min: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(checkIn);
  const [to, setTo] = useState(checkOut);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) return <p role="status" className="text-sm font-semibold text-emerald-700">Đã đổi ngày ở thành công.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/5">
        Đổi ngày ở
      </button>
    );
  }
  return (
    <form
      className="w-full rounded-2xl border border-border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await rescheduleBookingAction(bookingId, from, to);
          if (res.ok) setDone(true);
          else setError(res.error ?? "Không đổi được ngày.");
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          <span className="text-muted">Nhận phòng mới</span>
          <input type="date" required min={min} value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-white px-3 py-1.5" />
        </label>
        <label className="grid gap-1">
          <span className="text-muted">Trả phòng mới</span>
          <input type="date" required min={from || min} value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-white px-3 py-1.5" />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg bg-sun px-4 py-2 font-bold text-white disabled:opacity-60">
          {pending ? "Đang đổi..." : "Xác nhận đổi ngày"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 font-semibold text-muted hover:bg-white">Thôi</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </form>
  );
}
