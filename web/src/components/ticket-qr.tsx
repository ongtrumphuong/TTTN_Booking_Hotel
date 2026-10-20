import QRCode from "qrcode";
import { ticketFor } from "@/lib/ticket";

/** Mã QR vé điện tử của đơn đã xác nhận: lễ tân quét để nhận phòng nhanh. */
export async function TicketQr({ code }: { code: string }) {
  const dataUrl = await QRCode.toDataURL(ticketFor(code), { margin: 1, width: 220, errorCorrectionLevel: "M" });
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-3xl border border-dashed border-brand/40 bg-brand/5 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR sinh tại chỗ (data URL), không cần tối ưu */}
      <img src={dataUrl} alt={`Mã QR vé điện tử của đơn ${code}`} width={132} height={132} className="rounded-xl bg-white p-1.5" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-display text-xl font-semibold">Vé điện tử</p>
        <p className="mt-1 text-muted">Đưa mã QR này cho lễ tân khi nhận phòng để được làm thủ tục nhanh. Nếu quên, chỉ cần đọc mã đặt phòng <b className="text-foreground">{code}</b>.</p>
      </div>
    </div>
  );
}
