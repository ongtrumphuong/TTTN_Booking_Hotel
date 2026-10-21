import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nhật ký thao tác" };

const ROLE = { ADMIN: "Quản trị", HOST: "Đối tác", USER: "Khách" } as Record<string, string>;

async function Content({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  await requireAdmin("/admin/audit");
  const sp = await searchParams;
  const raw = Array.isArray(sp.action) ? sp.action[0] : sp.action;
  const action = raw && raw in AUDIT_ACTIONS ? (raw as AuditAction) : undefined;

  const logs = await prisma.auditLog.findMany({ where: action ? { action } : {}, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <>
      <h1 className="font-display mb-1 text-3xl font-semibold">Nhật ký thao tác</h1>
      <p className="mb-4 text-sm text-muted">Ghi lại ai đã làm gì với tiền, khách sạn, giá và quyền. Chỉ ghi thêm, không sửa hay xóa được. Hiển thị 200 dòng mới nhất.</p>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/audit" className={`rounded-full border px-3 py-1.5 font-medium ${!action ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>Tất cả</Link>
        {(Object.keys(AUDIT_ACTIONS) as AuditAction[]).map((a) => (
          <Link key={a} href={`/admin/audit?action=${a}`} className={`rounded-full border px-3 py-1.5 font-medium ${action === a ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>
            {AUDIT_ACTIONS[a]}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Người thực hiện</th>
              <th className="px-4 py-3">Thao tác</th>
              <th className="px-4 py-3">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Chưa có thao tác nào được ghi.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(l.createdAt)}</td>
                <td className="px-4 py-3"><span className="font-semibold">{l.actorName}</span> <span className="text-xs text-muted">({ROLE[l.actorRole] ?? l.actorRole})</span></td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{AUDIT_ACTIONS[l.action as AuditAction] ?? l.action}</td>
                <td className="break-words px-4 py-3 text-muted">{l.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AuditPage(props: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
