"use client";

import { useState, useTransition } from "react";
import { checkInBookingAction } from "@/app/actions/admin";

/** Ghi nhận khách đã nhận phòng (thao tác của lễ tân). */
export function CheckInButton({ bookingId }: { bookingId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setError((await checkInBookingAction(bookingId)).error))}
        className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
      >
        {pending ? "..." : "Nhận phòng"}
      </button>
      {error && <p role="alert" className="max-w-56 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
