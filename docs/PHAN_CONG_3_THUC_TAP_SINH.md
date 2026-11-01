# Phân công 3 thực tập sinh kỹ thuật phần mềm (10 tuần)

Tài liệu này chia dự án **Không Gian Số Stay** cho ba thực tập sinh cùng chuyên ngành kỹ thuật phần mềm. Cả ba đều là lập trình viên: mỗi người **làm trọn chu trình** (phân tích, thiết kế, lập trình, kiểm thử) cho một mảng nghiệp vụ, và nghiên cứu sâu một chủ đề kỹ thuật xuyên suốt. Không chia theo vai trò BA/Dev/QA, để mỗi người có sản phẩm riêng để trình bày.

Tài liệu đi kèm: [QUY_TAC_NGHIEP_VU.md](QUY_TAC_NGHIEP_VU.md) (danh mục quy tắc có mã BR-xx), [ADR.md](ADR.md) (các quyết định kiến trúc đã có), [KICH_BAN_DEMO.md](KICH_BAN_DEMO.md).

## 1. Ma trận phân công

| | Mảng nghiệp vụ | Chủ đề kỹ thuật nghiên cứu sâu |
|---|---|---|
| **Người 1** | Tồn kho phòng, giá, khuyến mãi, tìm kiếm | Đồng thời và hiệu năng |
| **Người 2** | Thanh toán, hủy/hoàn, không đến, đối soát, khiếu nại | Tính đúng đắn và độ tin cậy |
| **Người 3** | Đối tác, quầy lễ tân, đánh giá, trợ lý AI, thông báo | Bảo mật, kiến trúc và triển khai |

## 2. Quyền sở hữu mã nguồn

Mỗi người chịu trách nhiệm chính (viết, sửa, đảm bảo test) với các tệp dưới đây. Sửa tệp của người khác thì mở PR và nhờ chủ tệp duyệt.

**Người 1**
- `lib/booking.ts` (phần tính phòng trống: `holdingWhere`, `bookedQuantity`, `blockedQuantity`, `unavailableQuantity`), `lib/booking-create.ts`
- `lib/pricing.ts`, `lib/pricing-db.ts`, `lib/voucher.ts`, `lib/occupancy.ts`, `lib/hotels.ts`, `lib/map.ts`
- `app/actions/booking.ts`: `createBookingAction`, `previewVoucherAction`, `rescheduleBookingAction`
- `app/actions/admin.ts`: phần phòng, chặn phòng, quy tắc giá, mã giảm giá
- Test: `tests/perf`, `booking-concurrency`, `pricing`, `hotels-search`

**Người 2**
- `lib/cancellation.ts`, `lib/lifecycle.ts`, `lib/settlement.ts`, `lib/dispute.ts`, `lib/csv.ts`, `lib/payments/*`
- `app/actions/payment.ts`, `dispute.ts`, `partner.ts` (đợt chi trả), `booking.ts`: `payBookingAction`, `cancelBookingAction`
- `app/actions/admin.ts`: `updateBookingStatusAction`, `markNoShowAction`, `markRefundedAction`
- `app/api/payments/*`, `app/api/export/*`, `app/api/cron/*`
- Test: `payments-apply`, `disputes`, `noshow-reschedule`, `settlement-promo`, `properties`

**Người 3**
- `lib/access.ts`, `lib/session.ts`, `lib/role-routing.ts`, `proxy.ts`, `lib/audit.ts`, `lib/notify.ts`, `lib/ticket.ts`, `lib/email.ts`, `lib/rate-limit.ts`, `lib/login-throttle.ts`, `lib/assistant/*`
- `app/actions/auth.ts`, `engage.ts`, `assistant.ts`, `notifications.ts`, `partner.ts` (duyệt khách sạn, hoa hồng, gán chủ)
- `app/actions/admin.ts`: khách sạn, đánh giá, người dùng, `checkInBookingAction`, `lookupTicketAction`
- `app/api/assistant`, `uploads`, `admin/uploads`, `favorites`, `health`; CI, Docker
- Test: `authz-matrix`, `uploads-route`, `ticket`, `assistant`, `rate-limit`, `reviews-audit-export`

**Dùng chung (cần cả nhóm đồng ý trước khi sửa):** `prisma/schema.prisma` và migration, `NEXT_STATUS` trong `lib/booking.ts`, `components/root-shell.tsx`.

**Đề xuất tuần 1–2:** tệp `app/actions/admin.ts` đang gom hầu hết thao tác quản trị nên ba người dễ sửa đụng nhau. Nên tách thành `admin/hotels.ts`, `admin/bookings.ts`, `admin/pricing.ts`, `admin/users.ts` trước khi bắt đầu tính năng mới.

## 3. Quyền ghi cột của bảng Booking

Bảng `Booking` là điểm chung của cả ba. Mỗi cột có một người chịu trách nhiệm ghi; người khác chỉ đọc.

| Người | Cột được ghi |
|---|---|
| 1 | `code`, `roomId`, `checkIn`, `checkOut`, `guests`, `rooms`, `totalPrice`, `discount`, `voucherCode`, `commissionPercent`, `dateChanges` (lúc đặt và đổi ngày) |
| 2 | `status`, `paymentStatus`, `refundAmount`, `cancelledAt`, `noShow`, `payoutId` |
| 3 | `checkedInAt`, `checkedOutAt` (quầy lễ tân) |

Bảng khác: `Payment`, `Payout`, `Dispute` thuộc Người 2; `PriceRule`, `RoomBlock`, `Voucher` thuộc Người 1; `Hotel.approval`, `Notification`, `AuditLog`, `Review`, `User.role` thuộc Người 3.

## 4. Quy trình cho mỗi công việc

1. **Nhận issue:** có mô tả, tiêu chí chấp nhận, người phụ trách.
2. **Phân tích:** thêm hoặc sửa quy tắc BR-xx trong [QUY_TAC_NGHIEP_VU.md](QUY_TAC_NGHIEP_VU.md); vẽ use case nếu là luồng mới.
3. **Thiết kế:** sơ đồ tuần tự, trạng thái hoặc ERD. Có lựa chọn kỹ thuật quan trọng thì thêm một mục vào [ADR.md](ADR.md).
4. **Làm trên nhánh riêng:** `feature/<tên>-<việc>`. Sửa CSDL: `npx prisma migrate dev --name <tên> --create-only` rồi `npx prisma migrate deploy`; mỗi lúc chỉ một PR đụng vào migration, rebase trước khi gộp.
5. **Viết test cùng lúc với mã:** hàm thuần thì test đơn vị (và test thuộc tính nếu có bất biến), luồng có CSDL thì test tích hợp. Mọi bảng mới phải được thêm vào `resetDb`.
6. **Chạy cổng chất lượng** trong `web/`: `npm run typecheck`, `npm run lint`, `npm test`, và `npm run build` nếu đụng route hoặc cấu hình. CI (`.github/workflows/ci.yml`) chạy lại đúng các lệnh này trên mỗi PR.
7. **Mở PR, một người khác duyệt** theo vòng Người 1 → 2 → 3 → 1. Duyệt xong mới gộp.
8. **Cập nhật tài liệu:** BR, ADR, `CLAUDE.md`/README nếu đổi hành vi.
9. **Demo cuối tuần** cho nhóm.

**Định nghĩa "xong":** có test, qua cổng chất lượng, đã được duyệt chéo, tài liệu đã cập nhật.

**Nhịp tuần:** thứ Hai họp kế hoạch 30 phút; mỗi ngày nhắn ba dòng (đã làm, sẽ làm, đang vướng); thứ Sáu demo và rút kinh nghiệm. Vai trò điều phối luân phiên theo tuần (giữ nhịp họp, gom lỗi, quyết các thay đổi vào tệp dùng chung).

## 5. Kế hoạch 10 tuần

| Tuần | Người 1: tồn kho, giá, tìm kiếm | Người 2: tiền | Người 3: đối tác, bảo mật, AI |
|---|---|---|---|
| 1 | Chạy dự án, đọc `lib/booking.ts`, `pricing.ts`; vẽ luồng hiện tại; so sánh cách tìm phòng và tính giá của Booking/Agoda | Chạy dự án, đọc `lib/payments`, `cancellation.ts`, `settlement.ts`; so sánh mô hình OTA (merchant / agency) và chính sách hủy | Chạy dự án, đọc `access.ts`, `session.ts`, `proxy.ts`, `ticket.ts`, `assistant/`; xem trang quản lý đối tác của sàn khác |
| 2 | Hoàn thiện BR cho tồn kho, giá, voucher, chặn phòng; đo hiệu năng gốc | Hoàn thiện BR thanh toán, hủy, hoàn, đối soát, khiếu nại; bảng quyết định hủy; máy trạng thái của đơn | Hoàn thiện BR đối tác, quầy, đánh giá, trợ lý; ma trận vai trò × hành động; tách `admin.ts` |
| 3 | ERD phòng/giá/voucher; sơ đồ tuần tự hai khách giành phòng cuối; ADR mức cô lập | Sơ đồ tuần tự VNPay (return URL và IPN); ERD đợt chi trả, khiếu nại; ADR idempotency | Ma trận phân quyền, sơ đồ quét vé, mô hình đe dọa sơ bộ; ADR |
| 4 | Tái hiện đua tranh bằng test; so sánh Read Committed, Serializable, khóa hàng; thí nghiệm đo | Liệt kê bất biến về tiền; mở rộng test thuộc tính; ghi lỗi tìm được | Rà từng server action theo OWASP; mở rộng ma trận phân quyền; danh sách lỗ hổng |
| 5 | Cải tiến 1: giá động theo số ngày đặt trước hoặc công suất (hàm thuần mới + test) | IPN thật qua tunnel; thử các ca trả muộn, lặp | Vé QR: nhật ký quét, hết hạn vé; test |
| 6 | Cải tiến 2: voucher xếp chồng, giới hạn theo người dùng, hoặc xếp hạng tìm kiếm | Kiểm tra khớp tổng đối soát, báo cáo chênh lệch | Trợ lý AI: bộ câu hỏi mẫu để chấm, test tiêm lệnh, đo tỷ lệ đúng |
| 7 | Chỉ mục, EXPLAIN, test tải, cache; số liệu trước/sau | Hàng đợi gửi thông báo/email (outbox) | Docker, log, quan sát hệ thống; rà lại giới hạn tần suất |
| 8 | Hoàn thiện, bổ sung test, tài liệu | Khiếu nại: hạn phản hồi, nhắc việc; test | Đánh giá (chống giả), thông báo; hoàn thiện |
| 9 | Kiểm thử chéo toàn bộ luồng: đặt → trả → nhận → hoàn tất → đối soát | như bên trái | như bên trái |
| 10 | Báo cáo và demo | Báo cáo và demo | Báo cáo và demo |

Điểm kiểm tra chung: **cuối tuần 2** chốt sở hữu tệp và quyền ghi cột; **cuối tuần 5** đánh giá giữa kỳ, chuyển việc nếu ai bị chậm; **tuần 9** kiểm thử tích hợp.

## 6. Sản phẩm mỗi người nộp

1. Đặc tả yêu cầu mảng của mình, kèm danh sách BR.
2. Sơ đồ UML và ERD.
3. Hai đến ba ADR.
4. Kế hoạch kiểm thử và số liệu độ phủ.
5. Một báo cáo thí nghiệm có số liệu thuộc chủ đề kỹ thuật của mình.
6. Danh sách PR đã gộp, làm bằng chứng đóng góp.

## 7. Hiện trạng kiểm chứng ban đầu (ngày 2026-10-30)

Trước khi giao việc, dự án đã được kiểm lại để cả nhóm bắt đầu từ cùng một mốc. Số liệu đo trên máy phát triển (PostgreSQL cục bộ), chỉ có giá trị so sánh tương đối, không phải số liệu vận hành thật.

**Kiểm thử tự động:** có thêm `tests/unit/properties.test.ts` (18 bất biến, thư viện `fast-check`): phí + tiền hoàn luôn bằng số đã trả; giảm giá không vượt tổng tiền; giá mỗi đêm không thấp hơn 10.000 ₫ và cộng được theo khoảng; hoa hồng + tiền chi trả bằng doanh thu; đơn hoàn tất bảo toàn tiền (khách trả + khuyến mãi sàn chịu = doanh thu tính cho đối tác); luật đổi ngày. Chưa tìm thấy lỗi nào trong các hàm này.

**Phân quyền:** rà toàn bộ server action và route API; thêm `tests/integration/authz-matrix.test.ts` thử từng thao tác bằng người không có quyền rồi kiểm dữ liệu không đổi. Kết quả: phía máy chủ kiểm quyền đúng. Tìm thấy **một lỗi chức năng**: route tải ảnh `/api/admin/uploads` chỉ cho quản trị viên, trong khi form khách sạn và phòng của đối tác dùng chung bộ tải ảnh này, nên đối tác tải ảnh lên bị từ chối. Đã sửa cho phép đối tác (không cho khách thường) và có test `uploads-route.test.ts`.

**Hiệu năng** (`npm run test:perf`, 300 khách sạn, 900 phòng, 40.000 đơn): trung vị 5 lần chạy, tìm khách sạn không lọc 99 đến 177 ms, tìm có ngày 101 đến 169 ms, tổng quan quản trị 90 ngày 84 đến 95 ms (khác nhau giữa các lần chạy), tính phòng trống một loại phòng 1 ms. Bốn truy vấn báo cáo đều dùng chỉ mục. Chưa có bằng chứng cần thêm chỉ mục.

**Cải tiến có đo đạc (2026-11-01):** tạo đơn nay tự thử lại tối đa 10 lần khi giao dịch Serializable bị hủy do xung đột (`createPendingBooking`, tham số `maxAttempts` chỉ để thí nghiệm). Thí nghiệm `tests/perf/concurrency.test.ts` (chạy bằng `npm run test:perf`, kết quả lưu ở `docs/data/concurrency.json`) với 20 khách cùng đặt một loại phòng đủ chỗ: 1 lần thử được 2 đơn, 4 lần thử 8,4 đơn, 10 lần thử 19,2 đơn; không cấu hình nào bán vượt. Đo ở máy phát triển, tối đa 20 khách. Người 1 có thể mở rộng: so sánh với khóa hàng, tải lớn hơn, hàng đợi cho loại phòng bán chạy.

**Đã có sẵn, không cần làm lại:** CI (`.github/workflows/ci.yml`: typecheck, lint, test, build, kèm PostgreSQL); IPN lặp, hai yêu cầu đồng thời, trả muộn khi đơn đã hết hạn (`payments-apply.test.ts`); chặn quét vé lại (điều kiện `checkedInAt: null` trong cùng câu `updateMany`).

**Chưa làm, để thực tập sinh nghiên cứu:** giá động theo số ngày đặt trước/công suất (cần quyết định sản phẩm và thêm cột dữ liệu); IPN VNPay thật qua địa chỉ công khai; hàng đợi gửi thông báo; hạn phản hồi khiếu nại; iCal/channel manager.
