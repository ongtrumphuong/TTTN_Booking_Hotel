import { describe, expect, it } from "vitest";
import { AreaChart, BarChart, formatCompactVND, niceMax } from "@/components/admin/charts";
import { NEXT_STATUS, STATUS_LABEL, bookingCode, isoDate, needsRefund, parseStay, paymentLabel } from "@/lib/booking";
import { buildConfirmationEmail } from "@/lib/email";
import { formatDate, formatVND } from "@/lib/format";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/image-hosts";
import { clientIpFrom } from "@/lib/login-throttle";
import { safeRedirect } from "@/lib/session";
import { NOINDEX, absoluteUrl, jsonLd, siteUrl } from "@/lib/site";
import { slugify } from "@/lib/slug";
import { UPLOAD_NAME, UPLOAD_URL } from "@/lib/uploads";

const nb = (s: string) => s.replace(/ /g, " ");

describe("parseStay", () => {
  it("nhận khoảng ngày hợp lệ và tính số đêm", () => {
    const s = parseStay("2026-11-10", "2026-11-12");
    expect(s?.nights).toBe(2);
    expect(isoDate(s!.checkIn)).toBe("2026-11-10");
    expect(isoDate(s!.checkOut)).toBe("2026-11-12");
  });
  it("chấp nhận 1 đêm và tối đa 30 đêm", () => {
    expect(parseStay("2026-11-10", "2026-11-11")?.nights).toBe(1);
    expect(parseStay("2026-11-01", "2026-12-01")?.nights).toBe(30);
  });
  it.each([
    ["trả phòng trước nhận phòng", "2026-11-12", "2026-11-10"],
    ["cùng ngày", "2026-11-10", "2026-11-10"],
    ["quá 30 đêm", "2026-11-01", "2026-12-02"],
    ["sai định dạng", "10/11/2026", "12/11/2026"],
    ["ngày không có thật", "2026-02-30", "2026-03-02"],
    ["thiếu ngày trả", "2026-11-10", ""],
  ])("từ chối: %s", (_n, a, b) => expect(parseStay(a, b)).toBeNull());
  it("từ chối giá trị thiếu hoặc không phải chuỗi ngày", () => {
    expect(parseStay(undefined, "2026-11-10")).toBeNull();
    expect(parseStay("2026-11-10", undefined)).toBeNull();
    expect(parseStay("2026-11-10T00:00:00Z", "2026-11-12")).toBeNull();
  });
});

describe("bookingCode", () => {
  it("có dạng KGS-XXXXXXXX, không dùng ký tự dễ nhầm (0, O, 1, I)", () => {
    for (let i = 0; i < 200; i++) expect(bookingCode()).toMatch(/^KGS-[A-HJ-NP-Z2-9]{8}$/);
  });
  it("không trùng nhau trong 5000 mã", () => expect(new Set(Array.from({ length: 5000 }, bookingCode)).size).toBe(5000));
});

describe("quy tắc trạng thái đơn", () => {
  it("chỉ cho phép các bước chuyển đã định", () => {
    expect(NEXT_STATUS.PENDING).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(NEXT_STATUS.CONFIRMED).toEqual(["COMPLETED", "CANCELLED"]);
  });
  it("hủy và hoàn tất là trạng thái cuối", () => {
    expect(NEXT_STATUS.CANCELLED).toEqual([]);
    expect(NEXT_STATUS.COMPLETED).toEqual([]);
  });
  it("mọi trạng thái đều có nhãn hiển thị", () => {
    for (const s of ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]) expect(STATUS_LABEL[s].text).toBeTruthy();
  });
  it("đơn hủy mà vẫn ở trạng thái đã thanh toán là chờ hoàn tiền", () => {
    expect(needsRefund("CANCELLED", "PAID")).toBe(true);
    expect(needsRefund("CANCELLED", "REFUNDED")).toBe(false);
    expect(needsRefund("CANCELLED", "UNPAID")).toBe(false);
    expect(needsRefund("CONFIRMED", "PAID")).toBe(false);
  });
  it("nhãn thanh toán theo ngữ cảnh", () => {
    expect(paymentLabel("CANCELLED", "PAID")).toBe("Chờ hoàn tiền");
    expect(paymentLabel("CONFIRMED", "PAID")).toBe("Đã thanh toán");
    expect(paymentLabel("CANCELLED", "REFUNDED")).toBe("Đã hoàn tiền");
    expect(paymentLabel("PENDING", "UNPAID")).toBe("Chưa thanh toán");
  });
});

describe("slugify", () => {
  it.each([
    ["Hội An Lantern Boutique", "hoi-an-lantern-boutique"],
    ["Đà Nẵng", "da-nang"],
    ["  Khách  sạn --- Số 1!!  ", "khach-san-so-1"],
    ["ĐÀ LẠT Pine Hill", "da-lat-pine-hill"],
    ["@@@", ""],
  ])("%s -> %s", (input, out) => expect(slugify(input)).toBe(out));
  it("giới hạn 80 ký tự", () => expect(slugify("a".repeat(200)).length).toBe(80));
  it("kết quả luôn khớp mẫu slug mà proxy chấp nhận", () => {
    for (const n of ["Nha Trang Ocean Pearl", "Phú Quốc Sunset Bay Resort", "Khách sạn #1 - Quận 3"]) {
      expect(slugify(n)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe("định dạng", () => {
  it("formatVND dùng dấu chấm ngăn cách nghìn và ký hiệu ₫", () => {
    expect(nb(formatVND(2_900_000))).toBe("2.900.000 ₫");
    expect(nb(formatVND(0))).toBe("0 ₫");
  });
  it("formatDate hiển thị theo UTC nên không lệch ngày", () => {
    expect(formatDate(new Date("2026-11-10T00:00:00.000Z"))).toContain("10/11/2026");
    expect(formatDate(new Date("2026-11-10T23:59:59.000Z"))).toContain("10/11/2026");
  });
});

describe("biểu đồ", () => {
  it.each([
    [0, 1],
    [1, 1],
    [1.2, 2],
    [4_350_000, 5_000_000],
    [7, 10],
    [100, 100],
    [101, 200],
  ])("niceMax(%d) = %d", (v, out) => expect(niceMax(v)).toBe(out));
  it.each([
    [999, "999"],
    [3_000_000, "3 tr"],
    [2_500_000, "2.5 tr"],
    [1_000_000_000, "1 tỷ"],
    [45_000, "45k"],
  ])("formatCompactVND(%d) = %s", (v, out) => expect(formatCompactVND(v)).toBe(out));
  it("BarChart và AreaChart dựng được với dữ liệu rỗng hoặc toàn số không (không chia cho 0)", () => {
    expect(() => BarChart({ data: [], title: "t", unit: "u", format: String })).not.toThrow();
    expect(() => BarChart({ data: [{ label: "a", value: 0, tooltip: "x" }], title: "t", unit: "u", format: String })).not.toThrow();
    expect(() => AreaChart({ data: [], title: "t", unit: "u", format: String, max: 100 })).not.toThrow();
  });
});

describe("safeRedirect (chống chuyển hướng ra ngoài)", () => {
  it.each(["/", "/admin", "/hotels?city=Hà%20Nội", "/bookings/abc/pay"])("cho phép %s", (p) => expect(safeRedirect(p)).toBe(p));
  it.each(["//evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "/\\evil.com", "evil.com", "", "  /admin"])("chặn %j", (p) => {
    expect(safeRedirect(p)).toBe("/");
  });
  it("null/undefined dùng giá trị dự phòng", () => {
    expect(safeRedirect(null)).toBe("/");
    expect(safeRedirect(undefined, "/dang-nhap")).toBe("/dang-nhap");
  });
});

describe("clientIpFrom", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("lấy IP đầu tiên trong X-Forwarded-For", () => expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5"));
  it("dùng X-Real-IP khi không có X-Forwarded-For", () => expect(clientIpFrom(h({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7"));
  it("hỗ trợ IPv6", () => expect(clientIpFrom(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1"));
  it("giá trị lạ hoặc thiếu -> unknown", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "'; DROP TABLE users; --" }))).toBe("unknown");
    expect(clientIpFrom(h({}))).toBe("unknown");
    expect(clientIpFrom(undefined)).toBe("unknown");
  });
});

describe("site: SEO và dữ liệu có cấu trúc", () => {
  it("siteUrl bỏ dấu / thừa và có giá trị mặc định", () => expect(siteUrl()).toBe("http://localhost:3000"));
  it("absoluteUrl", () => {
    expect(absoluteUrl("/api/uploads/x.webp")).toBe("http://localhost:3000/api/uploads/x.webp");
    expect(absoluteUrl("https://picsum.photos/a.jpg")).toBe("https://picsum.photos/a.jpg");
  });
  it("NOINDEX chặn lập chỉ mục", () => expect(NOINDEX).toMatchObject({ index: false, follow: false }));
  it("jsonLd không cho dữ liệu người dùng đóng thẻ script", () => {
    const evil = { name: "</script><script>alert(1)</script>" };
    const out = jsonLd(evil);
    expect(out).not.toContain("</script");
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual(evil); // vẫn giải mã về đúng dữ liệu gốc
  });
  it("jsonLd thoát hai ký tự phân tách dòng Unicode", () => {
    const out = jsonLd({ a: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });
});

describe("tải ảnh: quy ước tên và nguồn ảnh", () => {
  it("tên tệp hợp lệ", () => expect(UPLOAD_NAME.test(`${"a1".repeat(16)}.webp`)).toBe(true));
  it.each(["../x.webp", `${"a".repeat(31)}.webp`, `${"A".repeat(32)}.webp`, `${"a".repeat(32)}.png`, `${"a".repeat(32)}.webp/x`, "..%2f.env", ""])("tên không hợp lệ %j", (n) => {
    expect(UPLOAD_NAME.test(n)).toBe(false);
  });
  it("đường dẫn ảnh tải lên hợp lệ", () => expect(UPLOAD_URL.test(`/api/uploads/${"0f".repeat(16)}.webp`)).toBe(true));
  it.each(["/api/uploads/../../.env", "/api/uploads/x.webp", "//evil.com/a.webp", "https://evil.com/a.webp"])("đường dẫn không hợp lệ %j", (u) => {
    expect(UPLOAD_URL.test(u)).toBe(false);
  });
  it("chỉ cho phép đúng các máy chủ ảnh đã khai báo", () => expect([...ALLOWED_IMAGE_HOSTS]).toEqual(["picsum.photos", "images.unsplash.com"]));
});

describe("email xác nhận", () => {
  const data = {
    code: "KGS-ABCD2345",
    guestName: `Khách <b>Test</b> & "Co" 'x'`,
    hotelName: "Hàn River <script>x</script>",
    hotelAddress: "88 Bạch Đằng",
    roomName: "Phòng Tiêu chuẩn",
    rooms: 2,
    guests: 3,
    checkIn: new Date("2027-08-10T00:00:00Z"),
    checkOut: new Date("2027-08-12T00:00:00Z"),
    nights: 2,
    totalPrice: 2_900_000,
    note: `<img src=x onerror=alert(1)> tầng cao`,
    link: "http://localhost:3000/bookings/abc",
  };
  const mail = buildConfirmationEmail(data);

  it("tiêu đề có mã đặt phòng và tên khách sạn", () => expect(mail.subject).toBe("Xác nhận đặt phòng KGS-ABCD2345 - Hàn River <script>x</script>"));
  it("HTML thoát mọi dữ liệu người dùng nhập", () => {
    expect(mail.html).toContain("Khách &lt;b&gt;Test&lt;/b&gt; &amp; &quot;Co&quot; &#39;x&#39;");
    expect(mail.html).toContain("Hàn River &lt;script&gt;x&lt;/script&gt;");
    expect(mail.html).toContain("&lt;img src=x onerror=alert(1)&gt; tầng cao");
    expect(mail.html).not.toContain("<script>x</script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<b>Test</b>");
  });
  it("có mã, tổng tiền, ngày và liên kết", () => {
    const html = nb(mail.html);
    expect(html).toContain("KGS-ABCD2345");
    expect(html).toContain("2.900.000 ₫");
    expect(html).toContain("10/08/2027");
    expect(html).toContain('href="http://localhost:3000/bookings/abc"');
  });
  it("bản văn bản thuần giữ nguyên chữ gốc (không thoát HTML)", () => {
    expect(mail.text).toContain("Khách <b>Test</b>");
    expect(nb(mail.text)).toContain("Tổng thanh toán: 2.900.000 ₫");
  });
  it("không có ghi chú thì không in dòng Yêu cầu", () => expect(buildConfirmationEmail({ ...data, note: null }).html).not.toContain("Yêu cầu"));
});
