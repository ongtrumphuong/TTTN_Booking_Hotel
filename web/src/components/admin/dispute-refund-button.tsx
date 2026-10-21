"use client";

import { useState, useTransition } from "react";
import { markDisputeRefundedAction } from "@/app/actions/dispute";

/** Quản trị viên xác nhận đã hoàn tiền cho khách (hoàn ngoài hệ thống). */
export function DisputeRefundButton({ disputeId }: { disputeId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Xác nhận bạn đã hoàn tiền cho khách?")) start(async () => setError((await markDisputeRefundedAction(disputeId)).error));
        }}
        className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
      >
        {pending ? "Đang lưu..." : "Đã hoàn tiền cho khách"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
