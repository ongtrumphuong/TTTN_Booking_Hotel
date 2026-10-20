"use client";

import { useSyncExternalStore } from "react";

type State = { loaded: boolean; loggedIn: boolean; ids: ReadonlySet<string> };

const SERVER_STATE: State = { loaded: false, loggedIn: false, ids: new Set() };
let state: State = SERVER_STATE;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

/** Tải danh sách yêu thích một lần cho cả trang; chưa đăng nhập thì tải lại mỗi lần để thấy phiên mới. */
export function loadFavorites() {
  if (state.loaded && state.loggedIn) return Promise.resolve();
  inflight ??= fetch("/api/favorites", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { loggedIn: boolean; ids: string[] }) => set({ loaded: true, loggedIn: d.loggedIn, ids: new Set(d.ids) }))
    .catch(() => set({ ...state, loaded: true }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Gọi khi đăng nhập hoặc đăng xuất để lần sau tải lại theo phiên mới. */
export function resetFavorites() {
  set(SERVER_STATE);
}

export function setFavorite(hotelId: string, on: boolean) {
  const ids = new Set(state.ids);
  if (on) ids.add(hotelId);
  else ids.delete(hotelId);
  set({ ...state, ids });
}

export function useFavorites() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );
}
