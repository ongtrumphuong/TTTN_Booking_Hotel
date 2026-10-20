import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CircleDollarSign, ClipboardCheck, Store } from "lucide-react";

export const metadata: Metadata = {
  title: "Dành cho đối tác khách sạn",
  description: "Đưa khách sạn của bạn lên Không Gian Số Stay: tự quản lý phòng, giá, nhận đơn đặt phòng và được chi trả minh bạch.",
};

const steps = [
  { icon: Store, title: "Đăng ký và đăng khách sạn", text: "Tạo tài khoản đối tác, nhập thông tin khách sạn, ảnh, loại phòng và giá." },
  { icon: ClipboardCheck, title: "Sàn duyệt, khách đặt phòng", text: "Quản trị viên duyệt khách sạn. Sau đó khách tìm thấy bạn, đặt và thanh toán qua cổng VNPay." },
  { icon: CircleDollarSign, title: "Đối soát và nhận tiền", text: "Sàn thu tiền của khách, trừ hoa hồng rồi chi trả cho bạn theo từng đợt, có bảng đối soát chi tiết." },
];

const perks = [
  "Tự quản lý phòng, giá, ảnh và lịch chặn phòng",
  "Chính sách hủy do bạn đặt cho từng khách sạn",
  "Xem đơn của khách sạn mình, ghi nhận nhận phòng và trả phòng",
  "Hoa hồng minh bạch, chốt tại thời điểm khách đặt",
];

export default function PartnerPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink py-16 text-white md:py-24">
        <Image
          src="https://images.unsplash.com/photo-1743525922686-badbeac16a34?auto=format&fit=crop&w=1800&q=80"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
        <div className="mx-auto max-w-6xl px-4">
          <p className="animate-fade-up text-sm font-semibold uppercase tracking-[0.18em] text-accent">Dành cho đối tác khách sạn</p>
          <h1 className="animate-fade-up delay-1 font-display mt-3 max-w-2xl text-4xl font-semibold leading-tight text-balance md:text-6xl">
            Đưa khách sạn của bạn đến đúng khách cần phòng
          </h1>
          <p className="animate-fade-up delay-2 mt-5 max-w-xl text-lg text-white/75">
            Không Gian Số Stay lo phần tìm kiếm, đặt phòng và thanh toán. Bạn tập trung vận hành và đón khách.
          </p>
          <div className="animate-fade-up delay-3 mt-8 flex flex-wrap gap-3">
            <Link href="/partner/register" className="inline-flex items-center gap-2 rounded-full bg-sun px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-sun/30 transition hover:brightness-110">
              Đăng ký làm đối tác <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/login?callbackUrl=/host" className="rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold transition hover:bg-white/10">
              Tôi đã là đối tác
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">Hoạt động như thế nào</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-3xl border border-border bg-white p-6">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon size={24} aria-hidden /></span>
              <p className="mt-4 text-sm font-semibold text-brand">Bước {i + 1}</p>
              <h3 className="font-display mt-1 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="rounded-[2rem] bg-sand p-8 md:p-12">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Bạn nhận được gì</h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {perks.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px]">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-sun" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
