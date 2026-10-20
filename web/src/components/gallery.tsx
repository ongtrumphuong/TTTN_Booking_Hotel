"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

/** Thư viện ảnh: lưới ảnh trên trang và cửa sổ xem phóng to có điều hướng bằng bàn phím, thanh ảnh nhỏ. */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const total = images.length;

  const go = useCallback((delta: number) => setIndex((i) => (i === null ? i : (i + delta + total) % total)), [total]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  const shown = images.slice(0, total >= 5 ? 5 : 3);
  const big = total >= 5;

  return (
    <>
      {/* 1 ảnh lớn + 2 ảnh nhỏ xếp chồng (hoặc 4 ảnh nhỏ khi có từ 5 ảnh): luôn kín khung, không để ô trống */}
      <div className="relative">
        <div
          className={`grid gap-2 overflow-hidden rounded-2xl md:h-[420px] ${
            total === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-rows-2 " + (big ? "md:grid-cols-4" : "md:grid-cols-[2fr_1fr]")
          }`}
        >
          {shown.map((src, i) => {
            const span =
              i === 0
                ? big
                  ? "col-span-2 aspect-[16/10] md:aspect-auto md:row-span-2"
                  : "col-span-2 aspect-[16/10] md:col-span-1 md:row-span-2 md:aspect-auto"
                : total === 2 && i === 1
                  ? "col-span-2 md:col-span-1 md:row-span-2 aspect-[16/10] md:aspect-auto"
                  : "aspect-[4/3] md:aspect-auto";
            return (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Xem ảnh ${i + 1} của ${name}`}
                className={`relative block overflow-hidden bg-border ${span}`}
              >
                <Image
                  src={src}
                  alt={`${name} - ảnh ${i + 1}`}
                  fill
                  priority={i === 0}
                  sizes={i === 0 ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                  className="object-cover transition duration-300 hover:scale-105"
                />
              </button>
            );
          })}
        </div>
        {total > 1 && (
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold shadow hover:bg-white"
          >
            <Images size={16} aria-hidden /> Xem tất cả {total} ảnh
          </button>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`Ảnh của ${name}`}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === dialogRef.current && setIndex(null)}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black"
      >
        {index !== null && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold">{name}</span>
              <div className="flex items-center gap-3">
                <span aria-live="polite" className="text-white/70">{index + 1} / {total}</span>
                <button type="button" onClick={() => setIndex(null)} aria-label="Đóng" className="rounded-full p-2 hover:bg-white/10">
                  <X size={22} aria-hidden />
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <Image key={images[index]} src={images[index]} alt={`${name} - ảnh ${index + 1}`} fill sizes="100vw" className="object-contain" />
              {total > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label="Ảnh trước" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/70 md:left-4">
                    <ChevronLeft size={28} aria-hidden />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="Ảnh sau" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/70 md:right-4">
                    <ChevronRight size={28} aria-hidden />
                  </button>
                </>
              )}
            </div>

            {total > 1 && (
              <ul className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-3">
                {images.map((src, i) => (
                  <li key={src}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Chuyển tới ảnh ${i + 1}`}
                      aria-current={i === index}
                      className={`relative block h-14 w-20 overflow-hidden rounded-md ${i === index ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"}`}
                    >
                      <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
