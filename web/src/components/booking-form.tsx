"use client";

import { useActionState, useState } from "react";
import { createBookingAction, type BookingState } from "@/app/actions/booking";
import { formatVND } from "@/lib/format";

type Props = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  pricePerNight: number;
  maxRooms: number;
};

export function BookingForm({ roomId, checkIn, checkOut, guests, nights, pricePerNight, maxRooms }: Props) {
  const [state, action, pending] = useActionState<BookingState, FormData>(createBookingAction, {});
  const [rooms, setRooms] = useState(1);

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
          onChange={(e) => setRooms(Number(e.target.value))}
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

      <div className="flex items-center justify-between rounded-xl bg-brand/5 px-4 py-3">
        <span className="text-sm text-muted">Tổng ({nights} đêm × {rooms} phòng)</span>
        <span className="text-xl font-extrabold text-brand">{formatVND(pricePerNight * nights * rooms)}</span>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Đang giữ phòng..." : "Tiếp tục thanh toán"}
      </button>
    </form>
  );
}
