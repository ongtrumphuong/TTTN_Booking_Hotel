"use client";

import { useTransition } from "react";
import { toggleHotelAction, toggleRoomAction } from "@/app/actions/admin";

export function ToggleButton({ kind, id, active }: { kind: "hotel" | "room"; id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault(); // nút nằm trong <summary>: không mở/đóng phần chi tiết
        start(() => (kind === "hotel" ? toggleHotelAction(id) : toggleRoomAction(id)));
      }}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-60 ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
    >
      {active ? "Đang hiển thị" : "Đã ẩn"}
    </button>
  );
}
