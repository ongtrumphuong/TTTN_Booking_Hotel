# Quyết định kiến trúc (ADR)

Mỗi mục ghi lại một quyết định đã được áp dụng trong mã, lý do, và hệ quả. Thực tập sinh khi đổi một quyết định cần thêm mục mới (trạng thái "thay thế ADR-xx") thay vì sửa mục cũ. Mục "Cần nghiên cứu" gợi ý thí nghiệm có thể làm.

## ADR-001: Chống bán vượt phòng bằng giao dịch Serializable

- **Trạng thái:** đã áp dụng.
- **Bối cảnh:** hai khách có thể đặt cùng lúc loại phòng chỉ còn một phòng. Nếu mỗi giao dịch cùng đọc "còn 1 phòng" rồi cùng ghi, hệ thống bán vượt.
- **Quyết định:** tạo đơn, xác nhận đơn, và áp kết quả cổng thanh toán đều chạy trong giao dịch mức cô lập `Serializable` của PostgreSQL. Khi PostgreSQL phát hiện xung đột (mã `P2034`): với IPN thì trả mã `99` để cổng gọi lại sau; với tạo đơn (`createPendingBooking`) thì **tự thử lại tối đa 10 lần** (`BOOKING_MAX_ATTEMPTS`), mỗi lần kiểm tra lại phòng trống từ đầu, chỉ báo "hệ thống bận" khi hết số lần thử. Cập nhật 2026-11-01.
- **Hệ quả:** đúng đắn mà không cần quản lý khóa thủ công, mã đơn giản. Xung đột không có nghĩa là hết phòng, nên không thử lại sẽ làm mất đơn vô ích: thí nghiệm (`tests/perf/concurrency.test.ts`, kết quả ở `docs/data/concurrency.json`) cho thấy 20 khách cùng đặt một loại phòng đủ chỗ thì 1 lần thử chỉ được 2 đơn, 4 lần thử 8,4 đơn, 10 lần thử 19,2 đơn (tổng thời gian khoảng 1,3 s). Mọi cấu hình đều không bán vượt phòng; tranh phòng cuối luôn bán đúng một phòng. Đổi lại, 20 khách cùng đặt một loại phòng làm thời gian xử lý tăng vì các giao dịch phải nối đuôi nhau.
- **Phương án khác:** khóa hàng bi quan (`SELECT ... FOR UPDATE` trên dòng phòng) để tránh hủy giao dịch; khóa lạc quan bằng cột phiên bản; bộ đếm tồn kho (xem ADR-002); hàng đợi cho loại phòng bán chạy.
- **Cần nghiên cứu:** so sánh với khóa hàng (tỷ lệ thành công, độ trễ); thử ở tải lớn hơn 20 khách và trên máy chủ thật (số liệu hiện đo ở máy phát triển).

## ADR-002: Phòng trống được tính từ các đơn, không lưu bộ đếm tồn kho

- **Trạng thái:** đã áp dụng.
- **Bối cảnh:** cần biết số phòng còn trống theo từng đêm, có chặn phòng và đơn giữ chỗ hết hạn.
- **Quyết định:** không có bảng tồn kho theo ngày. Mỗi lần hỏi, tính từ các đơn đang giữ chỗ (`holdingWhere`) cộng phòng bị chặn (`unavailableQuantity`). Đơn chờ thanh toán quá 30 phút tự coi như đã nhả phòng ngay khi truy vấn, không cần chờ tác vụ nền. Lượt dùng mã giảm giá cũng không có bộ đếm mà đếm từ các đơn.
- **Hệ quả:** không bao giờ lệch giữa "số đếm" và "đơn thật"; hủy hay hết hạn tự trả lại phòng và lượt dùng. Đổi lại mỗi lần tìm phòng phải quét các đơn trùng ngày, nên phụ thuộc chỉ mục `Booking(roomId, checkIn, checkOut)`.
- **Số liệu:** với 40.000 đơn, tìm khách sạn có ngày mất khoảng 100 ms, tính một loại phòng khoảng 1 ms (`npm run test:perf`, máy phát triển).
- **Phương án khác:** bảng `RoomInventory(roomId, ngày, đã bán)` cập nhật khi đặt/hủy, nhanh hơn khi quy mô rất lớn nhưng phải giữ đồng bộ.

## ADR-003: Khách không đến lưu là `CANCELLED` kèm cờ `noShow`

- **Trạng thái:** đã áp dụng.
- **Bối cảnh:** cần ghi nhận khách không đến và giữ phí như hủy muộn.
- **Quyết định:** không thêm giá trị mới vào trạng thái đơn; đơn chuyển `CANCELLED` và đặt `Booking.noShow = true`. Hiển thị nhãn dùng `statusLabel(status, noShow)`.
- **Hệ quả:** tái dùng nguyên luồng hoàn tiền, đối soát và khiếu nại của đơn hủy muộn, ít mã mới và ít chỗ có thể sai. Đổi lại mọi chỗ hiển thị trạng thái của đơn hủy phải dùng `statusLabel`, không dùng thẳng `STATUS_LABEL`.

## ADR-004: Mã giảm giá do sàn tạo nên sàn chịu chi phí

- **Trạng thái:** đã áp dụng.
- **Bối cảnh:** khách dùng mã giảm thì số tiền thu được thấp hơn giá phòng; ai chịu phần chênh?
- **Quyết định:** doanh thu đối soát của đơn hoàn tất tính trên **giá trước giảm**; hoa hồng cũng tính trên giá đó; phần giảm ghi nhận là `promoCost` của sàn. Đối tác nhận đủ như khi khách không dùng mã. Với đơn hủy muộn/không đến, phí giữ tính trên số tiền khách thực trả.
- **Hệ quả:** đối tác không bị thiệt vì chương trình của sàn. Sàn có thể lỗ trên đơn có mã lớn hơn hoa hồng (đã có test minh họa). Kế toán cần theo dõi tổng `promoCost`.

## ADR-005: Trợ lý ảo chỉ đọc, đơn tạo bằng token đề xuất có ký số

- **Trạng thái:** đã áp dụng. Nguyên tắc bất di bất dịch.
- **Bối cảnh:** mô hình ngôn ngữ có thể bị dẫn dắt (kể cả qua nội dung do người khác nhập) để làm điều không mong muốn.
- **Quyết định:** mô hình chỉ được dùng công cụ `search_rooms`. Không có công cụ tạo đơn hay thanh toán. Khi khách chốt, hệ thống sinh token đề xuất có chữ ký; chỉ hành động của khách đã đăng nhập ở trang xác nhận mới tạo đơn qua `createPendingBooking`, dùng lại đúng bước kiểm tra giá và phòng trống của form đặt phòng.
- **Hệ quả:** dù mô hình bị lừa, nó không tạo được đơn hay tiêu tiền. Đổi lại trải nghiệm thêm một bước xác nhận.
- **Cần nghiên cứu:** bộ câu hỏi tiêm lệnh để đo; đánh giá chất lượng trả lời.

## ADR-006: Ba root layout tách theo vai trò

- **Trạng thái:** đã áp dụng.
- **Bối cảnh:** khi chỉ có một root layout, chuyển giữa khu vực khách và khu vực quản trị bị sót khung giao diện của khu vực trước.
- **Quyết định:** ba nhóm giao diện `app/(site)`, `app/host`, `app/admin` mỗi nhóm có root layout riêng (bọc `components/root-shell.tsx`), không có `app/layout.tsx` gốc. Chuyển giữa các khu vực tải lại cả trang. Chuyển hướng theo vai trò ở `proxy.ts`.
- **Hệ quả:** không sót khung; mỗi vai trò chỉ thấy giao diện của mình. Đổi lại khi thêm trang mới phải đặt đúng khu vực và không đặt liên kết sang giao diện khác.

## ADR-007: Quyền kiểm ở máy chủ trong từng server action

- **Trạng thái:** đã áp dụng.
- **Quyết định:** mọi server action gọi `requireUser/requireStaff/requireAdmin` rồi, nếu thao tác theo khách sạn, `canManageHotel/Room/Booking`; thao tác của khách luôn kèm `userId` trong điều kiện truy vấn (`findFirst({ id, userId })`). Ẩn nút trên giao diện chỉ để tiện dùng, không phải bảo mật.
- **Hệ quả:** `tests/integration/authz-matrix.test.ts` thử từng thao tác bằng người không có quyền và kiểm dữ liệu không đổi.
- **Cần nghiên cứu:** tách `admin.ts` và gom kiểm quyền thành một lớp bọc để khó quên khi thêm action mới.
