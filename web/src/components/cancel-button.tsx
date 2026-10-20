"use client";

import { useTransition } from "react";
import { cancelBookingAction } from "@/app/actions/booking";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Bạn chắc chắn muốn hủy đơn đặt phòng này?")) start(() => cancelBookingAction(bookingId));
      }}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Đang hủy..." : "Hủy đặt phòng"}
    </button>
  );
}
