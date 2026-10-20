"use client";

import { useTransition } from "react";
import { markAllReadAction } from "@/app/actions/notifications";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => markAllReadAction())} className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 disabled:opacity-60">
      {pending ? "Đang xử lý..." : "Đánh dấu đã đọc tất cả"}
    </button>
  );
}
