"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, MessageCircle, Send, Sparkles, Star, X } from "lucide-react";
import { formatVND } from "@/lib/format";

// Dữ liệu thẻ phòng do máy chủ trả về (khớp RoomOption ở lib/assistant/search.ts, chỉ giữ phần cần hiển thị).
type Option = {
  roomId: string;
  hotelName: string;
  city: string;
  stars: number;
  rating: number | null;
  roomName: string;
  pricePerNight: number;
  nights: number;
  total: number;
  highlights: string[];
  matched: string[];
  note?: string;
  imageUrl: string | null;
  hotelUrl: string;
  proposalToken: string;
};
type Card = { option: Option; alternative: boolean };
type Msg = { role: "user" | "assistant"; content: string; cards?: Card[] };

const STORAGE_KEY = "kgs-assistant";
const GREETING: Msg = {
  role: "assistant",
  content: "Xin chào! Mình là trợ lý đặt phòng. Bạn cho mình biết điểm đến, ngày đi, ngân sách và mong muốn (ví dụ \"view hồ\", \"gần biển\") nhé.",
};
const SUGGESTIONS = ["Đà Lạt 2 đêm, dưới 1,5 triệu/đêm, view hồ Xuân Hương", "Phòng gần biển ở Phú Quốc cho 2 người"];

function RoomCard({ card }: { card: Card }) {
  const o = card.option;
  return (
    <article className={`overflow-hidden rounded-2xl border bg-white text-left ${card.alternative ? "border-dashed border-border" : "border-border shadow-sm"}`}>
      {o.imageUrl && (
        <div className="relative aspect-[16/9] bg-border">
          <Image src={o.imageUrl} alt={o.roomName} fill sizes="320px" className="object-cover" />
        </div>
      )}
      <div className="space-y-1.5 p-3 text-sm">
        {card.alternative && <p className="text-xs font-semibold text-amber-700">Gần đúng: {o.note}</p>}
        <p className="font-display text-base font-semibold leading-tight">{o.hotelName}</p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin size={12} aria-hidden /> {o.city} · {o.roomName}
          {o.rating && <span className="ml-1 inline-flex items-center gap-0.5"><Star size={11} className="fill-accent text-accent" aria-hidden />{o.rating.toFixed(1)}</span>}
        </p>
        {o.highlights.length > 0 && (
          <p className="flex flex-wrap gap-1">
            {o.highlights.slice(0, 4).map((h) => (
              <span key={h} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.matched.some((m) => h.toLowerCase().includes(m.toLowerCase().replace(/^view\s+/, ""))) ? "bg-emerald-100 text-emerald-800" : "bg-sun/10 text-sun"}`}>{h}</span>
            ))}
          </p>
        )}
        <p>
          <b className="text-brand">{formatVND(o.pricePerNight)}</b>
          <span className="text-xs text-muted"> /đêm · tổng {o.nights} đêm {formatVND(o.total)}</span>
        </p>
        <div className="flex gap-2 pt-1">
          <Link href={`/assistant/confirm?t=${encodeURIComponent(o.proposalToken)}`} className="flex-1 rounded-xl bg-sun px-3 py-2 text-center text-xs font-bold text-white hover:brightness-110">
            Xem và giữ phòng
          </Link>
          <Link href={o.hotelUrl} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-background">Chi tiết</Link>
        </div>
      </div>
    </article>
  );
}

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [restored, setRestored] = useState(false);

  // Khôi phục hội thoại trong phiên trình duyệt hiện tại (đóng tab là mất, không lưu lên máy chủ). Làm lúc mở khung chat để tránh lệch giao diện khi dựng trang.
  function openPanel() {
    if (!restored) {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) setMsgs(JSON.parse(saved));
      } catch {
        /* bỏ qua: trình duyệt chặn lưu trữ */
      }
      setRestored(true);
    }
    setOpen(true);
  }

  useEffect(() => {
    try {
      if (restored) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-20)));
    } catch {
      /* bỏ qua */
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open, busy, restored]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/host")) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content: c }) => ({ role, content: c })) }),
      });
      const data = (await res.json()) as { reply?: string; cards?: Card[] };
      setMsgs([...next, { role: "assistant", content: data.reply ?? "Xin lỗi, mình chưa trả lời được.", cards: data.cards ?? [] }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Không kết nối được tới trợ lý. Bạn kiểm tra mạng và thử lại nhé." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Mở trợ lý đặt phòng"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-bold text-white shadow-2xl shadow-ink/30 transition hover:scale-105"
        >
          <Sparkles size={18} className="text-accent" aria-hidden /> Trợ lý đặt phòng
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Trợ lý đặt phòng"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[390px]"
        >
          <header className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <p className="flex items-center gap-2 text-sm font-bold"><MessageCircle size={16} className="text-accent" aria-hidden /> Trợ lý đặt phòng</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="rounded-full p-1 hover:bg-white/10"><X size={18} /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}>
                <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-brand text-white" : "border border-border bg-white"}`}>
                  {m.content}
                </p>
                {m.cards && m.cards.length > 0 && (
                  <div className="w-full space-y-2.5">
                    {m.cards.map((c) => <RoomCard key={c.option.roomId + c.option.proposalToken} card={c} />)}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-sm text-muted">Trợ lý đang tìm phòng...</p>}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border bg-white px-3 py-1.5 text-left text-xs font-medium hover:border-brand hover:text-brand">{s}</button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-border bg-white p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Ví dụ: Đà Lạt 20/10 - 22/10, dưới 1,5tr/đêm..."
              aria-label="Tin nhắn"
              className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi" className="flex size-10 items-center justify-center rounded-xl bg-sun text-white disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
          <p className="bg-white px-3 pb-2 text-center text-[11px] text-muted">Trợ lý chỉ gợi ý phòng. Bạn tự xác nhận và tự thanh toán.</p>
        </section>
      )}
    </>
  );
}
