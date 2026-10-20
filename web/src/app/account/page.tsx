import { Suspense } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tài khoản của tôi" };

async function Profile() {
  const session = await requireUser("/account");
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { bookings: true } } },
  });
  if (!user) await requireUser("/account");

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <h1 className="text-2xl font-extrabold">Xin chào, {user!.name}</h1>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Email</dt><dd className="font-semibold">{user!.email}</dd></div>
        <div><dt className="text-muted">Số điện thoại</dt><dd className="font-semibold">{user!.phone ?? "Chưa cập nhật"}</dd></div>
        <div><dt className="text-muted">Vai trò</dt><dd className="font-semibold">{user!.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}</dd></div>
        <div><dt className="text-muted">Số lượt đặt phòng</dt><dd className="font-semibold">{user!._count.bookings}</dd></div>
      </dl>
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
