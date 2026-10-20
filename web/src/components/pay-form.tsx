"use client";

import { useActionState } from "react";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { payBookingAction, type BookingState } from "@/app/actions/booking";
import { formatVND } from "@/lib/format";

const METHODS = [
  { value: "card", label: "Thẻ ATM / Visa / Mastercard", icon: CreditCard },
  { value: "ewallet", label: "Ví điện tử (MoMo, ZaloPay)", icon: Wallet },
  { value: "bank", label: "Chuyển khoản ngân hàng", icon: Landmark },
];

export function PayForm({ bookingId, total }: { bookingId: string; total: number }) {
  const [state, action, pending] = useActionState<BookingState, FormData>(payBookingAction.bind(null, bookingId), {});

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Đây là cổng thanh toán <b>giả lập</b> phục vụ đồ án. Không có khoản tiền thật nào bị trừ và bạn không cần nhập thông tin thẻ.
      </div>

      {state.error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Phương thức thanh toán</legend>
        {METHODS.map(({ value, label, icon: Icon }, i) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand/5"
          >
            <input type="radio" name="method" value={value} defaultChecked={i === 0} className="accent-[#0b5fff]" />
            <Icon size={18} className="text-brand" aria-hidden />
            {label}
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Đang xử lý..." : `Thanh toán ${formatVND(total)}`}
      </button>
    </form>
  );
}
