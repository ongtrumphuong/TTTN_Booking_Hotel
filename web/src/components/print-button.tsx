"use client";

import { Printer } from "lucide-react";

/** Mở hộp thoại in của trình duyệt (cũng dùng để lưu thành PDF). Ẩn khi in. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark print:hidden">
      <Printer size={16} aria-hidden /> In / lưu PDF
    </button>
  );
}
