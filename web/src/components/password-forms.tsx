"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, resetPasswordAction, type FormState } from "@/app/actions/auth";

const inputCls =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const btnCls = "w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60";

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs font-medium text-red-600">{msg}</p> : null;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordResetAction, {});
  if (state.done) {
    return (
      <div role="status" className="space-y-4 text-sm">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          Nếu email <b>{state.email}</b> đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 60 phút.
        </p>
        <Link href="/login" className="font-semibold text-brand hover:underline">← Quay lại đăng nhập</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Email đã đăng ký</label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email} className={inputCls} />
        <Err msg={state.fieldErrors?.email} />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>{pending ? "Đang gửi..." : "Gửi liên kết đặt lại"}</button>
      <p className="text-center text-sm"><Link href="/login" className="font-semibold text-brand hover:underline">← Quay lại đăng nhập</Link></p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  if (state.done) {
    return (
      <div role="status" className="space-y-4 text-sm">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
        <Link href="/login" className="inline-block rounded-xl bg-brand px-5 py-2.5 font-bold text-white hover:bg-brand-dark">Đăng nhập</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error} <Link href="/forgot-password" className="underline">Yêu cầu liên kết mới</Link>
        </div>
      )}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Mật khẩu mới</label>
        <input id="password" name="password" type="password" required autoComplete="new-password" className={inputCls} />
        <p className="mt-1 text-xs text-muted">Tối thiểu 8 ký tự, gồm chữ và số</p>
        <Err msg={state.fieldErrors?.password} />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">Nhập lại mật khẩu</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputCls} />
        <Err msg={state.fieldErrors?.confirm} />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>{pending ? "Đang lưu..." : "Đặt lại mật khẩu"}</button>
    </form>
  );
}
