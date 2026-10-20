"use client";

import { useState, useTransition } from "react";
import { markRefundedAction } from "@/app/actions/admin";

/** Xác nhận quản trị viên đã hoàn tiền cho khách (thao tác tiền thật diễn ra ngoài hệ thống). */
export function RefundButton({ bookingId }: { bookingId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const note = window.prompt("Đã hoàn tiền cho khách? Nhập ghi chú (mã giao dịch hoàn, ngân hàng...) hoặc để trống rồi bấm OK:", "");
          if (note === null) return;
          start(async () => setError((await markRefundedAction(bookingId, note)).error));
        }}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? "..." : "Đã hoàn tiền"}
      </button>
      {error && <p role="alert" className="max-w-56 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
