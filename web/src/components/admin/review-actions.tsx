"use client";

import { useState, useTransition } from "react";
import { deleteReviewAction, toggleReviewHiddenAction } from "@/app/actions/admin";

export function ReviewActions({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60";
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setError((await toggleReviewHiddenAction(reviewId)).error))}
          className={`${btn} border-border hover:border-brand`}
        >
          {hidden ? "Hiện lại" : "Ẩn"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Xóa vĩnh viễn đánh giá này? Khách có thể viết lại đánh giá mới.")) {
              start(async () => setError((await deleteReviewAction(reviewId)).error));
            }
          }}
          className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}
        >
          Xóa
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
