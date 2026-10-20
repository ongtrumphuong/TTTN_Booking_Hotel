"use client";

import { useState } from "react";
import { useToday } from "@/lib/use-today";

export function StayBar({ defaults }: { defaults: { checkIn?: string; checkOut?: string; guests: number } }) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults.checkOut ?? "");
  const today = useToday();

  const box = "rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:border-brand";
  const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

  return (
    <form className="flex flex-wrap items-end gap-3 rounded-3xl border border-border bg-white p-4">
      <label>
        <span className={lbl}>Nhận phòng</span>
        <input
          type="date"
          name="checkIn"
          required
          min={today || undefined}
          value={checkIn}
          onChange={(e) => {
            setCheckIn(e.target.value);
            if (checkOut && e.target.value >= checkOut) setCheckOut("");
          }}
          className={box}
        />
      </label>
      <label>
        <span className={lbl}>Trả phòng</span>
        <input
          type="date"
          name="checkOut"
          required
          min={checkIn || today || undefined}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className={box}
        />
      </label>
      <label>
        <span className={lbl}>Số khách</span>
        <select name="guests" defaultValue={String(defaults.guests)} className={box}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>{n} khách</option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
        Kiểm tra phòng trống
      </button>
    </form>
  );
}
