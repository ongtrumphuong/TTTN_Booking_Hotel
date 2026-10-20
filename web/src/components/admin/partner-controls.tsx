"use client";

import { useState, useTransition } from "react";
import {
  approveHotelAction,
  assignOwnerAction,
  createPayoutAction,
  rejectHotelAction,
  setCommissionAction,
  type PartnerState,
} from "@/app/actions/partner";

const input = "rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function useRun() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<PartnerState>) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
    });
  return { error, pending, run };
}

const Err = ({ msg }: { msg?: string }) => (msg ? <p role="alert" className="max-w-64 text-xs font-medium text-red-600">{msg}</p> : null);

/** Duyệt hoặc từ chối khách sạn của đối tác (từ chối bắt buộc nêu lý do). */
export function ApprovalButtons({ hotelId }: { hotelId: string }) {
  const { error, pending, run } = useRun();
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveHotelAction(hotelId))}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Duyệt
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const reason = window.prompt("Lý do từ chối (đối tác sẽ thấy để chỉnh sửa):", "");
            if (reason === null) return;
            run(() => rejectHotelAction(hotelId, reason));
          }}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Từ chối
        </button>
      </div>
      <Err msg={error} />
    </div>
  );
}

/** Sửa hoa hồng (%) của khách sạn; chỉ ảnh hưởng đơn đặt sau này. */
export function CommissionEditor({ hotelId, percent }: { hotelId: string; percent: number }) {
  const [value, setValue] = useState(String(percent));
  const { error, pending, run } = useRun();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Hoa hồng (%)"
          type="number"
          min={0}
          max={50}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${input} w-20 py-1.5`}
        />
        <span className="text-sm text-muted">%</span>
        <button
          type="button"
          disabled={pending || value === String(percent)}
          onClick={() => run(() => setCommissionAction(hotelId, value))}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "..." : "Lưu"}
        </button>
      </div>
      <Err msg={error} />
    </div>
  );
}

/** Gán khách sạn cho đối tác theo email, hoặc để trống để chuyển về sàn tự vận hành. */
export function AssignOwnerForm({ hotels }: { hotels: { id: string; name: string }[] }) {
  const [hotelId, setHotelId] = useState(hotels[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const { error, pending, run } = useRun();
  if (hotels.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Khách sạn" value={hotelId} onChange={(e) => setHotelId(e.target.value)} className={`${input} min-w-56`}>
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <input
          aria-label="Email đối tác"
          type="email"
          placeholder="Email đối tác (trống = sàn tự vận hành)"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setDone(false);
          }}
          className={`${input} min-w-64 flex-1`}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await assignOwnerAction(hotelId, email);
              setDone(!r.error);
              return r;
            })
          }
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Đang lưu..." : "Gán"}
        </button>
      </div>
      {done && <p role="status" className="text-sm font-medium text-emerald-700">Đã cập nhật chủ sở hữu.</p>}
      <Err msg={error} />
    </div>
  );
}

/** Tạo đợt chi trả cho một đối tác (gộp mọi đơn chưa đối soát). */
export function PayoutButton({ ownerId, amountLabel, disabled }: { ownerId: string; amountLabel: string; disabled?: boolean }) {
  const { error, pending, run } = useRun();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          const note = window.prompt(`Tạo đợt chi trả ${amountLabel} cho đối tác này? Nhập ghi chú (mã chuyển khoản...) hoặc để trống rồi bấm OK:`, "");
          if (note === null) return;
          run(() => createPayoutAction(ownerId, note));
        }}
        className="rounded-lg bg-sun px-3.5 py-2 text-xs font-bold text-white shadow shadow-sun/30 hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "..." : "Tạo đợt chi trả"}
      </button>
      <Err msg={error} />
    </div>
  );
}
