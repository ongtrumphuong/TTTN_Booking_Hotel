"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { boundsOf, compactPrice, type MapPoint } from "@/lib/map";

const STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

type Props = {
  token: string;
  points: MapPoint[];
  /** "single": một khách sạn (trang chi tiết); "results": nhiều khách sạn có ghim giá (trang kết quả). */
  mode: "single" | "results";
  className?: string;
};

/** Dựng nội dung cửa sổ bấm vào ghim bằng DOM + textContent (không dùng innerHTML) vì tên khách sạn do đối tác nhập. */
function popupNode(p: MapPoint) {
  const root = document.createElement("div");
  root.style.cssText = "min-width:180px;font-family:inherit";
  if (p.image) {
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = "";
    img.style.cssText = "width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px";
    root.appendChild(img);
  }
  const name = document.createElement("div");
  name.textContent = p.name;
  name.style.cssText = "font-weight:700;font-size:14px;line-height:1.25";
  root.appendChild(name);
  const meta = document.createElement("div");
  meta.textContent = [p.city, p.stars ? `${p.stars} sao` : "", p.rating ? `${p.rating.toFixed(1)}★` : ""].filter(Boolean).join(" · ");
  meta.style.cssText = "font-size:12px;color:#5f6f76;margin:2px 0 6px";
  root.appendChild(meta);
  if (p.price) {
    const price = document.createElement("div");
    price.textContent = `Từ ${p.price.toLocaleString("vi-VN")} ₫/đêm`;
    price.style.cssText = "font-weight:700;color:#0e7490;font-size:13px;margin-bottom:6px";
    root.appendChild(price);
  }
  if (p.slug) {
    const link = document.createElement("a");
    link.href = `/hotels/${encodeURIComponent(p.slug)}`;
    link.textContent = "Xem khách sạn →";
    link.style.cssText = "font-size:13px;font-weight:600;color:#f26b4f;text-decoration:none";
    root.appendChild(link);
  }
  return root;
}

function pinElement(p: MapPoint, mode: Props["mode"]) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", p.name);
  if (mode === "results" && p.price) {
    el.textContent = compactPrice(p.price);
    el.style.cssText =
      "background:#0e7490;color:#fff;border:2px solid #fff;border-radius:999px;padding:4px 10px;font:700 12px system-ui,sans-serif;box-shadow:0 2px 8px rgba(10,38,48,.35);cursor:pointer";
  } else {
    el.style.cssText = "width:22px;height:22px;background:#f26b4f;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(10,38,48,.4);cursor:pointer";
  }
  return el;
}

export default function MapboxView({ token, points, mode, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [style, setStyle] = useState<keyof typeof STYLES>("streets");
  // Kiểu bản đồ mà bản đồ đang dùng; chỉ gọi setStyle khi người dùng đổi kiểu (gọi lúc bản đồ đang tải kiểu ban đầu sẽ làm Mapbox lỗi nội bộ).
  const appliedStyle = useRef<keyof typeof STYLES>("streets");
  const wantedStyle = useRef<keyof typeof STYLES>("streets");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = box.current;
    if (!container || points.length === 0) return;

    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = token;
      const first = points[0];
      appliedStyle.current = wantedStyle.current;
      map = new mapboxgl.Map({ container, style: STYLES[wantedStyle.current], center: [first.lng, first.lat], zoom: mode === "single" ? 15 : 11, cooperativeGestures: mode === "results" });
    } catch {
      // Trình duyệt không hỗ trợ WebGL hoặc token lỗi: hiện thông báo thay vì để trống (hoãn sang lượt sau để không cập nhật state ngay trong effect).
      window.setTimeout(() => setFailed(true), 0);
      return;
    }
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.on("error", (e) => {
      // Token sai/hết hạn hoặc bị chặn tên miền: báo cho người dùng biết thay vì để bản đồ xám.
      const status = (e.error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403) setFailed(true);
    });

    const markers = points.map((p) => {
      const popup = new mapboxgl.Popup({ offset: mode === "single" ? 16 : 22, closeButton: true, maxWidth: "240px" }).setDOMContent(popupNode(p));
      return new mapboxgl.Marker({ element: pinElement(p, mode) }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
    });

    const bounds = mode === "results" ? boundsOf(points) : null;
    if (bounds && points.length > 1) map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    else if (mode === "results") map.setZoom(13);

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [token, points, mode]);

  useEffect(() => {
    wantedStyle.current = style;
    if (mapRef.current && appliedStyle.current !== style) {
      appliedStyle.current = style;
      mapRef.current.setStyle(STYLES[style]);
    }
  }, [style]);

  if (failed) {
    return (
      <div role="alert" className={`flex items-center justify-center rounded-2xl border border-border bg-background p-6 text-center text-sm text-muted ${className}`}>
        Không hiển thị được bản đồ (trình duyệt không hỗ trợ WebGL hoặc khóa bản đồ không hợp lệ).
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border ${className}`}>
      {/* Kích thước đặt bằng style nội tuyến vì CSS của Mapbox gán position: relative cho khung bản đồ và sẽ đè lên lớp Tailwind absolute/inset-0 (khung xẹp về cao 0). */}
      <div ref={box} style={{ position: "absolute", inset: 0 }} role="region" aria-label={mode === "single" ? "Bản đồ vị trí khách sạn" : "Bản đồ các khách sạn"} />
      <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-full border border-border bg-white text-xs font-semibold shadow">
        {(["streets", "satellite"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={style === s}
            onClick={() => setStyle(s)}
            className={`px-3 py-1.5 ${style === s ? "bg-brand text-white" : "text-foreground hover:bg-background"}`}
          >
            {s === "streets" ? "Bản đồ" : "Vệ tinh"}
          </button>
        ))}
      </div>
    </div>
  );
}
