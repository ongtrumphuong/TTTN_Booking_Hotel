# Sơ đồ cho báo cáo – Không Gian Số Stay

Các sơ đồ dưới đây viết bằng **Mermaid**. GitHub và VS Code (có tiện ích xem Markdown Mermaid) hiển thị trực tiếp. Muốn chèn vào Word hoặc slide, dán mã vào https://mermaid.live rồi xuất ảnh PNG/SVG.

Danh sách:
1. Tác nhân và use case
2. Đặc tả use case chính (đặt phòng, thanh toán)
3. Sơ đồ tuần tự: đặt phòng và thanh toán VNPay
4. Sơ đồ tuần tự: hủy đơn và hoàn tiền
5. Sơ đồ trạng thái của đơn đặt phòng
6. Sơ đồ thực thể quan hệ (ER)
7. Kiến trúc tổng quan

---

## 1. Tác nhân và use case

Mermaid không có ký hiệu use case chuẩn UML nên dùng sơ đồ khối: hình chữ nhật bo tròn ngoài cùng bên trái là tác nhân, hình bầu dục là use case. Khi vẽ lại bằng công cụ UML (draw.io, StarUML), giữ nguyên nội dung. Sơ đồ tách làm hai để vừa một trang báo cáo.

### 1.1. Khách vãng lai và Khách hàng

```mermaid
flowchart LR
  KV["Khách vãng lai"]
  KH["Khách hàng<br/>(đã đăng nhập)"]
  VN["Cổng VNPay"]

  subgraph HT ["Hệ thống đặt phòng"]
    direction TB
    UC1(["Tìm kiếm, lọc khách sạn"])
    UC2(["Xem chi tiết khách sạn,<br/>phòng trống, chính sách hủy"])
    UC3(["Đăng ký"])
    UC4(["Đăng nhập"])
    UC5(["Quên và đặt lại mật khẩu"])
    UC6(["Đặt phòng"])
    UC7(["Áp dụng mã giảm giá"])
    UC8(["Thanh toán trực tuyến"])
    UC9(["Xem lịch sử đặt phòng"])
    UC10(["Hủy đặt phòng"])
    UC11(["Yêu thích khách sạn"])
    UC12(["Viết đánh giá"])
    UC13(["Sửa hồ sơ, đổi mật khẩu"])
  end

  KV --- UC1 & UC2 & UC3 & UC4 & UC5
  KH --- UC1 & UC2 & UC6 & UC9 & UC10 & UC11 & UC12 & UC13
  UC6 -. "include" .-> UC4
  UC6 -. "extend" .-> UC7
  UC6 -. "include" .-> UC8
  UC8 --- VN
```

### 1.2. Quản trị viên

```mermaid
flowchart LR
  QT["Quản trị viên"]

  subgraph HT ["Hệ thống quản trị"]
    direction TB
    UC14(["Thống kê, biểu đồ"])
    UC15(["Quản lý khách sạn,<br/>loại phòng, ảnh"])
    UC16(["Cấu hình chính sách hủy"])
    UC17(["Chặn phòng theo ngày"])
    UC18(["Quản lý đơn đặt phòng"])
    UC19(["Nhận phòng, trả phòng"])
    UC20(["Xác nhận hoàn tiền"])
    UC21(["Quản lý mã giảm giá"])
    UC22(["Kiểm duyệt đánh giá"])
    UC23(["Quản lý người dùng, phân quyền"])
  end

  QT --- UC14 & UC15 & UC16 & UC17 & UC18 & UC21 & UC22 & UC23
  UC18 -. "include" .-> UC19
  UC18 -. "extend" .-> UC20
```

Ghi chú: Quản trị viên kế thừa mọi quyền của Khách hàng (có thể tự đặt phòng); sơ đồ không vẽ để tránh rối. Use case "Hủy đặt phòng" của quản trị viên nằm trong "Quản lý đơn đặt phòng" (luôn hoàn đủ tiền).

---

## 2. Đặc tả use case chính

### UC-06 Đặt phòng

| Mục | Nội dung |
|---|---|
| Tác nhân | Khách hàng |
| Tiền điều kiện | Đã đăng nhập (nếu chưa, hệ thống chuyển sang trang đăng nhập rồi quay lại); đã chọn loại phòng, ngày nhận/trả (1–30 đêm, không ở quá khứ), số khách |
| Hậu điều kiện | Đơn ở trạng thái *Chờ thanh toán*, phòng được giữ 30 phút |
| Luồng chính | 1. Khách chọn phòng và ngày ở trang khách sạn.<br/>2. Hệ thống hiển thị trang xác nhận kèm giá, số phòng còn lại.<br/>3. Khách chọn số phòng, ghi yêu cầu, (tùy chọn) nhập mã giảm giá.<br/>4. Hệ thống kiểm tra còn phòng, tính giá và giảm giá ở máy chủ, tạo đơn trong một giao dịch.<br/>5. Chuyển sang trang thanh toán (UC-08). |
| Luồng thay thế | 3a. Mã giảm giá sai, hết hạn, hết lượt hoặc chưa đủ điều kiện: báo lỗi, khách đặt tiếp không cần mã.<br/>4a. Phòng vừa hết hoặc số khách vượt sức chứa: báo lỗi, quay lại chọn phòng khác.<br/>4b. Hai người đặt cùng lúc phòng cuối: một giao dịch bị từ chối, báo "hệ thống đang bận / phòng vừa hết". |
| Quy tắc | Giá do máy chủ tính; phòng bị quản trị chặn không đặt được; ngày trả phòng của khách này có thể là ngày nhận phòng của khách khác |

### UC-08 Thanh toán trực tuyến

| Mục | Nội dung |
|---|---|
| Tác nhân | Khách hàng; cổng VNPay |
| Tiền điều kiện | Đơn *Chờ thanh toán*, còn trong 30 phút giữ phòng |
| Hậu điều kiện | Thành công: đơn *Đã xác nhận / Đã thanh toán*, gửi email xác nhận. Thất bại hoặc hủy: đơn vẫn giữ phòng đến hết hạn, khách thanh toán lại được |
| Luồng chính | 1. Khách chọn phương thức, bấm thanh toán.<br/>2. Hệ thống tạo giao dịch, sinh URL có chữ ký, chuyển khách sang VNPay.<br/>3. Khách thanh toán tại VNPay.<br/>4. VNPay báo kết quả về website (trang quay về và IPN).<br/>5. Hệ thống kiểm tra chữ ký, đối chiếu số tiền, xác nhận đơn đúng một lần. |
| Luồng thay thế | 3a. Khách hủy hoặc thanh toán lỗi: ghi nhận giao dịch thất bại.<br/>5a. Chữ ký sai hoặc số tiền lệch: từ chối, không xác nhận.<br/>5b. Đã nhận tiền nhưng không còn giữ được phòng: đơn chuyển *Đã hủy* và đánh dấu cần hoàn tiền.<br/>\* Chưa cấu hình VNPay: dùng cổng giả lập (không thu tiền thật). |

### UC-10 Hủy đặt phòng

| Mục | Nội dung |
|---|---|
| Tác nhân | Khách hàng |
| Tiền điều kiện | Đơn *Chờ thanh toán* hoặc *Đã xác nhận*; chưa đến ngày nhận phòng; chưa nhận phòng thực tế |
| Hậu điều kiện | Đơn *Đã hủy*; nếu đã thanh toán, số tiền hoàn được tính và lưu vào đơn |
| Luồng chính | 1. Khách mở chi tiết đơn, bấm *Hủy*.<br/>2. Hệ thống hiện số tiền hoàn hoặc phí giữ lại theo chính sách của khách sạn.<br/>3. Khách xác nhận.<br/>4. Hệ thống hủy đơn, ghi `refundAmount`, gửi email thông báo. |
| Quy tắc | Hủy trước ngày nhận phòng ít nhất N ngày: hoàn đủ; muộn hơn: giữ X% số tiền đã trả; đơn chưa thanh toán hủy không mất phí; quản trị viên hủy thì luôn hoàn đủ |

---

## 3. Sơ đồ tuần tự: đặt phòng và thanh toán VNPay

```mermaid
sequenceDiagram
  autonumber
  actor K as Khách hàng
  participant W as Website (Next.js)
  participant DB as PostgreSQL
  participant V as Cổng VNPay
  participant M as Email (SMTP)

  K->>W: Chọn phòng, ngày ở, mã giảm giá (nếu có)
  W->>DB: Kiểm tra mã giảm giá (xem trước)
  W-->>K: Hiển thị mức giảm và tổng tiền

  K->>W: Bấm "Tiếp tục thanh toán"
  W->>DB: BEGIN (Serializable)
  W->>DB: Tính phòng còn lại = tổng phòng - đơn đang giữ - phòng bị chặn
  alt Không đủ phòng
    W-->>K: Báo "Phòng vừa hết"
  else Đủ phòng
    W->>DB: Kiểm tra lại mã giảm giá, tính tổng tiền ở máy chủ
    W->>DB: Tạo đơn (Chờ thanh toán, giữ phòng 30 phút)
    W->>DB: COMMIT
    W-->>K: Chuyển sang trang thanh toán
  end

  K->>W: Chọn phương thức, bấm thanh toán
  W->>DB: Tạo giao dịch (PENDING, mã tham chiếu duy nhất)
  W->>W: Ký URL bằng HMAC-SHA512
  W-->>K: Chuyển hướng sang VNPay
  K->>V: Nhập thẻ, xác thực OTP
  V-->>K: Chuyển về website kèm kết quả và chữ ký

  par Trang quay về
    K->>W: GET /api/payments/vnpay/return
  and IPN từ máy chủ VNPay
    V->>W: GET /api/payments/vnpay/ipn
  end

  W->>W: Kiểm tra chữ ký (timingSafeEqual)
  W->>DB: Chuyển giao dịch PENDING -> SUCCESS (có điều kiện, chỉ một lần)
  alt Chữ ký sai hoặc số tiền lệch
    W-->>V: Từ chối (RspCode 97/04)
  else Hợp lệ và còn giữ được phòng
    W->>DB: Đơn -> Đã xác nhận, Đã thanh toán
    W-)M: Gửi email xác nhận
    W-->>K: Trang "Đặt phòng thành công"
  else Đã nhận tiền nhưng hết phòng
    W->>DB: Đơn -> Đã hủy, đánh dấu cần hoàn tiền
    W-->>K: Thông báo sẽ hoàn tiền
  end
```

Điểm cần nhấn mạnh khi báo cáo: bước 5–8 nằm trong một **giao dịch Serializable** nên không thể đặt trùng phòng; bước `PENDING -> SUCCESS` có điều kiện nên trang quay về và IPN chạy đồng thời vẫn chỉ xác nhận **một lần**.

---

## 4. Sơ đồ tuần tự: hủy đơn và hoàn tiền

```mermaid
sequenceDiagram
  autonumber
  actor K as Khách hàng
  actor A as Quản trị viên
  participant W as Website (Next.js)
  participant DB as PostgreSQL
  participant M as Email (SMTP)

  K->>W: Mở chi tiết đơn
  W->>DB: Đọc đơn và chính sách hủy của khách sạn
  W-->>K: Hiển thị chính sách, số tiền hoàn / phí giữ lại
  K->>W: Xác nhận hủy
  W->>W: cancelQuote(ngày nhận, tiền đã trả, số ngày miễn phí, % phí)
  W->>DB: Đơn -> Đã hủy (điều kiện: còn Chờ thanh toán / Đã xác nhận)
  W->>DB: Ghi refundAmount và cancelledAt
  alt Thanh toán giả lập hoặc chưa trả tiền
    W->>DB: Trạng thái thanh toán -> Đã hoàn tiền (không có tiền thật để hoàn)
  else Đã trả thật qua VNPay và refundAmount lớn hơn 0
    W->>DB: Giữ "Đã thanh toán", hiển thị "Chờ hoàn tiền"
  end
  W-)M: Email thông báo hủy
  W-->>K: Hiển thị kết quả

  Note over A,DB: Hoàn tiền thật diễn ra ngoài hệ thống (cổng VNPay hoặc chuyển khoản)
  A->>W: Lọc "Cần hoàn tiền", bấm "Đã hoàn tiền" kèm ghi chú
  W->>DB: Thanh toán -> Đã hoàn tiền, ghi người xác nhận và ghi chú
  W-)M: Email báo đã hoàn tiền
```

---

## 5. Sơ đồ trạng thái của đơn đặt phòng

```mermaid
stateDiagram-v2
  [*] --> ChoThanhToan: Khách tạo đơn (giữ phòng 30 phút)
  ChoThanhToan --> DaXacNhan: Thanh toán thành công
  ChoThanhToan --> DaHuy: Khách hủy / quá 30 phút / admin hủy
  DaXacNhan --> DaNhanPhong: Admin bấm "Nhận phòng"
  DaXacNhan --> DaHuy: Khách hoặc admin hủy (trước ngày nhận phòng)
  DaNhanPhong --> HoanTat: Admin bấm "Hoàn tất" khi khách trả phòng
  DaXacNhan --> HoanTat: Hoàn tất (tự ghi nhận đã nhận phòng)
  HoanTat --> [*]
  DaHuy --> [*]
```

Ghi chú: trong cơ sở dữ liệu, *Đã nhận phòng* không phải một trạng thái riêng mà là đơn `CONFIRMED` có `checkedInAt`; đơn đã nhận phòng không hủy được. Với đơn đã hủy mà đã thanh toán, trạng thái thanh toán đi tiếp theo nhánh riêng: *Đã thanh toán → Chờ hoàn tiền → Đã hoàn tiền*.

---

## 6. Sơ đồ thực thể quan hệ (ER)

```mermaid
erDiagram
  USER ||--o{ BOOKING : "đặt"
  USER ||--o{ REVIEW : "viết"
  USER ||--o{ FAVORITE : "thích"
  USER ||--o{ PASSWORD_RESET_TOKEN : "yêu cầu"
  HOTEL ||--o{ ROOM : "có"
  HOTEL ||--o{ REVIEW : "nhận"
  HOTEL ||--o{ FAVORITE : "được thích"
  ROOM ||--o{ BOOKING : "được đặt"
  ROOM ||--o{ ROOM_BLOCK : "bị chặn"
  BOOKING ||--o{ PAYMENT : "có giao dịch"
  VOUCHER ||..o{ BOOKING : "áp dụng qua mã"

  USER {
    string id PK
    string email UK
    string name
    string phone
    string passwordHash
    enum role "USER, ADMIN"
  }
  HOTEL {
    string id PK
    string slug UK
    string name
    string city
    int starRating
    string_array images
    string_array amenities
    int freeCancelDays
    int lateCancelFeePercent
    bool isActive
  }
  ROOM {
    string id PK
    string hotelId FK
    string name
    int pricePerNight
    int capacity
    int quantity
    bool isActive
  }
  BOOKING {
    string id PK
    string code UK
    string userId FK
    string roomId FK
    date checkIn
    date checkOut
    int guests
    int rooms
    int totalPrice
    int discount
    string voucherCode
    int refundAmount
    enum status "PENDING, CONFIRMED, CANCELLED, COMPLETED"
    enum paymentStatus "UNPAID, PAID, REFUNDED"
    datetime checkedInAt
    datetime checkedOutAt
    datetime cancelledAt
  }
  PAYMENT {
    string id PK
    string bookingId FK
    enum provider "SIMULATED, VNPAY"
    string txnRef UK
    int amount
    enum status "PENDING, SUCCESS, FAILED"
    datetime paidAt
    datetime refundedAt
  }
  VOUCHER {
    string id PK
    string code UK
    int percentOff
    int amountOff
    int maxDiscount
    int minSubtotal
    int usageLimit
    int perUserLimit
    datetime startsAt
    datetime endsAt
    bool isActive
  }
  ROOM_BLOCK {
    string id PK
    string roomId FK
    date startDate
    date endDate
    int rooms
    string reason
  }
  REVIEW {
    string id PK
    string hotelId FK
    string userId FK
    int rating
    string comment
    bool isHidden
  }
  FAVORITE {
    string userId PK
    string hotelId PK
  }
  PASSWORD_RESET_TOKEN {
    string id PK
    string userId FK
    string tokenHash UK
    datetime expiresAt
    datetime usedAt
  }
```

Ghi chú: `Booking.voucherCode` lưu mã dạng chuỗi (không khóa ngoại) để đổi hoặc xóa voucher không làm hỏng đơn cũ; vì vậy quan hệ với `VOUCHER` vẽ nét đứt. Bảng `RateLimit` (bộ đếm giới hạn đăng nhập/đăng ký/đổi mật khẩu) là bảng kỹ thuật, không có quan hệ nên không vẽ.

---

## 7. Kiến trúc tổng quan

```mermaid
flowchart TB
  subgraph Client ["Trình duyệt"]
    UI["Giao diện React 19<br/>Server + Client Components"]
  end

  subgraph App ["Ứng dụng Next.js 16 (App Router)"]
    P["Trang (Server Components)<br/>lưu đệm theo thẻ cho dữ liệu công khai"]
    SA["Server Actions<br/>đặt phòng, hủy, quản trị, tài khoản"]
    API["Route Handlers<br/>VNPay return, IPN, tải ảnh, cron, health"]
    L["Lõi nghiệp vụ (src/lib)<br/>booking, cancellation, voucher,<br/>payments, rate-limit, email"]
    AU["Auth.js (JWT)<br/>phân quyền USER / ADMIN"]
  end

  DB[("PostgreSQL<br/>Prisma ORM")]
  VN["Cổng VNPay sandbox"]
  SM["Máy chủ SMTP"]
  FS[("Thư mục ảnh tải lên")]

  UI --> P
  UI --> SA
  SA --> L
  P --> L
  API --> L
  UI --> AU
  L --> DB
  API --> VN
  VN --> API
  L --> SM
  API --> FS
```
