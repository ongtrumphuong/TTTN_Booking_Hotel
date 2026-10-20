"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, registerAction, type FormState } from "@/app/actions/auth";
import { resetFavorites } from "@/lib/favorites-store";

type Mode = "login" | "register";

const inputCls =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function Field({
  label,
  name,
  type = "text",
  error,
  defaultValue,
  autoComplete,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
        className={`${inputCls} ${error ? "border-red-500" : ""}`}
      />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${name}-err`} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode, callbackUrl, partner = false }: { mode: Mode; callbackUrl: string; partner?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    mode === "login" ? loginAction : registerAction,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const isLogin = mode === "login";
  const qs = callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";

  return (
    <form action={action} onSubmit={() => resetFavorites()} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {partner && <input type="hidden" name="partner" value="1" />}

      {state.error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </div>
      )}

      {!isLogin && <Field label="Họ và tên" name="name" autoComplete="name" error={fe.name} />}
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} error={fe.email} />
      {!isLogin && (
        <Field
          label="Số điện thoại"
          name="phone"
          type="tel"
          autoComplete="tel"
          required={false}
          error={fe.phone}
          hint="Không bắt buộc, ví dụ 0912345678"
        />
      )}
      <Field
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete={isLogin ? "current-password" : "new-password"}
        error={fe.password}
        hint={isLogin ? undefined : "Tối thiểu 8 ký tự, gồm chữ và số"}
      />
      {isLogin && (
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand hover:underline">Quên mật khẩu?</Link>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-sun px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sun/25 transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Đang xử lý..." : isLogin ? "Đăng nhập" : partner ? "Tạo tài khoản đối tác" : "Tạo tài khoản"}
      </button>

      <p className="text-center text-sm text-muted">
        {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
        <Link href={`${isLogin ? "/register" : "/login"}${qs}`} className="font-semibold text-brand hover:underline">
          {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
        </Link>
      </p>
    </form>
  );
}
