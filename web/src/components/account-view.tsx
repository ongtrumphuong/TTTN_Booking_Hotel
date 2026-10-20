import { PasswordForm, ProfileForm } from "@/components/account-forms";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const ROLE_LABEL = { ADMIN: "Quản trị viên sàn", HOST: "Đối tác khách sạn", USER: "Khách hàng" } as const;

/** Hồ sơ cá nhân và đổi mật khẩu, dùng chung cho khách (/account), đối tác (/host/account) và quản trị viên (/admin/account). */
export async function AccountView({ returnTo }: { returnTo: string }) {
  const session = await requireUser(returnTo);
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, role: true, _count: { select: { bookings: true } } },
  });
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-white p-6">
        <h1 className="font-display text-3xl font-semibold">Xin chào, {user.name}</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Email đăng nhập</dt><dd className="font-semibold">{user.email}</dd></div>
          <div><dt className="text-muted">Vai trò</dt><dd className="font-semibold">{ROLE_LABEL[user.role]}</dd></div>
          {user.role === "USER" && <div><dt className="text-muted">Số lượt đặt phòng</dt><dd className="font-semibold">{user._count.bookings}</dd></div>}
        </dl>
      </div>
      <section className="rounded-3xl border border-border bg-white p-6">
        <h2 className="font-display mb-4 text-xl font-semibold">Thông tin cá nhân</h2>
        <ProfileForm name={user.name} phone={user.phone ?? ""} />
      </section>
      <section className="rounded-3xl border border-border bg-white p-6">
        <h2 className="font-display mb-4 text-xl font-semibold">Đổi mật khẩu</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
