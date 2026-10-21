"use client";

import { useActionState } from "react";
import { createDisputeAction, type DisputeState } from "@/app/actions/dispute";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/dispute";

/** Form gửi khiếu nại của khách (nằm trong khung thu gọn ở trang chi tiết đơn). */
export function DisputeForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState<DisputeState, FormData>(createDisputeAction.bind(null, bookingId), {});
  const field = "w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-brand";
  return (
    <form action={action} className="space-y-3">
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{state.error}</div>}
      <div>
        <label htmlFor="category" className="mb-1.5 block text-sm font-semibold">Loại vấn đề</label>
        <select id="category" name="category" required defaultValue="" className={field}>
          <option value="" disabled>Chọn loại vấn đề</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-semibold">Mô tả chi tiết</label>
        <textarea id="description" name="description" rows={4} required minLength={20} maxLength={2000} className={field} placeholder="Ví dụ: phòng không có ban công như trong ảnh, điều hòa không hoạt động, bị thu thêm phí không báo trước..." />
      </div>
      <button type="submit" disabled={pending} className="rounded-xl bg-sun px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Đang gửi..." : "Gửi khiếu nại"}
      </button>
    </form>
  );
}
