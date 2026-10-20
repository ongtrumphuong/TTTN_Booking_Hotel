"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Quản lý danh sách ảnh của khách sạn/phòng: tải ảnh lên, thêm bằng URL, đặt ảnh bìa, xóa.
 * Giá trị gửi đi qua trường ẩn "images" (mỗi dòng một ảnh); ảnh đầu tiên là ảnh bìa.
 */
export function ImageUploader({ initial, max = 10 }: { initial: string[]; max?: number }) {
  const [images, setImages] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const problems: string[] = [];

    const room = max - images.length;
    if (room <= 0) {
      setMessages([`Tối đa ${max} ảnh.`]);
      return;
    }
    const valid = files.slice(0, room).filter((f) => {
      if (!ACCEPT.split(",").includes(f.type)) problems.push(`${f.name}: chỉ nhận JPEG, PNG hoặc WebP.`);
      else if (f.size > MAX_BYTES) problems.push(`${f.name}: vượt quá 5 MB.`);
      else return true;
      return false;
    });
    if (files.length > room) problems.push(`Chỉ thêm được ${room} ảnh nữa (tối đa ${max}).`);

    if (valid.length > 0) {
      setBusy(true);
      try {
        const fd = new FormData();
        valid.forEach((f) => fd.append("files", f));
        const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { urls?: string[]; errors?: { name: string; error: string }[]; error?: string };
        const urls = data.urls ?? [];
        if (urls.length) setImages((cur) => [...cur, ...urls]);
        data.errors?.forEach((e) => problems.push(`${e.name}: ${e.error}`));
        if (data.error) problems.push(data.error);
        if (!res.ok && !data.error && !data.errors?.length) problems.push("Tải ảnh lên thất bại.");
      } catch {
        problems.push("Không kết nối được máy chủ để tải ảnh lên.");
      } finally {
        setBusy(false);
      }
    }
    setMessages(problems);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (images.includes(url)) {
      setMessages(["Ảnh này đã có trong danh sách."]);
      return;
    }
    if (images.length >= max) {
      setMessages([`Tối đa ${max} ảnh.`]);
      return;
    }
    setImages([...images, url]);
    setUrlInput("");
    setMessages([]);
  }

  const makeCover = (i: number) => setImages((cur) => [cur[i], ...cur.filter((_, k) => k !== i)]);
  const remove = (i: number) => setImages((cur) => cur.filter((_, k) => k !== i));

  return (
    <div className="space-y-3">
      <textarea name="images" value={images.join("\n")} readOnly hidden aria-hidden />

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => (
            <li key={src} className="relative overflow-hidden rounded-xl border border-border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Ảnh ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">Ảnh bìa</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] font-semibold text-white">
                {i > 0 ? (
                  <button type="button" onClick={() => makeCover(i)} className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">
                    Đặt làm bìa
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => remove(i)} aria-label={`Xóa ảnh ${i + 1}`} className="rounded bg-red-600/90 p-1 hover:bg-red-600">
                  <X size={14} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand/5 px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10 ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <ImagePlus size={18} aria-hidden /> {busy ? "Đang tải lên..." : "Tải ảnh lên"}
          <input ref={fileRef} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => void upload(e.target.files)} />
        </label>
        <span className="text-xs text-muted">
          JPEG, PNG, WebP; tối đa 5 MB/ảnh; {images.length}/{max} ảnh
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="Hoặc dán URL ảnh https (picsum.photos, images.unsplash.com)"
          className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button type="button" onClick={addUrl} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-brand">
          Thêm
        </button>
      </div>

      {messages.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
