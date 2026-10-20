# Kịch bản demo và điểm nhấn kỹ thuật – Không Gian Số Stay

Tài liệu dùng cho buổi báo cáo thực tập tốt nghiệp. Phần 1 là kịch bản demo (khoảng 12–15 phút), phần 2 là các điểm nhấn kỹ thuật để trình bày, phần 3 là câu hỏi hội đồng thường hỏi và cách trả lời.

---

## 0. Chuẩn bị trước buổi demo (làm ở nhà, 10 phút)

| Việc | Lệnh / cách làm |
|---|---|
| Bật PostgreSQL, kiểm tra `web/.env` có `DATABASE_URL`, `AUTH_SECRET` | xem README mục 3 |
| Tạo bảng + dữ liệu mẫu (9 khách sạn, 27 loại phòng, tài khoản mẫu gồm cả đối tác; nếu DB đã có sẵn từ trước thì chạy `npx tsx prisma/seed-partner.ts`) | `cd web` rồi `npx prisma migrate deploy` và `npx prisma db seed` |
| (Tùy chọn) bật thanh toán VNPay sandbox | điền `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` trong `web/.env`; để trống thì dùng cổng giả lập |
| Chạy bản production cho mượt | `npm run build` rồi `npm run start` (mặc định cổng 3000) |
| Mở sẵn 2 cửa sổ trình duyệt: một thường (khách), một ẩn danh (admin) | tránh phải đăng nhập đi đăng nhập lại |
| Kiểm tra mạng nếu demo VNPay | trang VNPay sandbox cần Internet |
| Kiểm tra Internet | ảnh khách sạn tải từ Unsplash nên cần mạng để hiển thị đẹp |

**Tài khoản mẫu** (chỉ dùng khi phát triển):

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách | `khach@khongiansos.vn` | `Khach@123456` |
| Quản trị (sàn) | `admin@khongiansos.vn` | `Admin@123456` |
| Đối tác khách sạn | `doitac@khongiansos.vn` | `Doitac@123456` (sở hữu 3 khách sạn: Hàn River, Đà Lạt Pine Hill, Nha Trang Ocean Pearl) |

**Thẻ test VNPay sandbox** (theo tài liệu sandbox của VNPay; nếu trang VNPay hiển thị thông tin khác thì dùng theo trang đó):
ngân hàng **NCB**, số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, ngày phát hành `07/15`, OTP `123456`.

**Phương án dự phòng:** nếu mất mạng hoặc VNPay lỗi, để trống hai khóa VNPay và khởi động lại server; hệ thống tự chuyển sang cổng thanh toán giả lập, luồng demo vẫn chạy đủ.

---

## 1. Kịch bản demo

> Mỗi bước có **Làm gì** (thao tác) và **Nói gì** (ý để trình bày). Thời lượng chỉ là gợi ý.

### Bước 1 – Giới thiệu và tìm phòng (2 phút)
**Làm gì:** mở trang chủ → ô tìm kiếm chọn *Phú Quốc*, ngày nhận/trả phòng (ví dụ ngày mai + 2 đêm), 2 khách → *Tìm*. Trên trang kết quả thử bộ lọc khoảng giá, hạng sao, tiện nghi và đổi cách sắp xếp.
**Nói gì:** hệ thống chỉ hiện phòng *còn trống đúng khoảng ngày đã chọn*, giá hiển thị là giá thấp nhất trong các phòng còn trống và đủ chỗ.

### Bước 2 – Xem khách sạn (1 phút)
**Làm gì:** bấm vào *Phú Quốc Sunset Bay Resort*: thư viện ảnh, bản đồ, tiện nghi, danh sách phòng kèm số phòng còn lại ("Chỉ còn N phòng"), mục *Chính sách hủy phòng*, đánh giá.
**Nói gì:** mỗi khách sạn có chính sách hủy riêng do quản trị cấu hình.

### Bước 3 – Đăng nhập và đặt phòng có mã giảm giá (3 phút)
Chuẩn bị: admin tạo trước mã giảm giá (xem bước 7) hoặc làm bước 7 trước.
**Làm gì:** bấm *Đặt phòng* ở loại *Deluxe* → hệ thống yêu cầu đăng nhập, đăng nhập bằng tài khoản khách → trang xác nhận → nhập mã (ví dụ `DEMO20`) → bấm *Áp dụng* → thấy dòng *Giảm giá* và tổng tiền mới → *Tiếp tục thanh toán*.
**Nói gì:** giá và mã giảm giá được **tính lại ở máy chủ** khi tạo đơn, trình duyệt không thể sửa giá. Đơn được **giữ phòng 30 phút**.

### Bước 4 – Thanh toán VNPay sandbox (3 phút)
**Làm gì:** trên trang thanh toán chọn phương thức → bấm *Thanh toán … qua VNPay* → ở trang VNPay chọn *Thẻ nội địa* → nhập thẻ test (mục 0) → nhập OTP → quay về website thấy *Đặt phòng thành công*.
**Nói gì:** website **không lưu thông tin thẻ**; kết quả quay về được **kiểm tra chữ ký HMAC-SHA512** và **đối chiếu số tiền** trước khi xác nhận đơn. Đơn chuyển sang *Đã xác nhận / Đã thanh toán*.
**Nếu dùng cổng giả lập:** chọn phương thức bất kỳ, bấm *Thanh toán*; nói rõ đây là giả lập phục vụ đồ án.

### Bước 5 – Xem và hủy đơn có phí (2 phút)
**Làm gì:** vào *Đặt phòng của tôi* → mở đơn vừa tạo → thấy mã giảm giá, chính sách hủy → bấm *Hủy đặt phòng*; hộp xác nhận nêu **số tiền hoàn hoặc phí giữ lại** → xác nhận.
**Nói gì:** tiền hoàn được tính theo chính sách của khách sạn tại thời điểm hủy (hủy sớm hoàn đủ, hủy muộn bị giữ một tỷ lệ) và **lưu vào đơn**. Đơn thanh toán thật qua VNPay chuyển sang *Chờ hoàn tiền* cho đến khi admin hoàn.
**Mẹo:** để thấy hủy có phí, trước buổi demo vào admin đặt *Hủy miễn phí trước ngày nhận phòng* của khách sạn là 30 ngày; sau demo trả về 1.

### Bước 6 – Hồ sơ cá nhân (1 phút)
**Làm gì:** menu người dùng → *Tài khoản*: sửa họ tên, số điện thoại; đổi mật khẩu (thử nhập sai mật khẩu hiện tại để thấy báo lỗi).
**Nói gì:** đổi mật khẩu bắt buộc nhập đúng mật khẩu hiện tại và có giới hạn số lần thử.

### Bước 7 – Quản trị (5 phút, dùng cửa sổ ẩn danh)
Đăng nhập admin rồi lần lượt:
1. **Tổng quan:** chỉ số theo kỳ, biểu đồ doanh thu, biểu đồ tỷ lệ lấp đầy.
2. **Mã giảm giá:** tạo `DEMO20` (giảm 20%, tối đa 300.000 ₫, mỗi khách 3 lượt) → thấy trong danh sách, có nút bật/tắt và số lượt đã dùng.
3. **Khách sạn → Phú Quốc → một loại phòng:** mục *Chặn phòng*: chặn toàn bộ phòng loại đó trong 2 ngày → quay lại trang khách sạn tìm đúng khoảng ngày đó → phòng hiện **Hết phòng**. Bỏ chặn để trả lại.
4. **Đơn đặt phòng:** lọc theo trạng thái; với đơn đã xác nhận có ngày nhận là hôm nay bấm **Nhận phòng** (ghi giờ nhận phòng thực tế) rồi **Hoàn tất (khách trả phòng)**; với đơn *Chờ hoàn tiền* bấm **Đã hoàn tiền** kèm ghi chú.
5. **Đánh giá:** ẩn/hiện hoặc xóa đánh giá không phù hợp. **Người dùng:** cấp/thu hồi quyền quản trị.
**Nói gì:** đơn đã nhận phòng thì không hủy được nữa; chỉ khách có đơn *Hoàn tất* mới được viết đánh giá.

### Bước 7b – Sàn trung gian: đối tác và đối soát (5 phút)
**Làm gì:**
1. Mở `/partner` (trang giới thiệu đối tác) rồi đăng nhập `doitac@khongiansos.vn` → vào **khu vực đối tác** `/host`: tổng quan, **Khách sạn của tôi** (chỉ 3 khách sạn của họ), thử mở trang sửa khách sạn của người khác để thấy bị từ chối.
2. Bấm **Thêm khách sạn**, tạo một khách sạn thử → trạng thái **Chờ duyệt**, khách chưa thấy.
3. Đăng nhập admin → **Đối tác**: thấy khách sạn chờ duyệt, bấm **Duyệt**; đổi **hoa hồng** của một khách sạn.
4. Để có số liệu đối soát: dùng tài khoản khách đặt phòng ở một khách sạn của đối tác, thanh toán, rồi đối tác bấm **Nhận phòng** và **Hoàn tất** (cần đúng ngày nhận phòng là hôm nay; hoặc chuẩn bị sẵn vài đơn đã hoàn tất).
5. Đối tác mở **Đối soát & chi trả**: thấy tổng thu, hoa hồng sàn, số tiền sẽ nhận. Admin mở **Đối soát** → **Tạo đợt chi trả** → đối tác thấy khoản đã nhận trong lịch sử.
**Nói gì:** sàn thu tiền của khách; đối tác nhận doanh thu trừ hoa hồng. Hoa hồng được **chốt vào đơn lúc đặt**, nên đổi hoa hồng chỉ áp dụng cho đơn sau. Đối tác không tự xác nhận thanh toán hay hoàn tiền vì tiền do sàn giữ.

### Bước 8 – Quên mật khẩu (1 phút, nếu còn thời gian)
**Làm gì:** trang đăng nhập → *Quên mật khẩu?* → nhập email → thông báo chung. Chưa cấu hình email thì liên kết đặt lại được in trong cửa sổ chạy server (chỉ ở chế độ phát triển).
**Nói gì:** liên kết có hiệu lực 60 phút, dùng một lần, hệ thống chỉ lưu bản băm của token; thông báo luôn giống nhau dù email có tồn tại hay không để không lộ email nào đã đăng ký.

### Dọn dữ liệu sau buổi demo
Xóa mã `DEMO20`, các đơn thử, lịch chặn phòng; đặt lại chính sách hủy của khách sạn về 1 ngày / 50% nếu đã sửa.

---

## 2. Điểm nhấn kỹ thuật (để đưa vào báo cáo)

### 2.1. Chống đặt trùng phòng
Kiểm tra phòng trống và tạo đơn nằm trong **một giao dịch mức Serializable** của PostgreSQL. Hai người đặt cùng lúc loại phòng cuối cùng thì một giao dịch thành công, giao dịch kia bị từ chối và báo "hệ thống đang bận / phòng vừa hết". Số phòng đang bị giữ tính trên khoảng ngày nửa mở `[nhận, trả)` nên người trả phòng và người nhận phòng cùng ngày không xung đột.

### 2.2. Giữ phòng có thời hạn
Đơn chờ thanh toán giữ phòng 30 phút. Quá hạn, phòng được trả lại ngay trong truy vấn tìm kiếm (không cần chờ job dọn), và đơn được chuyển sang *Đã hủy* bởi cơ chế dọn đơn quá hạn (khi có người đặt phòng/xem danh sách, hoặc qua endpoint cron có khóa bảo vệ).

### 2.3. Thanh toán VNPay an toàn
- Tạo URL thanh toán có **chữ ký HMAC-SHA512**; so sánh chữ ký bằng `timingSafeEqual`.
- Xác nhận đơn chỉ khi cổng báo thành công **và** số tiền khớp.
- Xử lý **idempotent**: trang quay về và IPN cùng gọi một hàm, mỗi giao dịch chỉ được áp dụng đúng một lần nhờ chuyển trạng thái `PENDING → SUCCESS/FAILED` có điều kiện.
- Trường hợp đã nhận tiền nhưng không còn giữ được phòng: đơn chuyển *Đã hủy* và đánh dấu **cần hoàn tiền** thay vì mất tiền khách.
- Không bao giờ lưu thông tin thẻ.

### 2.4. Nghiệp vụ tiền: giá, voucher, hủy, hoàn
- Giá **luôn tính ở máy chủ**; voucher kiểm tra lại trong cùng giao dịch tạo đơn.
- Lượt dùng voucher **không dùng bộ đếm** (dễ sai lệch) mà đếm các đơn còn hiệu lực, nên đơn hủy/hết hạn tự trả lại lượt.
- Chính sách hủy theo từng khách sạn, là **hàm thuần** `cancelQuote` nên kiểm thử dễ; số tiền hoàn được lưu cố định vào đơn tại thời điểm hủy.
- Phòng chặn tính **theo từng đêm** (lấy đêm bị chặn nhiều nhất), không cộng dồn sai.

### 2.4b. Mô hình sàn trung gian và đối soát
- Ba vai trò (khách, đối tác, sàn); **quyền kiểm tra theo từng khách sạn ở máy chủ**, không chỉ ẩn nút: đối tác không sửa được khách sạn, phòng, lịch chặn hay đơn của người khác.
- Duyệt khách sạn trước khi hiển thị; hoa hồng theo khách sạn và **chốt vào đơn lúc đặt** để đối soát không bị đổi ngầm.
- Đối soát tính đúng cả phí hủy muộn; tạo đợt chi trả bằng giao dịch Serializable và điều kiện `payoutId = null` nên không chi trả trùng đơn (đã có test cho cả trường hợp hai yêu cầu đồng thời).

### 2.5. Bảo mật
- Mật khẩu băm **bcrypt**; chính sách mật khẩu (≥ 8 ký tự, có chữ và số).
- **Giới hạn đăng nhập sai 3 lớp** (theo cặp email+IP, theo email, theo IP) để chặn dò mật khẩu mà không dễ bị kẻ xấu khóa tài khoản người khác.
- Đặt lại mật khẩu: token ngẫu nhiên 256 bit, **chỉ lưu bản băm**, hết hạn 60 phút, dùng một lần; giới hạn số lần yêu cầu.
- Phân quyền: mọi trang và hành động quản trị đều kiểm tra quyền ở máy chủ; `callbackUrl` chỉ chấp nhận đường dẫn nội bộ (chống open-redirect).
- Tải ảnh lên: kiểm tra định dạng thật, giới hạn dung lượng và số điểm ảnh (chống "bom điểm ảnh"), tên tệp do hệ thống tạo.
- Dữ liệu nhập đều qua **zod**; dữ liệu người dùng trong email được thoát ký tự HTML.

### 2.6. Hiệu năng và SEO
- Dữ liệu công khai (danh sách, chi tiết, thành phố, sitemap) được **lưu đệm theo thẻ** và làm mới ngay khi quản trị thay đổi.
- Chỉ mục cơ sở dữ liệu cho truy vấn báo cáo và đánh giá; ảnh qua trình tối ưu của Next.js.
- Trả **mã 404 thật** cho khách sạn không tồn tại, có sitemap, robots, dữ liệu có cấu trúc (schema.org).

### 2.7. Chất lượng
- **285 bài kiểm thử tự động** (đơn vị + tích hợp trên cơ sở dữ liệu riêng), kèm kiểm tra kiểu và lint; có workflow CI.
- Migration quản lý bằng Prisma; build không phụ thuộc cơ sở dữ liệu; có Docker và hướng dẫn triển khai.

### 2.8. Công nghệ
Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Prisma 6 · PostgreSQL · Auth.js (JWT) · Tailwind CSS 4 · zod · nodemailer · Vitest.

---

## 3. Câu hỏi hội đồng thường hỏi

| Câu hỏi | Gợi ý trả lời |
|---|---|
| Hai người đặt cùng một phòng cuối cùng thì sao? | Giao dịch Serializable: một người thành công, người kia nhận thông báo phòng vừa hết (mục 2.1). |
| Khách sửa giá trên trình duyệt được không? | Không. Giá và voucher tính lại ở máy chủ (mục 2.4). |
| Khách thanh toán xong nhưng đóng trình duyệt thì sao? | VNPay gọi IPN về máy chủ; trang quay về và IPN dùng chung một hàm idempotent (mục 2.3). |
| Thanh toán rồi nhưng phòng đã hết? | Đơn chuyển hủy và đánh dấu cần hoàn tiền, admin hoàn rồi ghi nhận (mục 2.3). |
| Có lưu số thẻ không? | Không, khách nhập thẻ trực tiếp trên cổng VNPay. |
| Quên mật khẩu có an toàn không? | Token băm, hết hạn, dùng một lần, thông báo không lộ email (mục 2.5). |
| Ai thấy được trang quản trị? | Chỉ vai trò ADMIN, kiểm tra ở máy chủ cho từng trang và hành động. Đối tác (HOST) chỉ thấy khách sạn và đơn của mình. |
| Dự án là sàn hay một khách sạn? | Sàn trung gian: nhiều khách sạn của các đối tác; sàn duyệt, thu tiền của khách, thu hoa hồng và chi trả cho đối tác sau đối soát. |
| Hoa hồng tính thế nào, đổi giữa chừng thì sao? | Theo từng khách sạn (mặc định 10%), chốt vào đơn lúc khách đặt; đổi sau chỉ áp dụng cho đơn mới. |
| Hệ thống đã kiểm thử thế nào? | 285 bài tự động + thử thủ công các luồng chính trên giao diện (README mục 3.7). |
| Cổng thanh toán là thật hay giả? | VNPay **sandbox** (môi trường thử nghiệm, không trừ tiền thật); khi chưa có khóa thì dùng cổng giả lập. Chạy thật cần hợp đồng merchant với VNPay. |
| Hạn chế còn lại? | Tìm kiếm đọc toàn bộ khách sạn khớp bộ lọc vào bộ nhớ (ổn tới vài trăm khách sạn); chưa có giá động theo mùa, đa ngôn ngữ, vai trò chủ khách sạn, IPN VNPay chưa thử trên địa chỉ công khai. |
