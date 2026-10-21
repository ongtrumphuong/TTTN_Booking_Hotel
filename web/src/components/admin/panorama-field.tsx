"use client";

import { useRef, useState } from "react";
import { Rotate3d } from "lucide-react";

const input = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/** Ô nhập ảnh 360° của loại phòng: dán đường dẫn/URL hoặc tải ảnh toàn cảnh (tỷ lệ 2:1) lên. Gửi qua trường "panoramaUrl". */
export function PanoramaField({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    if (file.size > 5 * 1024 * 1024) return setError("Ảnh vượt quá 5 MB.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", "panorama");
      fd.append("files", file);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[]; errors?: { error: string }[]; error?: string };
      if (data.urls?.[0]) setUrl(data.urls[0]);
      else setError(data.errors?.[0]?.error ?? data.error ?? "Tải ảnh lên thất bại.");
    } catch {
      setError("Không kết nối được máy chủ để tải ảnh lên.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-xs font-semibold text-muted">Ảnh 360° của phòng (không bắt buộc)</label>
      <div className="flex flex-wrap gap-2">
        <input name="panoramaUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/panoramas/cabin.jpg hoặc URL ảnh toàn cảnh" className={`${input} min-w-0 flex-1`} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-brand px-3 py-2 text-sm font-bold text-brand hover:bg-brand/5 disabled:opacity-60">
          <Rotate3d size={16} aria-hidden /> {busy ? "Đang tải..." : "Tải ảnh 360°"}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <p className="mt-1 text-xs text-muted">Ảnh toàn cảnh phép chiếu equirectangular, chiều rộng gấp đôi chiều cao (chụp bằng chế độ Photo Sphere/Panorama 360° của điện thoại). Để trống nếu chưa có.</p>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
