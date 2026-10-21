"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Rotate3d, X } from "lucide-react";

const Viewer = dynamic(() => import("@/components/panorama/panorama-viewer"), { ssr: false });

/** Nút "Xem phòng 360°" nằm trên ảnh phòng; bấm để mở trình xem toàn cảnh trong hộp thoại toàn màn hình. */
export function PanoramaButton({ url, title }: { url: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-ink"
      >
        <Rotate3d size={14} aria-hidden /> Xem phòng 360°
      </button>
      <dialog
        ref={dialog}
        aria-label={`Xem ${title} dạng 360°`}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto h-[85vh] w-[min(1100px,94vw)] overflow-hidden rounded-3xl bg-ink p-0 backdrop:bg-black/70"
      >
        {open && (
          <div className="relative h-full w-full">
            <Viewer url={url} title={title} />
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Đóng" className="absolute right-3 top-3 z-[1000] grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80">
              <X size={18} aria-hidden />
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
