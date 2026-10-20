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

Đã kiểm tra bằng trình duyệt thật (2026-10-20): quên/đặt lại mật khẩu (token dùng lại bị từ chối), tạo voucher, mã sai/đúng và mức giảm trên form đặt phòng, đơn có voucher, trang thanh toán đúng số tiền sau giảm, hủy muộn tính phí và hoàn một phần, chặn phòng làm phòng "Hết phòng", cron hết hạn đơn (401 khi sai khóa). Đã sửa lỗi `new Date()` ở `/reset-password` (thêm `connection()`).

Đợt hoàn thiện sau đó (2026-10-20): VNPay sandbox đã thử thật thành công (khóa trong `web/.env`, thanh toán NCB, đơn xác nhận); dịch vụ `cron` trong `docker-compose.prod.yml` gọi `/api/cron/expire-bookings` mỗi 5 phút; chính sách hủy hiện ở trang khách sạn, trang đặt phòng và trang thanh toán; trang thanh toán tách dòng giảm giá; email hủy đơn (`sendBookingCancelled`) và email báo đã hoàn tiền (`sendRefundCompleted`).

Đợt cuối (2026-10-20): trang `/account` sửa hồ sơ + đổi mật khẩu (`updateProfileAction`, `changePasswordAction`); check-in/check-out thực tế (`Booking.checkedInAt/checkedOutAt`, `checkInBookingAction`, nút "Nhận phòng" ở admin; đã nhận phòng thì không hủy được). Đã thử trên trình duyệt. Test mới: `tests/integration/account-and-checkin.test.ts` (mock `@/lib/session`, `@/auth`, `next-auth`, `next/server`).

**Quyết định phạm vi:** dự án là đồ án thực tập tốt nghiệp (báo cáo, KHÔNG kinh doanh thật). Dừng thêm tính năng; ưu tiên kịch bản demo và tài liệu báo cáo. Đừng đề xuất thuê VPS/SMTP/hợp đồng VNPay thật trừ khi chủ dự án hỏi.

Chưa làm/chưa kiểm:
- **IPN VNPay chưa thử** (cần tunnel/địa chỉ công khai và đăng ký URL IPN với VNPay); mới thử luồng quay về trình duyệt.
- Chưa thử VNPay với đơn có voucher và với trường hợp hủy giữa chừng trên trang VNPay.
- Dịch vụ `cron` trong compose mới kiểm cú pháp bằng `docker compose config`, chưa chạy thật trên VPS.
- Chưa thử gửi email thật (chưa cấu hình SMTP); mới có test cho phần dựng nội dung.

## Mẹo chạy thử giao diện
- `.claude/launch.json` có cấu hình `web`; nếu cổng 3000 bận (có thể có server khác) nó tự đổi sang 3001. `APP_URL` trong `.env` là 3000 nên liên kết đặt lại mật khẩu in ra console phải đổi cổng cho khớp.
- Tài khoản mẫu ở README mục 4. Chỉ dùng cho DB dev; dọn dữ liệu thử sau khi xong (đơn, voucher, lịch chặn).
- Trong công cụ trình duyệt, nút submit đôi khi cần bấm bằng `ref` thay vì tọa độ; ô nhập React nên gõ bằng thao tác `type` để state cập nhật.

## Việc tiếp theo (backlog theo thứ tự đề xuất)
1. **Kịch bản demo** từng bước kèm dữ liệu mẫu sạch (khách + admin), và tóm tắt điểm nhấn kỹ thuật để báo cáo (chống đặt trùng phòng bằng giao dịch Serializable, chữ ký VNPay, giới hạn tốc độ, phân quyền).
2. **Tài liệu báo cáo**: use case, sơ đồ tuần tự đặt phòng + thanh toán, bảng kết quả kiểm thử (285 test), ảnh chụp màn hình.
3. Tùy chọn, chỉ khi chủ dự án muốn: giá động (cuối tuần, mùa cao điểm), email nhắc nhận phòng, thông tin người ở/hóa đơn, IPN VNPay qua tunnel.
