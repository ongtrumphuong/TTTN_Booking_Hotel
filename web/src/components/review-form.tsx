"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction, type ReviewState } from "@/app/actions/engage";

export function ReviewForm({ hotelId, initial }: { hotelId: string; initial?: { rating: number; comment: string } }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReviewAction.bind(null, hotelId), {});
  const [rating, setRating] = useState(initial?.rating ?? 0);

  return (
    <form action={action} className="space-y-3 rounded-3xl border border-border bg-white p-5">
      <h3 className="font-bold">{initial ? "Chỉnh sửa đánh giá của bạn" : "Viết đánh giá"}</h3>

      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{state.error}</div>}
      {state.ok && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">Cảm ơn bạn! Đánh giá đã được lưu.</div>}

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Chấm điểm</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" title={`${n} sao`}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" required />
              <Star size={28} aria-label={`${n} sao`} className={n <= rating ? "fill-accent text-accent" : "text-border"} />
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="comment" className="mb-1 block text-sm font-semibold">Nhận xét</label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          required
          minLength={10}
          maxLength={1000}
          defaultValue={initial?.comment}
          placeholder="Chia sẻ trải nghiệm của bạn về phòng, vị trí, nhân viên..."
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <button type="submit" disabled={pending} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60">
        {pending ? "Đang gửi..." : initial ? "Cập nhật đánh giá" : "Gửi đánh giá"}
      </button>
    </form>
  );
}
