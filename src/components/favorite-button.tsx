"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/engage";
import { loadFavorites, setFavorite, useFavorites } from "@/lib/favorites-store";

export function FavoriteButton({ hotelId, variant = "icon" }: { hotelId: string; variant?: "icon" | "pill" }) {
  const router = useRouter();
  const { ids, loaded, loggedIn } = useFavorites();
  const [busy, setBusy] = useState(false);
  const active = ids.has(hotelId);

  useEffect(() => {
    void loadFavorites();
  }, []);

  async function onClick() {
    if (loaded && !loggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setFavorite(hotelId, !active); // cập nhật ngay, hoàn lại nếu máy chủ từ chối
    const res = await toggleFavoriteAction(hotelId);
    if (res.needLogin) {
      setFavorite(hotelId, active);
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    } else if (res.error || res.favorited === undefined) {
      setFavorite(hotelId, active);
    } else {
      setFavorite(hotelId, res.favorited);
    }
    setBusy(false);
  }

  const label = active ? "Bỏ yêu thích" : "Thêm vào yêu thích";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-brand"
      >
        <Heart size={16} className={active ? "fill-red-500 text-red-500" : "text-muted"} aria-hidden />
        {active ? "Đã yêu thích" : "Yêu thích"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/95 shadow hover:scale-105"
    >
      <Heart size={18} className={active ? "fill-red-500 text-red-500" : "text-foreground/70"} aria-hidden />
    </button>
  );
}
