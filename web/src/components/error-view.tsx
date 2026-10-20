"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/** Nội dung trang lỗi dùng chung; mỗi khu vực (khách, quản trị, đối tác) có tệp error.tsx riêng để giữ đúng khung giao diện của mình. */
export function ErrorView({ error, retry, homeHref }: { error: Error & { digest?: string }; retry: () => void; homeHref: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <TriangleAlert size={32} aria-hidden />
      </span>
      <p className="text-sm font-bold tracking-widest text-red-600">CÓ LỖI XẢY RA</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Rất tiếc, đã có sự cố</h1>
      <p className="mt-3 text-muted">
        Hệ thống chưa xử lý được yêu cầu của bạn. Vui lòng thử lại; nếu lỗi vẫn tiếp diễn hãy liên hệ bộ phận hỗ trợ.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Mã lỗi: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-dark">
          Thử lại
        </button>
        <Link href={homeHref} className="rounded-xl border border-border bg-white px-5 py-3 text-sm font-bold hover:border-brand">
          Quay lại
        </Link>
      </div>
    </div>
  );
}
