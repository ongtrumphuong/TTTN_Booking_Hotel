import { Suspense } from "react";
import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/account-forms";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Tài khoản của tôi", robots: NOINDEX };

async function Profile() {
  const session = await requireUser("/account");
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { bookings: true } } },
  });
  if (!user) await requireUser("/account");

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-white p-6">
        <h1 className="font-display text-3xl font-semibold">Xin chào, {user!.name}</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Email đăng nhập</dt><dd className="font-semibold">{user!.email}</dd></div>
          <div><dt className="text-muted">Vai trò</dt><dd className="font-semibold">{user!.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}</dd></div>
          <div><dt className="text-muted">Số lượt đặt phòng</dt><dd className="font-semibold">{user!._count.bookings}</dd></div>
        </dl>
      </div>
      <section className="rounded-3xl border border-border bg-white p-6">
        <h2 className="font-display mb-4 text-xl font-semibold">Thông tin cá nhân</h2>
        <ProfileForm name={user!.name} phone={user!.phone ?? ""} />
      </section>
      <section className="rounded-3xl border border-border bg-white p-6">
        <h2 className="font-display mb-4 text-xl font-semibold">Đổi mật khẩu</h2>
        <PasswordForm />
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-border" />}>
        <Profile />
      </Suspense>
    </div>
  );
}
