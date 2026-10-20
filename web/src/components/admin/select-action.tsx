"use client";

import { useState, useTransition } from "react";
import { updateBookingStatusAction, updateUserRoleAction } from "@/app/actions/admin";
import type { AdminState } from "@/app/actions/admin";

type Option = { value: string; label: string };

type Target = { kind: "booking-status" | "user-role"; id: string };

function run(target: Target, value: string): Promise<AdminState> {
  return target.kind === "booking-status"
    ? updateBookingStatusAction(target.id, value as Parameters<typeof updateBookingStatusAction>[1])
    : updateUserRoleAction(target.id, value as Parameters<typeof updateUserRoleAction>[1]);
}

/** Menu chọn giá trị mới, gọi server action khi bấm áp dụng và hiện lỗi nếu có. Chỉ nhận dữ liệu thuần từ Server Component. */
export function SelectAction({
  target,
  options,
  confirmMessages,
}: {
  target: Target;
  options: Option[];
  /** Thông điệp hỏi lại theo giá trị được chọn. */
  confirmMessages?: Record<string, string>;
}) {
  const [value, setValue] = useState(options[0]?.value ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (options.length === 0) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <select
          aria-label="Chọn giá trị mới"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-medium"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const msg = confirmMessages?.[value];
            if (msg && !confirm(msg)) return;
            start(async () => setError((await run(target, value)).error));
          }}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "..." : "Áp dụng"}
        </button>
      </div>
      {error && <p role="alert" className="max-w-56 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
