"use client";

import { useState } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { useToday } from "@/lib/use-today";

type Props = {
  cities: string[];
  defaults?: { city?: string; checkIn?: string; checkOut?: string; guests?: number };
  compact?: boolean;
};

export function SearchForm({ cities, defaults = {}, compact = false }: Props) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults.checkOut ?? "");

  const today = useToday();

  const fieldBase =
    "flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20";
  const label = "block text-[11px] font-semibold uppercase tracking-wide text-muted";
  const input = "w-full bg-transparent text-sm font-medium outline-none";

  return (
    <form
      action="/hotels"
      className={`grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 text-foreground shadow-xl shadow-brand/10 md:gap-3 ${
        compact ? "md:grid-cols-5" : "md:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]"
      }`}
    >
      <label className={`${fieldBase} col-span-2 md:col-span-1`}>
        <MapPin size={18} className="text-brand" aria-hidden />
        <span className="flex-1">
          <span className={label}>Điểm đến</span>
          <select name="city" defaultValue={defaults.city ?? ""} className={input}>
            <option value="">Tất cả điểm đến</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </span>
      </label>

      <label className={fieldBase}>
        <CalendarDays size={18} className="hidden text-brand sm:block" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={label}>Nhận phòng</span>
          <input
            type="date"
            name="checkIn"
            min={today || undefined}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (checkOut && e.target.value >= checkOut) setCheckOut("");
            }}
            className={input}
          />
        </span>
      </label>

      <label className={fieldBase}>
        <CalendarDays size={18} className="hidden text-brand sm:block" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={label}>Trả phòng</span>
          <input
            type="date"
            name="checkOut"
            min={checkIn || today || undefined}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={input}
          />
        </span>
      </label>

      <label className={`${fieldBase} col-span-2 md:col-span-1`}>
        <Users size={18} className="text-brand" aria-hidden />
        <span className="flex-1">
          <span className={label}>Số khách</span>
          <select name="guests" defaultValue={String(defaults.guests ?? 2)} className={input}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} khách</option>
            ))}
          </select>
        </span>
      </label>

      <button
        type="submit"
        className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-dark md:col-span-1"
      >
        <Search size={18} aria-hidden /> Tìm kiếm
      </button>
    </form>
  );
}
