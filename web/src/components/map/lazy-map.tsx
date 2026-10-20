"use client";

import dynamic from "next/dynamic";

/** Thư viện bản đồ khá nặng và cần trình duyệt (WebGL) nên chỉ tải ở phía khách và chỉ khi thành phần này thật sự được dựng. */
export const LazyMap = dynamic(() => import("./mapbox-view"), {
  ssr: false,
  loading: () => <div className="h-full min-h-64 w-full animate-pulse rounded-2xl bg-border" aria-label="Đang tải bản đồ" />,
});
