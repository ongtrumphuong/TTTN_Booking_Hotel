"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction, type FormState } from "@/app/actions/auth";

const inputCls =
  "w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const btnCls = "rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60";

function Field({ label, name, type = "text", defaultValue, autoComplete, error, hint, required = true }: {
  label: string; name: string; type?: string; defaultValue?: string; autoComplete?: string; error?: string; hint?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input id={name} name={name} type={type} required={required} defaultValue={defaultValue} autoComplete={autoComplete} aria-invalid={!!error} className={`${inputCls} ${error ? "border-red-500" : ""}`} />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.done && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Đã lưu thông tin. Tên hiển thị trên thanh menu sẽ cập nhật ở lần đăng nhập sau.</div>}
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ và tên" name="name" defaultValue={state.values?.name ?? name} autoComplete="name" error={fe.name} />
        <Field label="Số điện thoại" name="phone" type="tel" defaultValue={state.values?.phone ?? phone} autoComplete="tel" required={false} error={fe.phone} hint="Không bắt buộc, ví dụ 0912345678" />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Lưu thay đổi"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  const fe = state.fieldErrors ?? {};
  // Đổi key khi thành công để ô nhập tự xóa.
  return (
    <form key={state.done ? "done" : "form"} action={action} className="space-y-4">
      {state.done && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Đã đổi mật khẩu.</div>}
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>}
      <Field label="Mật khẩu hiện tại" name="current" type="password" autoComplete="current-password" error={fe.current} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mật khẩu mới" name="password" type="password" autoComplete="new-password" error={fe.password} hint="Tối thiểu 8 ký tự, gồm chữ và số" />
        <Field label="Nhập lại mật khẩu mới" name="confirm" type="password" autoComplete="new-password" error={fe.confirm} />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Đổi mật khẩu"}</button>
    </form>
  );
}
