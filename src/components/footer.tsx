import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-20 bg-[#0b1630] text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm leading-relaxed text-white/60">
            Nền tảng đặt phòng khách sạn do Không Gian Số phát triển. Đồ án thực tập tốt nghiệp.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Khám phá</p>
          <ul className="space-y-2 text-white/60">
            <li><Link href="/hotels" className="hover:text-white">Tất cả khách sạn</Link></li>
            <li><Link href="/favorites" className="hover:text-white">Khách sạn yêu thích</Link></li>
            <li><Link href="/bookings" className="hover:text-white">Đặt phòng của tôi</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Hỗ trợ</p>
          <ul className="space-y-2 text-white/60">
            <li>Trung tâm trợ giúp</li>
            <li>Chính sách hủy phòng</li>
            <li>Điều khoản sử dụng</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © Không Gian Số. Bảo lưu mọi quyền.
      </div>
    </footer>
  );
}
