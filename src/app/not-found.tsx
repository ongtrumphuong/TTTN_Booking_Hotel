import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";

export const metadata: Metadata = { title: "Không tìm thấy trang" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <SearchX size={32} aria-hidden />
      </span>
      <p className="text-sm font-bold tracking-widest text-brand">LỖI 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Không tìm thấy trang bạn cần</h1>
      <p className="mt-3 text-muted">
        Đường dẫn có thể đã thay đổi, khách sạn đã ngừng hiển thị, hoặc bạn gõ nhầm địa chỉ.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-dark">
          Về trang chủ
        </Link>
        <Link href="/hotels" className="rounded-xl border border-border bg-white px-5 py-3 text-sm font-bold hover:border-brand">
          Tìm khách sạn
        </Link>
      </div>
    </div>
  );
}
