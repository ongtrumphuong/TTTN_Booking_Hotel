"use client";

import { useState, useTransition } from "react";
import { markNoShowAction } from "@/app/actions/admin";

/** Báo khách không đến nhận phòng. `confirmText` do server tính (nêu phí giữ lại, số hoàn) để người bấm biết trước hậu quả. */
export function NoShowButton({ bookingId, confirmText }: { bookingId: string; confirmText: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(confirmText)) start(async () => setError((await markNoShowAction(bookingId)).error));
        }}
        className="rounded-lg border border-orange-500 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
      >
        {pending ? "..." : "Khách không đến"}
      </button>
      {error && <p role="alert" className="max-w-56 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
