# Danh mục quy tắc nghiệp vụ (BR)

Mỗi quy tắc có một mã để trích dẫn trong issue, PR, test và báo cáo. Cột "Nơi thi hành" chỉ vào mã nguồn chịu trách nhiệm; cột "Test" là nơi kiểm chứng. Thêm hoặc đổi hành vi thì cập nhật tệp này cùng PR.

Tiền tố mã: **TK** = tồn kho, giá, khuyến mãi (Người 1); **TC** = tiền (Người 2); **VH** = đối tác, vận hành, tin cậy (Người 3). Xem [PHAN_CONG_3_THUC_TAP_SINH.md](PHAN_CONG_3_THUC_TAP_SINH.md).

## TK: Tồn kho, giá, khuyến mãi

| Mã | Quy tắc | Nơi thi hành | Test |
|---|---|---|---|
| BR-TK-01 | Phòng trống tính theo **từng đêm** trong khoảng [nhận phòng, trả phòng). Số phòng không bán được = phòng đang bị đơn giữ + phòng bị chặn. Luôn dùng `unavailableQuantity`. | `lib/booking.ts` | `booking-lib`, `booking-concurrency` |
| BR-TK-02 | Đơn mới ở trạng thái `PENDING` và giữ phòng 30 phút (`PENDING_HOLD_MINUTES`). Quá hạn thì nhả phòng ngay (qua `holdingWhere`) và được chuyển `CANCELLED` bởi `expireStaleBookings`. | `lib/booking.ts`, cron | `booking-lib`, `business-rules` |
| BR-TK-03 | Tạo đơn, xác nhận và áp kết quả cổng thanh toán chạy trong giao dịch **Serializable**. Không bán vượt số phòng, kể cả khi nhiều khách đặt cùng lúc. Khi tạo đơn gặp xung đột giao dịch thì tự thử lại tối đa 10 lần (kiểm tra lại phòng trống mỗi lần); chỉ báo "hệ thống bận, thử lại" khi hết số lần thử. | `lib/booking-create.ts`, `actions/admin.ts`, `lib/payments/apply.ts` | `booking-concurrency`, `perf/concurrency` |
| BR-TK-04 | Kỳ lưu trú từ 1 đến 30 đêm. | `parseStay` | `business-rules` |
| BR-TK-05 | Phòng bị chặn (`RoomBlock`) tính theo từng đêm, lấy số phòng chặn lớn nhất trong kỳ. Ngày kết thúc lưu dạng nửa mở (+1 ngày). Không chặn khoảng đã qua, tối đa 1 năm mỗi lần, không quá số phòng của loại phòng. | `maxBlockedRooms`, `createRoomBlockAction` | `business-rules`, `admin-tools` |
| BR-TK-06 | Giá một đêm = giá gốc × (100 + phụ thu cuối tuần nếu là đêm thứ Sáu/Bảy + tổng % các quy tắc giá trùng đêm đó) / 100, **tối thiểu 10.000 ₫**. Mọi nơi tính tiền dùng `stayPrice`, không nhân `pricePerNight * nights`. | `lib/pricing.ts` | `pricing`, `properties` |
| BR-TK-07 | Phụ thu cuối tuần từ −50% đến +200%. Giá gốc từ 10.000 ₫ đến 100.000.000 ₫. | `roomSchema` | `pricing` |
| BR-TK-08 | Quy tắc giá theo mùa/ngày lễ: điều chỉnh từ −50% đến +200%, khác 0%, tối đa 1 năm mỗi quy tắc, tối đa 30 quy tắc mỗi loại phòng, không đặt cho khoảng đã qua. `endDate` lưu dạng nửa mở. | `createPriceRuleAction` | `pricing` (tích hợp) |
| BR-TK-09 | Giá luôn tính ở máy chủ và được chốt vào `Booking.totalPrice` lúc đặt. Đổi giá phòng sau đó không ảnh hưởng đơn đã đặt. | `createPendingBooking` | `pricing`, `business-rules` |
| BR-TK-10 | `Booking.totalPrice` là số tiền khách phải trả **sau giảm giá**; `discount` và `voucherCode` lưu phần giảm. | `createPendingBooking` | `business-rules` |
| BR-TK-11 | Mã giảm giá giảm theo % hoặc số tiền, có thể có mức giảm tối đa; số tiền giảm không bao giờ vượt tổng tiền và không âm. Có đơn tối thiểu, thời hạn, giới hạn tổng lượt và giới hạn theo người dùng. | `lib/voucher.ts` | `properties`, `business-rules` |
| BR-TK-12 | Lượt dùng mã **không có bộ đếm**: đếm các đơn có `voucherCode` đang giữ chỗ hoặc `COMPLETED`. Đơn hủy hoặc hết hạn tự trả lại lượt. | `checkVoucher` | `business-rules` |
| BR-TK-13 | Đổi ngày ở: chỉ một lần, trước ngày nhận phòng, chưa nhận phòng. Đơn đã thanh toán chỉ đổi được khi còn trong hạn hủy miễn phí. Đơn đã thanh toán hoặc có mã chỉ đổi sang khoảng ngày **cùng giá**. Kiểm phòng trống không tính chính đơn đó. | `checkReschedule`, `rescheduleBookingAction` | `lifecycle`, `properties`, `noshow-reschedule` |

## TC: Tiền

| Mã | Quy tắc | Nơi thi hành | Test |
|---|---|---|---|
| BR-TC-01 | Khách hủy: hủy trước ngày nhận phòng ít nhất `freeCancelDays` (0–60) ngày thì hoàn đủ; muộn hơn thì khách sạn giữ `lateCancelFeePercent`% (0–100) số tiền đã trả. Đơn chưa trả tiền thì không có phí. Phí + tiền hoàn luôn bằng số đã trả. | `lib/cancellation.ts` | `properties`, `business-rules` |
| BR-TC-02 | `refundAmount = 0` nghĩa là không có gì để hoàn. Cần hoàn tiền khi `needsRefund(status, paymentStatus, refundAmount)`. | `lib/booking.ts` | `business-rules` |
| BR-TC-03 | Quản trị viên hoặc khách sạn hủy đơn là quyết định phía khách sạn nên **hoàn đủ** số đã trả. | `updateBookingStatusAction` | `business-rules`, `marketplace` |
| BR-TC-04 | Đơn đã ghi nhận nhận phòng thì không hủy được; chỉ hoàn tất khi khách trả phòng. | `cancelBookingAction`, `updateBookingStatusAction` | `account-and-checkin` |
| BR-TC-05 | Kết quả từ cổng thanh toán được xử lý **idempotent**: mỗi giao dịch chỉ xử lý đúng một lần (chuyển `PENDING` → `SUCCESS/FAILED` có điều kiện). Không thấy giao dịch → `01`; sai số tiền → `04`; đã xử lý → `02`; xung đột giao dịch → `99` để cổng gọi lại. | `lib/payments/apply.ts` | `payments-apply` |
| BR-TC-06 | Tiền về nhưng đơn đã hủy hoặc phòng đã hết: đơn chuyển `CANCELLED`, `paymentStatus = PAID`, `refundAmount = totalPrice`, ghi chú "cần hoàn tiền thủ công". | `applyGatewayResult` | `payments-apply` |
| BR-TC-07 | Khách không đến: chỉ báo được cho đơn `CONFIRMED`, chưa nhận phòng, từ ngày sau ngày nhận phòng. Đơn chuyển `CANCELLED` kèm `noShow`; khách sạn giữ phí như hủy muộn, hoàn phần còn lại, phòng được nhả. | `canMarkNoShow`, `noShowQuote`, `markNoShowAction` | `lifecycle`, `properties`, `noshow-reschedule` |
| BR-TC-08 | Tự hoàn tất: đơn đã nhận phòng chuyển `COMPLETED` sau ngày trả phòng; đơn chưa nhận phòng chờ thêm 2 ngày (`NO_SHOW_REPORT_DAYS`) để khách sạn kịp báo không đến. Chạy ở cron và trước khi tạo đợt chi trả. | `completeFinishedStays` | `noshow-reschedule` |
| BR-TC-09 | Doanh thu đối soát của đơn: đơn `COMPLETED` = `totalPrice + discount` (giá **trước** giảm); đơn hủy muộn hoặc không đến đã thu tiền = `totalPrice − refundAmount`; các đơn khác bằng 0. Không bao giờ âm. | `settlementGross` | `settlement-promo`, `properties` |
| BR-TC-10 | Hoa hồng = làm tròn(doanh thu × % / 100), tỷ lệ **chốt lúc đặt** (`Booking.commissionPercent`); khách sạn của sàn là 0. Hoa hồng + tiền chi trả = doanh thu. | `splitGross` | `settlement-promo`, `properties`, `marketplace` |
| BR-TC-11 | Mã giảm giá do sàn tạo nên **sàn chịu**: chi phí khuyến mãi (`promoCost`) bằng `discount` của đơn hoàn tất; đối tác vẫn nhận đủ như khi khách không dùng mã. | `promoCost` | `settlement-promo`, `properties` |
| BR-TC-12 | Đợt chi trả gom các đơn chưa đối soát (`payoutId = null`) và các khoản trừ khiếu nại chưa gắn đợt. Đối tác nhận = tiền chi trả từ đơn − khoản trừ. Kết quả âm thì từ chối (`NEGATIVE`). Hai yêu cầu cùng lúc không chi trả trùng một đơn. | `createPayoutAction`, `netPayout` | `marketplace`, `disputes` |
| BR-TC-13 | Khiếu nại: mỗi đơn một khiếu nại. Số tiền sàn hoàn khách = phần đối tác chịu (trừ vào đợt chi trả) + phần sàn chịu. Với đơn bị ghi không đến, sàn chỉ hoàn thêm tối đa phần phí đã bị giữ. | `lib/dispute.ts`, `actions/dispute.ts` | `dispute`, `disputes` |

## VH: Đối tác, vận hành, tin cậy

| Mã | Quy tắc | Nơi thi hành | Test |
|---|---|---|---|
| BR-VH-01 | Ba vai trò `USER`, `HOST`, `ADMIN`. Mỗi vai trò chỉ dùng giao diện của mình; chuyển hướng theo vai trò ở `proxy.ts`. | `lib/role-routing.ts`, `proxy.ts` | `role-routing` |
| BR-VH-02 | Quyền theo từng khách sạn kiểm bằng `canManageHotel/Room/Booking` ở **máy chủ** trong mọi server action; không chỉ ẩn nút. Đối tác chỉ quản lý khách sạn do mình sở hữu. | `lib/access.ts` | `authz-matrix`, `marketplace` |
| BR-VH-03 | Khách sạn do đối tác tạo có `ownerId`, bị ẩn và chờ duyệt (`approval = PENDING`). Đối tác không tự bật hiển thị khi chưa được duyệt. Đối tác sửa khách sạn bị từ chối thì coi như gửi duyệt lại. | `createHotelAction`, `toggleHotelAction` | `marketplace` |
| BR-VH-04 | Chỉ quản trị viên mới được: duyệt/từ chối khách sạn (từ chối cần lý do), đặt hoa hồng (0–50%), gán chủ khách sạn (chỉ cho tài khoản đối tác), xác nhận đã nhận tiền, hoàn tiền, ẩn/xóa đánh giá, đổi vai trò người dùng, tạo đợt chi trả, quản lý mã giảm giá. | `actions/partner.ts`, `actions/admin.ts` | `marketplace`, `authz-matrix` |
| BR-VH-05 | Vé điện tử là `mã đặt phòng.chữ ký` (HMAC từ `AUTH_SECRET`), không đoán hay làm giả được. Quét vé chỉ để **tìm** đơn; quyền xử lý vẫn do `canManageHotel` quyết định, nên vé của khách sạn khác không dùng được. Lễ tân có thể gõ tay mã đặt phòng. | `lib/ticket.ts`, `lookupTicketAction` | `ticket`, `authz-matrix` |
| BR-VH-06 | Nhận phòng: chỉ đơn `CONFIRMED`, từ ngày nhận phòng đến trước ngày trả phòng, và chỉ một lần (điều kiện nằm trong cùng câu `updateMany` nên bấm đúp không ghi hai lần). | `checkInBookingAction` | `account-and-checkin`, `ticket` |
| BR-VH-07 | Chỉ khách có đơn `COMPLETED` tại khách sạn mới đánh giá được; mỗi khách một đánh giá cho mỗi khách sạn. Đối tác phản hồi đánh giá nhưng không ẩn/xóa. | `canReviewHotel`, `replyReviewAction` | `reviews-audit-export` |
| BR-VH-08 | Thao tác nhạy cảm phải ghi nhật ký `audit(...)` **sau khi thành công**. | `lib/audit.ts` | `reviews-audit-export` |
| BR-VH-09 | Thông báo trong ứng dụng và email gọi qua `after()` và không bao giờ ném lỗi, để việc gửi thất bại không làm hỏng nghiệp vụ chính. | `lib/notify.ts`, `lib/email.ts` | `notify-calendar` |
| BR-VH-10 | Trợ lý ảo chỉ có công cụ `search_rooms` (chỉ đọc); **không** có công cụ tạo đơn hay thanh toán. Đơn chỉ được tạo bởi hành động của khách ở trang xác nhận, dựa trên token đề xuất có ký số. | `lib/assistant/*`, `confirmProposalAction` | `assistant` |
| BR-VH-11 | Giới hạn tần suất yêu cầu và chặn đăng nhập sai nhiều lần. | `lib/rate-limit.ts`, `lib/login-throttle.ts` | `rate-limit` |
| BR-VH-12 | Tải ảnh lên dành cho quản trị viên và đối tác (không phải khách thường). Ảnh ngoài chỉ nhận URL https từ các máy chủ ảnh được phép. Ảnh 360° phải tỷ lệ 2:1. | `app/api/admin/uploads`, `lib/uploads.ts` | `uploads-route`, `uploads`, `panorama-upload` |
| BR-VH-13 | Xuất CSV chặn chèn công thức (`csvCell`) và chỉ trả dữ liệu thuộc phạm vi của người xuất (đối tác chỉ thấy đơn và đợt chi trả của khách sạn mình). | `lib/csv.ts`, `app/api/export/*` | `csv`, `reviews-audit-export`, `disputes` |
