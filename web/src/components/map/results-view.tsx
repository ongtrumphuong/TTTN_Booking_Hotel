"use client";

import { useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import type { MapPoint } from "@/lib/map";
import { LazyMap } from "./lazy-map";

/** Chuyển giữa danh sách và bản đồ kết quả. Bản đồ chỉ được tải khi khách bấm "Bản đồ". */
export function ResultsView({ token, points, children }: { token: string; points: MapPoint[]; children: React.ReactNode }) {
  const [view, setView] = useState<"list" | "map">("list");
  return (
    <div>
      {points.length > 0 && (
        <div className="mb-4 inline-flex overflow-hidden rounded-full border border-border bg-white text-sm font-semibold" role="group" aria-label="Cách xem kết quả">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`flex items-center gap-1.5 px-4 py-2 ${view === "list" ? "bg-brand text-white" : "hover:bg-background"}`}>
            <List size={15} aria-hidden /> Danh sách
          </button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`flex items-center gap-1.5 px-4 py-2 ${view === "map" ? "bg-brand text-white" : "hover:bg-background"}`}>
            <MapIcon size={15} aria-hidden /> Bản đồ
          </button>
        </div>
      )}
      {view === "map" ? <LazyMap token={token} points={points} mode="results" className="h-[70vh] min-h-96" /> : children}
    </div>
  );
}
