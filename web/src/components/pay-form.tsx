"use client";

import { useActionState } from "react";
import { CreditCard, Landmark, QrCode, Wallet } from "lucide-react";
import { payBookingAction, type BookingState } from "@/app/actions/booking";
import { startVnpayPaymentAction, type PaymentState } from "@/app/actions/payment";
import { formatVND } from "@/lib/format";

const SIM_METHODS = [
  { value: "card", label: "Thẻ ATM / Visa / Mastercard", icon: CreditCard },
  { value: "ewallet", label: "Ví điện tử (MoMo, ZaloPay)", icon: Wallet },
  { value: "bank", label: "Chuyển khoản ngân hàng", icon: Landmark },
];

const VNPAY_BANKS = [
  { value: "", label: "Chọn phương thức ngay tại VNPay", icon: Wallet },
  { value: "VNPAYQR", label: "Quét mã VNPAY-QR", icon: QrCode },
  { value: "VNBANK", label: "Thẻ ATM / tài khoản ngân hàng nội địa", icon: Landmark },
  { value: "INTCARD", label: "Thẻ quốc tế (Visa, Mastercard)", icon: CreditCard },
];

function Options({ name, items }: { name: string; items: { value: string; label: string; icon: typeof Wallet }[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">Phương thức thanh toán</legend>
      {items.map(({ value, label, icon: Icon }, i) => (
        <label
          key={value || "any"}
          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 text-sm font-medium transition has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:shadow-sm"
        >
          <input type="radio" name={name} value={value} defaultChecked={i === 0} className="accent-[#0e7490]" />
          <Icon size={18} className="text-brand" aria-hidden />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </div>
  ) : null;
}

const submitCls = "w-full rounded-2xl bg-sun px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sun/25 transition hover:brightness-110 disabled:opacity-60";

function SimulatedForm({ bookingId, total }: { bookingId: string; total: number }) {
  const [state, action, pending] = useActionState<BookingState, FormData>(payBookingAction.bind(null, bookingId), {});
  return (
    <form action={action} className="space-y-4">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Đây là cổng thanh toán <b>giả lập</b> phục vụ đồ án. Không có khoản tiền thật nào bị trừ và bạn không cần nhập thông tin thẻ.
      </div>
      <ErrorBox message={state.error} />
      <Options name="method" items={SIM_METHODS} />
      <button type="submit" disabled={pending} className={submitCls}>
        {pending ? "Đang xử lý..." : `Thanh toán ${formatVND(total)}`}
      </button>
    </form>
  );
}

function VnpayForm({ bookingId, total }: { bookingId: string; total: number }) {
  const [state, action, pending] = useActionState<PaymentState, FormData>(startVnpayPaymentAction.bind(null, bookingId), {});
  return (
    <form action={action} className="space-y-4">
      <div className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand-dark">
        Bạn sẽ được chuyển sang cổng thanh toán <b>VNPay</b>. Hệ thống không lưu thông tin thẻ của bạn.
      </div>
      <ErrorBox message={state.error} />
      <Options name="bank" items={VNPAY_BANKS} />
      <button type="submit" disabled={pending} className={submitCls}>
        {pending ? "Đang chuyển sang VNPay..." : `Thanh toán ${formatVND(total)} qua VNPay`}
      </button>
    </form>
  );
}

export function PayForm({ bookingId, total, mode }: { bookingId: string; total: number; mode: "simulated" | "vnpay" }) {
  return mode === "vnpay" ? <VnpayForm bookingId={bookingId} total={total} /> : <SimulatedForm bookingId={bookingId} total={total} />;
}
