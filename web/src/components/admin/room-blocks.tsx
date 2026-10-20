"use client";

import { useActionState, useTransition } from "react";
import { createRoomBlockAction, deleteRoomBlockAction, type AdminState } from "@/app/actions/admin";

type Block = { id: string; start: string; end: string; rooms: number; reason: string | null };

const input = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1 block text-xs font-semibold text-muted";

const fmt = (iso: string) => iso.split("-").reverse().join("/");

function DeleteBlock({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Bỏ chặn khoảng ngày này? Phòng sẽ được bán lại.")) start(() => deleteRoomBlockAction(id));
      }}
      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
    >
      {pending ? "Đang bỏ..." : "Bỏ chặn"}
    </button>
  );
}

/** Lịch chặn phòng: đóng một số phòng trong khoảng ngày (bảo trì, sự kiện nội bộ, ngày không bán). Không hủy đơn đã có. */
export function RoomBlocks({ roomId, quantity, blocks }: { roomId: string; quantity: number; blocks: Block[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(createRoomBlockAction.bind(null, roomId), {});
  const key = state.ok ? "done" : "form";

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="mb-2 text-sm font-bold">Chặn phòng / ngày không bán</h4>
      {blocks.length === 0 ? (
        <p className="mb-3 text-xs text-muted">Chưa có lịch chặn nào. Đơn đã đặt trước không bị ảnh hưởng.</p>
      ) : (
        <ul className="mb-3 space-y-1.5 text-sm">
          {blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
              <span>
                <b>{fmt(b.start)}</b> → <b>{fmt(b.end)}</b> · chặn {b.rooms} phòng{b.reason ? ` · ${b.reason}` : ""}
              </span>
              <DeleteBlock id={b.id} />
            </li>
          ))}
        </ul>
      )}
      <form key={key} action={action} className="grid gap-3 sm:grid-cols-4">
        {state.error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-4">{state.error}</div>}
        {state.ok && <div role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:col-span-4">Đã thêm lịch chặn.</div>}
        <div>
          <label className={label}>Từ ngày</label>
          <input name="startDate" type="date" required className={input} />
        </div>
        <div>
          <label className={label}>Đến hết ngày</label>
          <input name="endDate" type="date" required className={input} />
        </div>
        <div>
          <label className={label}>Số phòng chặn</label>
          <input name="rooms" type="number" min={1} max={quantity} defaultValue={quantity} required className={input} />
        </div>
        <div>
          <label className={label}>Lý do (không bắt buộc)</label>
          <input name="reason" maxLength={120} placeholder="Bảo trì" className={input} />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" disabled={pending} className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 disabled:opacity-60">
            {pending ? "Đang thêm..." : "Thêm lịch chặn"}
          </button>
        </div>
      </form>
    </div>
  );
}
