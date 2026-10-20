"use client";

import { useActionState, useState, useTransition } from "react";
import { createBookingAction, previewVoucherAction, type BookingState, type VoucherPreview } from "@/app/actions/booking";
import { formatVND } from "@/lib/format";

type Props = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  /** Tiền một phòng cho cả kỳ lưu trú (đã gồm phụ thu cuối tuần/mùa cao điểm); máy chủ tính lại khi tạo đơn. */
  pricePerRoom: number;
  maxRooms: number;
};

export function BookingForm({ roomId, checkIn, checkOut, guests, nights, pricePerRoom, maxRooms }: Props) {
  const [state, action, pending] = useActionState<BookingState, FormData>(createBookingAction, {});
  const [rooms, setRooms] = useState(1);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<VoucherPreview | null>(null);
  const [checking, startCheck] = useTransition();
  const subtotal = pricePerRoom * rooms;
  const discount = preview?.discount ?? 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />

      {state.error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="rooms" className="mb-1.5 block text-sm font-semibold">Số phòng</label>
        <select
          id="rooms"
          name="rooms"
          value={rooms}
          onChange={(e) => {
            setRooms(Number(e.target.value));
            setPreview(null);
          }}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand"
        >
          {Array.from({ length: maxRooms }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} phòng</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="note" className="mb-1.5 block text-sm font-semibold">Yêu cầu đặc biệt (không bắt buộc)</label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand"
          placeholder="Ví dụ: nhận phòng sớm, tầng cao..."
        />
      </div>

      <div>
        <label htmlFor="voucher" className="mb-1.5 block text-sm font-semibold">Mã giảm giá (không bắt buộc)</label>
        <div className="flex gap-2">
          <input
            id="voucher"
            name="voucher"
            value={code}
            maxLength={40}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setPreview(null);
            }}
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm uppercase outline-none focus:border-brand"
            placeholder="Nhập mã"
          />
          <button
            type="button"
            disabled={checking || !code.trim()}
            onClick={() => startCheck(async () => setPreview(await previewVoucherAction(roomId, checkIn, checkOut, rooms, code)))}
            className="shrink-0 rounded-xl border border-brand px-4 text-sm font-bold text-brand hover:bg-brand/5 disabled:opacity-60"
          >
            {checking ? "Đang kiểm tra..." : "Áp dụng"}
          </button>
        </div>
        {preview?.error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{preview.error}</p>}
        {discount > 0 && <p role="status" className="mt-1 text-xs font-medium text-emerald-700">Đã áp dụng mã {preview?.code}: giảm {formatVND(discount)}.</p>}
      </div>

      <div className="space-y-1 rounded-xl bg-brand/5 px-4 py-3">
        {discount > 0 && (
          <div className="flex justify-between text-sm text-muted"><span>Tạm tính</span><span>{formatVND(subtotal)}</span></div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm text-emerald-700"><span>Giảm giá</span><span>-{formatVND(discount)}</span></div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Tổng ({nights} đêm × {rooms} phòng)</span>
          <span className="text-xl font-extrabold text-brand">{formatVND(subtotal - discount)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-sun px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sun/25 transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Đang giữ phòng..." : "Tiếp tục thanh toán"}
      </button>
    </form>
  );
}
