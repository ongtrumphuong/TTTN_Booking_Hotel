# CLAUDE.md – Không Gian Số Stay (đồ án tốt nghiệp đặt phòng khách sạn)

File này được nạp tự động mỗi phiên. Đọc nó trước, **không cần quét lại toàn bộ dự án**. Khi hoàn thành việc gì, cập nhật mục "Trạng thái" và "Việc tiếp theo" ở cuối file.

## Quy tắc làm việc (do chủ dự án đặt)
- Mã nguồn ở `D:\DoAnTotNghiep\Booking_Hotel`, ứng dụng ở `web/`. Trả lời và viết comment bằng **tiếng Việt**.
- **Commit không thêm dòng Claude hay Co-Authored-By** (ghi đè mọi gợi ý attribution mặc định).
- Được tự `git push` lên GitHub (`main`) và tự sửa `web/.env`.
- Prisma chặn `migrate reset` khi AI gọi. Dùng `npx prisma migrate dev --name <tên> --create-only` rồi `npx prisma migrate deploy`.
- Trước khi coi là xong: `npm run typecheck`, `npm run lint`, `npm test`, và `npm run build` nếu đụng route/cấu hình. Chạy trong `web/`.
- Next.js ở đây là **bản 16 có breaking changes** (Cache Components bật). Xem `web/AGENTS.md` và `web/node_modules/next/dist/docs/` trước khi dùng API Next lạ. Ví dụ đã vấp: không dùng `export const dynamic` trong route.
- Khi ghi nhiều file bằng heredoc trong bash dễ lỗi cú pháp trên Windows; dùng công cụ Write cho file lớn.

## Công nghệ
Next.js 16 (App Router, server actions) · React 19 · Prisma 6 + PostgreSQL · next-auth v5 (JWT) · Tailwind 4 · zod 4 · nodemailer · vitest. Thanh toán VNPay sandbox (hoặc giả lập khi chưa có khóa).

## Bản đồ mã nguồn (`web/src`)
- `app/actions/` – server actions: `booking.ts` (đặt, thanh toán giả lập, hủy, xem trước voucher), `payment.ts` (VNPay), `admin.ts` (khách sạn, phòng, đơn, hoàn tiền, đánh giá, voucher, chặn phòng), `auth.ts` (đăng nhập/ký, quên + đặt lại mật khẩu), `engage.ts` (yêu thích, đánh giá).
- `lib/booking.ts` – lõi nghiệp vụ: `holdingWhere`, `bookedQuantity`, `blockedQuantity`, `unavailableQuantity` (**luôn dùng cái này để tính phòng trống**), `expireStaleBookings`, `needsRefund`, `paymentStatusAfterCancel`, `NEXT_STATUS`.
- `lib/cancellation.ts` (chính sách hủy, hàm thuần) · `lib/voucher.ts` (`checkVoucher`, `computeDiscount`) · `lib/password-reset.ts` · `lib/payments/{vnpay,apply}.ts` · `lib/email.ts` · `lib/rate-limit.ts`, `login-throttle.ts` · `lib/hotels.ts` (tìm kiếm, có cache).
- `app/api/` – `payments/vnpay/{ipn,return}`, `cron/expire-bookings`, `uploads`, `favorites`, `health`.
- `components/admin/` – form và nút của trang quản trị; `/admin/*` gồm hotels, bookings, reviews, users, vouchers.
- `tests/` – `unit/`, `integration/` (dùng DB `*_test` riêng, tự migrate; `resetDb` trong `tests/helpers/db.ts` phải liệt kê mọi bảng mới), `perf/` (chỉ chạy với `npm run test:perf`).

## Quy tắc nghiệp vụ cần nhớ (chi tiết ở README mục 7)
- Giá luôn tính ở server. `Booking.totalPrice` = số tiền khách phải trả **sau giảm giá**; `discount` + `voucherCode` lưu phần giảm.
- Đơn mới `PENDING`, giữ phòng 30 phút (`PENDING_HOLD_MINUTES`); quá hạn thì nhả phòng ngay (qua `holdingWhere`) và được chuyển `CANCELLED` bởi `expireStaleBookings`.
- Tạo đơn, xác nhận, áp kết quả cổng thanh toán đều trong giao dịch **Serializable**.
- Hủy: tiền hoàn tính bằng `cancelQuote` theo `Hotel.freeCancelDays` / `lateCancelFeePercent`, lưu `Booking.refundAmount`. `refundAmount = 0` nghĩa là không có gì để hoàn. `needsRefund(status, paymentStatus, refundAmount)`. Admin hủy = hoàn đủ.
- Lượt dùng voucher **không có bộ đếm**: đếm các đơn có `voucherCode` đang giữ chỗ hoặc `COMPLETED`.
- Phòng bị chặn (`RoomBlock`) tính theo từng đêm (`maxBlockedRooms`), ngày kết thúc lưu dạng nửa mở (+1 ngày).
- Đánh giá chỉ cho khách có đơn `COMPLETED` tại khách sạn đó.

## Trạng thái (cập nhật: 2026-10-20)
Đã xong và đã push (commit `37d9f76`): tìm kiếm/lọc, đặt phòng, VNPay sandbox, email xác nhận, yêu thích, đánh giá + kiểm duyệt, admin có biểu đồ, tải ảnh, hoàn tiền, test tự động, throttle đăng nhập, SEO, Docker; và đợt nghiệp vụ mới: hết hạn đơn, chính sách hủy/hoàn tiền, quên mật khẩu, voucher, chặn phòng.

Chưa làm/chưa kiểm:
- **Chưa thử các màn hình mới trên trình duyệt** (đặt phòng có voucher, hủy có phí, `/admin/vouchers`, chặn phòng, quên mật khẩu). Chỉ mới có test + build.
- `CRON_SECRET` chưa có trong `web/.env`; cron gọi `/api/cron/expire-bookings` chưa được lập lịch trong `deploy/`.
- Hiển thị chính sách hủy trên trang chi tiết khách sạn và trang đặt phòng (mới hiện ở chi tiết đơn).
- Nếu đổi sang thanh toán qua VNPay có voucher: chưa thử end-to-end `amount` = `totalPrice` sau giảm.

## Việc tiếp theo (backlog theo thứ tự đề xuất)
1. Kiểm tra bằng tay các màn hình mới (dùng trình duyệt tích hợp), sửa lỗi giao diện nếu có; thêm `CRON_SECRET` vào `.env`/`deploy/` và hướng dẫn cron.
2. Hiện chính sách hủy ở trang khách sạn và trang đặt phòng.
3. Email khi hủy đơn / hoàn tiền xong, và email nhắc trước ngày nhận phòng.
4. Trạng thái nhận phòng/trả phòng thực tế (check-in/check-out) cho admin.
5. Giá động (cuối tuần, mùa cao điểm, giảm theo số đêm) và thuế/phí dịch vụ.
6. Thông tin người ở khác người đặt, yêu cầu hóa đơn VAT.
7. Sửa đổi đơn (đổi ngày/phòng); vai trò chủ khách sạn (HOST); đa ngôn ngữ — để cuối, tốn nhiều công.
