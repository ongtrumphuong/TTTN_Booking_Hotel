"use client";

import { useActionState, useTransition } from "react";
import { createPriceRuleAction, deletePriceRuleAction, type AdminState } from "@/app/actions/admin";
import { formatVND } from "@/lib/format";

type Rule = { id: string; name: string; start: string; end: string; percent: number };

const input = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1 block text-xs font-semibold text-muted";
const fmt = (iso: string) => iso.split("-").reverse().join("/");
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

function DeleteRule({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Xóa quy tắc giá này? Giá các ngày đó trở về giá gốc.")) start(() => deletePriceRuleAction(id));
      }}
      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
    >
      {pending ? "Đang xóa..." : "Xóa"}
    </button>
  );
}

/** Giá theo mùa và ngày lễ: cộng (+) hoặc giảm (-) phần trăm so với giá gốc trong khoảng ngày. Đơn đã đặt giữ nguyên giá cũ. */
export function PriceRules({ roomId, basePrice, rules }: { roomId: string; basePrice: number; rules: Rule[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(createPriceRuleAction.bind(null, roomId), {});
  const key = state.ok ? "done" : "form";

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="mb-1 text-sm font-bold">Giá theo mùa / ngày lễ</h4>
      <p className="mb-3 text-xs text-muted">Điều chỉnh theo % của giá gốc ({formatVND(basePrice)}). Nhiều quy tắc trùng ngày sẽ cộng dồn cùng phụ thu cuối tuần. Đơn đã đặt không bị đổi giá.</p>
      {rules.length > 0 && (
        <ul className="mb-3 space-y-1.5 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
              <span>
                <b>{r.name}</b>: {fmt(r.start)} → {fmt(r.end)} ·{" "}
                <b className={r.percent > 0 ? "text-sun" : "text-emerald-700"}>{signed(r.percent)}</b> ({formatVND(Math.round((basePrice * (100 + r.percent)) / 100))}/đêm)
              </span>
              <DeleteRule id={r.id} />
            </li>
          ))}
        </ul>
      )}
      <form key={key} action={action} className="grid gap-3 sm:grid-cols-4">
        {state.error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-4">{state.error}</div>}
        {state.ok && <div role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:col-span-4">Đã thêm quy tắc giá.</div>}
        <div>
          <label className={label}>Tên (mùa/lễ)</label>
          <input name="name" required maxLength={60} placeholder="Tết Dương lịch" className={input} />
        </div>
        <div>
          <label className={label}>Từ ngày</label>
          <input name="startDate" type="date" required className={input} />
        </div>
        <div>
          <label className={label}>Đến hết ngày</label>
          <input name="endDate" type="date" required className={input} />
        </div>
        <div>
          <label className={label}>Điều chỉnh (%)</label>
          <input name="percent" type="number" min={-50} max={200} step={1} required defaultValue={20} className={input} />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" disabled={pending} className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 disabled:opacity-60">
            {pending ? "Đang thêm..." : "Thêm quy tắc giá"}
          </button>
        </div>
      </form>
    </div>
  );
}
