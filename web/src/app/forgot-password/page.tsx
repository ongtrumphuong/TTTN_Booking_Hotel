import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-forms";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Quên mật khẩu", robots: NOINDEX };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold">Quên mật khẩu?</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Nhập email đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
