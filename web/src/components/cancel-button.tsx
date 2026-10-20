"use client";

import { useState, useTransition } from "react";
import { cancelBookingAction } from "@/app/actions/booking";

/** `confirmText` do server tính từ chính sách hủy (có nêu số tiền hoàn/phí) để khách biết trước khi bấm. */
export function CancelButton({ bookingId, confirmText }: { bookingId: string; confirmText?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(confirmText ?? "Bạn chắc chắn muốn hủy đơn đặt phòng này?")) {
            start(async () => setError((await cancelBookingAction(bookingId)).error ?? ""));
          }
        }}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Đang hủy..." : "Hủy đặt phòng"}
      </button>
      {error && <span role="alert" className="text-sm font-medium text-red-600">{error}</span>}
    </>
  );
}
