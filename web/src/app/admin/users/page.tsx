import { Suspense } from "react";
import { AdminFallback } from "@/components/admin/fallback";
import type { Metadata } from "next";
import { SelectAction } from "@/components/admin/select-action";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản lý người dùng" };

async function UsersList() {
  const admin = await requireAdmin("/admin/users");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { bookings: true } } },
  });

  return (
    <>
      <h1 className="font-display mb-6 text-3xl font-semibold">Người dùng <span className="text-base font-medium text-muted">({users.length})</span></h1>
      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Điện thoại</th>
              <th className="px-4 py-3">Đặt phòng</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Đổi vai trò</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3 font-semibold">{u.name}{u.id === admin.id && <span className="ml-1 text-xs font-medium text-muted">(bạn)</span>}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.phone ?? "—"}</td>
                <td className="px-4 py-3">{u._count.bookings}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${u.role === "ADMIN" ? "bg-brand/10 text-brand" : u.role === "HOST" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>
                    {u.role === "ADMIN" ? "Quản trị viên" : u.role === "HOST" ? "Đối tác" : "Khách hàng"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.id === admin.id ? (
                    <span className="text-xs text-muted">Không thể đổi chính mình</span>
                  ) : (
                    <SelectAction
                      target={{ kind: "user-role", id: u.id }}
                      options={
                        u.role === "USER"
                          ? [{ value: "ADMIN", label: "Quản trị viên" }, { value: "HOST", label: "Đối tác" }]
                          : [{ value: "USER", label: "Khách hàng" }]
                      }
                      confirmMessages={{
                        ADMIN: `Cấp quyền quản trị cho ${u.name}?`,
                        HOST: `Chuyển ${u.name} thành đối tác khách sạn?`,
                        USER: `Thu hồi vai trò hiện tại của ${u.name} (trở về khách hàng)?`,
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <UsersList />
    </Suspense>
  );
}
