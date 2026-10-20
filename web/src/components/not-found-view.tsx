import Link from "next/link";
import { SearchX } from "lucide-react";

/** Nội dung trang 404 dùng chung cho các khu vực. */
export function NotFoundView({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <SearchX size={32} aria-hidden />
      </span>
      <p className="text-sm font-bold tracking-widest text-brand">LỖI 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Không tìm thấy trang bạn cần</h1>
      <p className="mt-3 text-muted">Đường dẫn có thể đã thay đổi hoặc bạn gõ nhầm địa chỉ.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {links.map((l, i) => (
          <Link key={l.href} href={l.href} className={`rounded-xl px-5 py-3 text-sm font-bold ${i === 0 ? "bg-brand text-white hover:bg-brand-dark" : "border border-border bg-white hover:border-brand"}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
