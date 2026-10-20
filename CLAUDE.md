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

## Định hướng sản phẩm (đã chốt với chủ dự án, 2026-10-20)
**Sàn đặt phòng trung gian (OTA nhỏ)**, không phải một khách sạn riêng. Ba bên: khách (`USER`), đối tác khách sạn (`HOST`), sàn (`ADMIN`). Khu vực đối tác ở `/host/*`, đăng ký ở `/partner/register`, giới thiệu ở `/partner`. Chi tiết ở README mục 7 ("Sàn trung gian, đối tác và đối soát"). Quyền theo khách sạn: luôn dùng `canManageHotel/Room/Booking` (`src/lib/access.ts`) và `requireStaff/requireHost/requireAdmin` (`src/lib/session.ts`) trong server action; **không chỉ ẩn nút**. Phần trang dùng chung giữa admin và đối tác: `components/admin/{hotel-editor,hotels-view,bookings-view}.tsx`. Đối soát: `lib/settlement.ts` + `actions/partner.ts`. Tài khoản mẫu đối tác: `doitac@khongiansos.vn` / `Doitac@123456` (`prisma/seed-partner.ts` cho DB có sẵn).

## Quy tắc nghiệp vụ cần nhớ (chi tiết ở README mục 7)
- Giá luôn tính ở server. `Booking.totalPrice` = số tiền khách phải trả **sau giảm giá**; `discount` + `voucherCode` lưu phần giảm.
- Đơn mới `PENDING`, giữ phòng 30 phút (`PENDING_HOLD_MINUTES`); quá hạn thì nhả phòng ngay (qua `holdingWhere`) và được chuyển `CANCELLED` bởi `expireStaleBookings`.
- Tạo đơn, xác nhận, áp kết quả cổng thanh toán đều trong giao dịch **Serializable**.
- Hủy: tiền hoàn tính bằng `cancelQuote` theo `Hotel.freeCancelDays` / `lateCancelFeePercent`, lưu `Booking.refundAmount`. `refundAmount = 0` nghĩa là không có gì để hoàn. `needsRefund(status, paymentStatus, refundAmount)`. Admin hủy = hoàn đủ.
- Lượt dùng voucher **không có bộ đếm**: đếm các đơn có `voucherCode` đang giữ chỗ hoặc `COMPLETED`.
- Phòng bị chặn (`RoomBlock`) tính theo từng đêm (`maxBlockedRooms`), ngày kết thúc lưu dạng nửa mở (+1 ngày).
- Đánh giá chỉ cho khách có đơn `COMPLETED` tại khách sạn đó.
- Khách sạn đối tác: `ownerId` + `approval` (PENDING/APPROVED/REJECTED) + `commissionPercent`; chưa duyệt thì `isActive = false` (nên các truy vấn công khai không cần biết đến `approval`). `Booking.commissionPercent` được chốt lúc đặt (0 nếu khách sạn của sàn). Doanh thu đối soát = `settlementGross` (đơn hoàn tất: đủ tiền; hủy muộn: phần phí giữ lại). `Payout` gom đơn, đơn gắn bằng `payoutId = null`.
- Đối tác không được: xác nhận đã nhận tiền (CONFIRMED), hoàn tiền, đặt hoa hồng, duyệt khách sạn.

## Trạng thái (cập nhật: 2026-10-20)
Đã xong và đã push (commit `37d9f76`): tìm kiếm/lọc, đặt phòng, VNPay sandbox, email xác nhận, yêu thích, đánh giá + kiểm duyệt, admin có biểu đồ, tải ảnh, hoàn tiền, test tự động, throttle đăng nhập, SEO, Docker; và đợt nghiệp vụ mới: hết hạn đơn, chính sách hủy/hoàn tiền, quên mật khẩu, voucher, chặn phòng.

Đã kiểm tra bằng trình duyệt thật (2026-10-20): quên/đặt lại mật khẩu (token dùng lại bị từ chối), tạo voucher, mã sai/đúng và mức giảm trên form đặt phòng, đơn có voucher, trang thanh toán đúng số tiền sau giảm, hủy muộn tính phí và hoàn một phần, chặn phòng làm phòng "Hết phòng", cron hết hạn đơn (401 khi sai khóa). Đã sửa lỗi `new Date()` ở `/reset-password` (thêm `connection()`).

Đợt hoàn thiện sau đó (2026-10-20): VNPay sandbox đã thử thật thành công (khóa trong `web/.env`, thanh toán NCB, đơn xác nhận); dịch vụ `cron` trong `docker-compose.prod.yml` gọi `/api/cron/expire-bookings` mỗi 5 phút; chính sách hủy hiện ở trang khách sạn, trang đặt phòng và trang thanh toán; trang thanh toán tách dòng giảm giá; email hủy đơn (`sendBookingCancelled`) và email báo đã hoàn tiền (`sendRefundCompleted`).

Đợt cuối (2026-10-20): trang `/account` sửa hồ sơ + đổi mật khẩu (`updateProfileAction`, `changePasswordAction`); check-in/check-out thực tế (`Booking.checkedInAt/checkedOutAt`, `checkInBookingAction`, nút "Nhận phòng" ở admin; đã nhận phòng thì không hủy được). Đã thử trên trình duyệt. Test mới: `tests/integration/account-and-checkin.test.ts` (mock `@/lib/session`, `@/auth`, `next-auth`, `next/server`).

**Quyết định phạm vi:** dự án là đồ án thực tập tốt nghiệp (báo cáo, KHÔNG kinh doanh thật). Dừng thêm tính năng; ưu tiên kịch bản demo và tài liệu báo cáo. Đừng đề xuất thuê VPS/SMTP/hợp đồng VNPay thật trừ khi chủ dự án hỏi.

**Giao diện (2026-10-20):** đã làm lại theo phong cách "biển nhiệt đới + tạp chí du lịch": token màu ở `web/src/app/globals.css` (`brand` xanh ngọc, `ink` xanh đêm, `sun` san hô cho nút chính, `accent` vàng cho sao, nền cát), phông chữ có chân Playfair Display (`font-display`) cho tiêu đề + Be Vietnam Pro cho nội dung. Trang chủ: hero tối có ảnh hình vòm, ô tìm kiếm nổi, 4 lợi ích, lưới điểm đến kiểu bento, thẻ khách sạn lấy ảnh làm trọng tâm, khối số liệu thật (`getSiteStats`), đánh giá, CTA. **Ảnh mẫu là ảnh thật Unsplash** (trước đó là picsum ngẫu nhiên, nhìn như trang sách/cánh đồng): bộ ảnh theo khách sạn/loại phòng ở `web/prisma/photos.ts`, `seed.ts` dùng nó; DB đã có sẵn thì chạy `npx tsx prisma/update-images.ts --apply` (chỉ thay ảnh còn là picsum, không đụng ảnh admin tải lên). Phong cách đã áp dụng cho: đăng nhập/đăng ký (`auth-shell.tsx` có ảnh bên trái), đặt phòng + thanh toán (thanh các bước `components/booking-steps.tsx`, nút chính màu `sun`), danh sách/chi tiết đơn (có ảnh phòng), khung admin (menu tối `bg-ink`, đầu bảng `bg-sand`). Quy ước: tiêu đề trang `font-display text-3xl font-semibold`, thẻ `rounded-3xl border border-border bg-white`, nút hành động chính `bg-sun`, nút phụ/liên kết `brand`. Đừng viết cứng số liệu (điểm đánh giá, số khách sạn) vào giao diện; lấy từ DB. Sau khi sửa token/CSS mà trình duyệt vẫn hiện kiểu cũ thì khởi động lại server dev. Đã thêm `connection()` vào `getCurrentUser` để hết lỗi `new Date()` khi prerender ở dev.

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
1. **Ảnh chụp màn hình** các màn hình chính (khách, đối tác, admin) cho báo cáo. Tài liệu `docs/` đã cập nhật theo mô hình sàn trung gian (có sơ đồ đối tác/đối soát đã kiểm cú pháp Mermaid).
2. Chạy thử trọn kịch bản demo (`docs/KICH_BAN_DEMO.md`, bước 7b mới) trên bản `npm run build && npm run start`.
3. Tùy chọn: email cho đối tác khi có đơn mới / khi được chi trả; đối tác tự gửi yêu cầu chi trả; hoa hồng mặc định cấu hình ở một chỗ; thống kê doanh thu theo kỳ cho đối tác.
4. Tùy chọn, chỉ khi chủ dự án muốn: giá động, IPN VNPay qua tunnel, email nhắc nhận phòng.
