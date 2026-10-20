"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ScanLine, Search, XCircle } from "lucide-react";
import { checkInBookingAction, lookupTicketAction, type TicketLookup } from "@/app/actions/admin";

type Found = Extract<TicketLookup, { booking: unknown }>["booking"];

const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "UTC" });
const fmtTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** Quầy lễ tân: quét mã QR trên vé (hoặc gõ mã đặt phòng), xem thông tin đơn rồi bấm nhận phòng. */
export function CheckInDesk() {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pending, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

  function lookup(raw: string) {
    setError(undefined);
    setDone(false);
    start(async () => {
      const r = await lookupTicketAction(raw);
      if ("error" in r) {
        setFound(null);
        setError(r.error);
      } else {
        setFound(r.booking);
      }
    });
  }

  function checkIn(b: Found) {
    start(async () => {
      const r = await checkInBookingAction(b.id);
      if (r.error) setError(r.error);
      else {
        setDone(true);
        setError(undefined);
        const again = await lookupTicketAction(b.code);
        if (!("error" in again)) setFound(again.booking);
      }
    });
  }

  // Bật camera và quét mã QR khi người dùng bấm "Quét bằng camera".
  useEffect(() => {
    if (!scanning) return;
    let stop = false;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        while (!stop) {
          const codes = await detector.detect(video).catch(() => []);
          if (codes[0]?.rawValue) {
            setText(codes[0].rawValue);
            setScanning(false);
            lookup(codes[0].rawValue);
            return;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setError("Không mở được camera. Hãy cho phép dùng camera hoặc nhập mã đặt phòng bằng tay.");
        setScanning(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  const status = found?.statusLabel ?? null;

  return (
    <div className="max-w-2xl space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) lookup(text);
        }}
        className="rounded-3xl border border-border bg-white p-5"
      >
        <label htmlFor="ticket" className="mb-1.5 block text-sm font-semibold">Mã đặt phòng hoặc nội dung mã QR</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="ticket"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            placeholder="KGS-XXXXXXXX"
            className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-3 text-sm uppercase outline-none focus:border-brand"
          />
          <button type="submit" disabled={pending || !text.trim()} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60">
            <Search size={16} aria-hidden /> Tra cứu
          </button>
          {supported && (
            <button type="button" onClick={() => setScanning((v) => !v)} className="flex items-center gap-2 rounded-xl border border-brand px-4 py-3 text-sm font-bold text-brand hover:bg-brand/5">
              <ScanLine size={16} aria-hidden /> {scanning ? "Dừng quét" : "Quét bằng camera"}
            </button>
          )}
        </div>
        {!supported && <p className="mt-2 text-xs text-muted">Trình duyệt này chưa hỗ trợ quét QR bằng camera; hãy dùng máy quét mã (gõ vào ô trên) hoặc nhập mã đặt phòng.</p>}
        {scanning && (
          <div className="mt-3 overflow-hidden rounded-2xl bg-ink">
            <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
          </div>
        )}
      </form>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </div>
      )}
      {done && (
        <div role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden /> Đã ghi nhận khách nhận phòng.
        </div>
      )}

      {found && status && (
        <div className="rounded-3xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Mã đặt phòng</p>
              <p className="font-display text-2xl font-semibold tracking-wide">{found.code}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.cls}`}>{status.text}</span>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Khách</dt><dd className="font-semibold">{found.guestName}{found.guestPhone ? ` · ${found.guestPhone}` : ""}</dd></div>
            <div><dt className="text-muted">Khách sạn</dt><dd className="font-semibold">{found.hotelName}</dd></div>
            <div><dt className="text-muted">Loại phòng</dt><dd className="font-semibold">{found.roomName} × {found.rooms}</dd></div>
            <div><dt className="text-muted">Số khách</dt><dd className="font-semibold">{found.guests}</dd></div>
            <div><dt className="text-muted">Nhận phòng</dt><dd className="font-semibold">{fmt(found.checkIn)}</dd></div>
            <div><dt className="text-muted">Trả phòng</dt><dd className="font-semibold">{fmt(found.checkOut)}</dd></div>
            {found.checkedInAt && <div className="sm:col-span-2"><dt className="text-muted">Đã nhận phòng lúc</dt><dd className="font-semibold">{fmtTime(found.checkedInAt)}</dd></div>}
            {found.note && <div className="sm:col-span-2"><dt className="text-muted">Yêu cầu của khách</dt><dd className="font-semibold">{found.note}</dd></div>}
          </dl>
          <div className="mt-5 border-t border-border pt-4">
            {found.canCheckIn ? (
              <button type="button" disabled={pending} onClick={() => checkIn(found)} className="rounded-xl bg-sun px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sun/25 hover:brightness-110 disabled:opacity-60">
                {pending ? "Đang ghi nhận..." : "Xác nhận nhận phòng"}
              </button>
            ) : (
              <p className="text-sm font-semibold text-amber-800">{found.reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
