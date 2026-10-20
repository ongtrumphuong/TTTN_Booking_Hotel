"use client";

import { useSyncExternalStore } from "react";

const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const subscribe = () => () => {};

/**
 * Ngày hôm nay (yyyy-mm-dd) theo múi giờ của trình duyệt, dùng làm giá trị tối thiểu cho ô chọn ngày.
 * Phía máy chủ trả chuỗi rỗng; phía trình duyệt trả ngày thật mà không cần setState trong effect.
 */
export function useToday() {
  return useSyncExternalStore(subscribe, () => toISO(new Date()), () => "");
}
