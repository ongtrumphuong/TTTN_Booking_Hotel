"use client";

import { useActionState, useTransition } from "react";
import { createVoucherAction, toggleVoucherAction, type AdminState } from "@/app/actions/admin";

const input = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1 block text-xs font-semibold text-muted";

export function VoucherForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createVoucherAction, {});
  const key = state.ok ? "done" : "form";
  return (
    <form key={key} action={action} className="grid gap-3 rounded-3xl border border-border bg-white p-5 sm:grid-cols-3">
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-3">{state.error}</div>}
      {state.ok && <div role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:col-span-3">Đã tạo mã giảm giá.</div>}
      <div>
        <label className={label}>Mã</label>
        <input name="code" required maxLength={20} placeholder="HE2027" className={`${input} uppercase`} />
      </div>
      <div>
        <label className={label}>Loại giảm</label>
        <select name="kind" defaultValue="PERCENT" className={input}>
          <option value="PERCENT">Theo phần trăm (%)</option>
          <option value="AMOUNT">Số tiền cố định (₫)</option>
        </select>
      </div>
      <div>
        <label className={label}>Mức giảm</label>
        <input name="value" type="number" min={1} required className={input} />
      </div>
      <div>
        <label className={label}>Giảm tối đa (₫, cho loại %)</label>
        <input name="maxDiscount" type="number" min={1000} step={1000} className={input} />
      </div>
      <div>
        <label className={label}>Đơn tối thiểu (₫)</label>
        <input name="minSubtotal" type="number" min={0} step={1000} defaultValue={0} className={input} />
      </div>
      <div>
        <label className={label}>Tổng lượt dùng (trống = không giới hạn)</label>
        <input name="usageLimit" type="number" min={1} className={input} />
      </div>
      <div>
        <label className={label}>Lượt dùng mỗi khách</label>
        <input name="perUserLimit" type="number" min={1} max={100} defaultValue={1} className={input} />
      </div>
      <div>
        <label className={label}>Bắt đầu (không bắt buộc)</label>
        <input name="startsAt" type="date" className={input} />
      </div>
      <div>
        <label className={label}>Hết hạn hết ngày (không bắt buộc)</label>
        <input name="endsAt" type="date" className={input} />
      </div>
      <div className="sm:col-span-3">
        <label className={label}>Mô tả</label>
        <input name="description" maxLength={120} placeholder="Ưu đãi mùa hè" className={input} />
      </div>
      <div className="sm:col-span-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60">
          {pending ? "Đang tạo..." : "Tạo mã giảm giá"}
        </button>
      </div>
    </form>
  );
}

export function VoucherToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleVoucherAction(id))}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-60 ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
    >
      {active ? "Đang bật" : "Đã tắt"}
    </button>
  );
}
