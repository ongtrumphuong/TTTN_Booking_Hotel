"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { resetFavorites } from "@/lib/favorites-store";

export function LogoutButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <form action={logoutAction} onSubmit={() => resetFavorites()}>
      <button type="submit" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${tone === "dark" ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-background hover:text-foreground"}`}>
        <LogOut size={16} aria-hidden />
        <span className="sr-only md:not-sr-only">Đăng xuất</span>
      </button>
    </form>
  );
}
