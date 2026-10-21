"use client";

import { useEffect, useRef, useState } from "react";
import "@photo-sphere-viewer/core/index.css";

type Status = "loading" | "ready" | "error";

/**
 * Trình xem ảnh toàn cảnh 360° (Photo Sphere Viewer): kéo chuột hoặc vuốt để xoay quanh phòng, cuộn hoặc véo để phóng to.
 * Thư viện chỉ tải khi mở trình xem (import động) nên không làm nặng các trang còn lại.
 */
export default function PanoramaViewer({ url, title }: { url: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let destroyed = false;
    let viewer: { destroy: () => void } | undefined;
    (async () => {
      try {
        const { Viewer } = await import("@photo-sphere-viewer/core");
        if (destroyed || !ref.current) return;
        const v = new Viewer({
          container: ref.current,
          panorama: url,
          caption: title,
          defaultZoomLvl: 30,
          touchmoveTwoFingers: false,
          mousewheelCtrlKey: false,
          navbar: ["zoom", "move", "fullscreen"],
          lang: {
            zoom: "Thu phóng",
            zoomOut: "Thu nhỏ",
            zoomIn: "Phóng to",
            moveUp: "Lên",
            moveDown: "Xuống",
            moveLeft: "Sang trái",
            moveRight: "Sang phải",
            fullscreen: "Toàn màn hình",
            loadError: "Không tải được ảnh 360°",
          },
        });
        viewer = v;
        v.addEventListener("ready", () => !destroyed && setStatus("ready"), { once: true });
        v.addEventListener("panorama-error", () => !destroyed && setStatus("error"), { once: true });
      } catch {
        if (!destroyed) setStatus("error");
      }
    })();
    return () => {
      destroyed = true;
      viewer?.destroy();
    };
  }, [url, title]);

  return (
    <div className="relative h-full w-full bg-ink">
      <div ref={ref} className="h-full w-full" />
      {status === "loading" && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-semibold text-white/80">Đang tải ảnh 360°...</p>}
      {status === "error" && <p role="alert" className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-semibold text-white">Không tải được ảnh 360° của phòng này. Vui lòng thử lại sau.</p>}
    </div>
  );
}
