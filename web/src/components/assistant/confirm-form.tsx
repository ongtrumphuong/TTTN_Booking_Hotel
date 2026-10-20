"use client";

import { useActionState } from "react";
import { confirmProposalAction, type ConfirmState } from "@/app/actions/assistant";

export function ConfirmForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(() => confirmProposalAction(token), {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-sun px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sun/25 transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Đang giữ phòng..." : "Giữ phòng và sang bước thanh toán"}
      </button>
      <p className="text-center text-xs text-muted">Phòng được giữ 30 phút. Bạn sẽ tự thanh toán ở bước tiếp theo.</p>
    </form>
  );
}
