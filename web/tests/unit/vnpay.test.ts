import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildPaymentUrl, verifySignature, vnpDate, vnpayConfig } from "@/lib/payments/vnpay";

const cfg = { tmnCode: "TESTTMN1", secret: "SECRETKEY-for-test-0123456789", payUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", appUrl: "http://localhost:3000" };

// ---- Đối chứng độc lập: thuật toán ký của mã mẫu Node.js chính thức của VNPay ----
// Mẫu dùng thư viện `qs` với { encode: false }: với đối tượng phẳng chỉ là nối "khóa=giá trị" bằng "&" (không mã hóa thêm).
function officialSample(params: Record<string, string>, secret: string) {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(params).map((k) => encodeURIComponent(k)).sort();
  for (const k of keys) sorted[k] = encodeURIComponent(params[decodeURIComponent(k)]).replace(/%20/g, "+");
  const signData = Object.entries(sorted).map(([k, v]) => `${k}=${v}`).join("&");
  return createHmac("sha512", secret).update(Buffer.from(signData, "utf-8")).digest("hex");
}

const now = new Date("2026-10-20T03:04:05.000Z");
const expire = new Date("2026-10-20T03:34:05.000Z");
const url = buildPaymentUrl(cfg, {
  txnRef: "KGSE8P3PZ7TMK3Z",
  amountVnd: 2_900_000,
  orderInfo: "Thanh toan dat phong KGS E8P3PZ7T",
  ipAddr: "127.0.0.1",
  returnUrl: "http://localhost:3000/api/payments/vnpay/return",
  now,
  expireAt: expire,
  bankCode: "VNBANK",
});
const query = Object.fromEntries(new URL(url).searchParams);
const { vnp_SecureHash, ...unsigned } = query;

describe("VNPay: tạo địa chỉ thanh toán", () => {
  it("dùng địa chỉ sandbox", () => expect(url.startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?")).toBe(true));
  it("số tiền nhân 100", () => expect(query.vnp_Amount).toBe("290000000"));
  it("giờ tạo và hết hạn theo GMT+7", () => {
    expect(query.vnp_CreateDate).toBe("20261020100405");
    expect(query.vnp_ExpireDate).toBe("20261020103405");
  });
  it("đủ tham số bắt buộc", () => {
    for (const k of ["vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_CurrCode", "vnp_IpAddr", "vnp_Locale", "vnp_OrderInfo", "vnp_OrderType", "vnp_ReturnUrl", "vnp_TxnRef"]) {
      expect(query[k], k).toBeTruthy();
    }
    expect(query.vnp_Version).toBe("2.1.0");
    expect(query.vnp_Command).toBe("pay");
    expect(query.vnp_CurrCode).toBe("VND");
    expect(query.vnp_BankCode).toBe("VNBANK");
  });
  it("chữ ký khớp thuật toán mẫu chính thức", () => expect(officialSample(unsigned, cfg.secret)).toBe(vnp_SecureHash));
  it("làm tròn số tiền lẻ trước khi nhân 100", () => {
    const q = Object.fromEntries(new URL(buildPaymentUrl(cfg, { txnRef: "A", amountVnd: 1000.4, orderInfo: "x", ipAddr: "1.1.1.1", returnUrl: "http://x.test/r", now })).searchParams);
    expect(q.vnp_Amount).toBe("100000");
  });
});

describe("VNPay: vnpDate (GMT+7)", () => {
  it.each([
    ["2026-10-20T00:00:00Z", "20261020070000"],
    ["2026-10-20T20:00:00Z", "20261021030000"], // qua nửa đêm giờ Việt Nam
    ["2026-12-31T17:00:00Z", "20270101000000"],
  ])("%s -> %s", (iso, expected) => expect(vnpDate(new Date(iso))).toBe(expected));
});

describe("VNPay: kiểm tra chữ ký", () => {
  it("chấp nhận địa chỉ do chính hệ thống tạo", () => expect(verifySignature(cfg, query)).toBe(true));
  it("chấp nhận khi có vnp_SecureHashType", () => expect(verifySignature(cfg, { ...query, vnp_SecureHashType: "HmacSHA512" })).toBe(true));
  it("từ chối khi đổi số tiền", () => expect(verifySignature(cfg, { ...query, vnp_Amount: "100" })).toBe(false));
  it("từ chối khi đổi mã giao dịch", () => expect(verifySignature(cfg, { ...query, vnp_TxnRef: "KHAC" })).toBe(false));
  it("từ chối khi sai khóa bí mật", () => expect(verifySignature({ ...cfg, secret: "sai" }, query)).toBe(false));
  it("từ chối khi thiếu chữ ký", () => expect(verifySignature(cfg, unsigned)).toBe(false));
  it("từ chối chữ ký sai độ dài hoặc không phải hex", () => {
    expect(verifySignature(cfg, { ...unsigned, vnp_SecureHash: "abc" })).toBe(false);
    expect(verifySignature(cfg, { ...unsigned, vnp_SecureHash: "z".repeat(128) })).toBe(false);
  });
  it("từ chối khi thêm tham số vnp_ lạ", () => expect(verifySignature(cfg, { ...query, vnp_Extra: "1" })).toBe(false));
  it("không bị đánh lừa bởi tham số không có tiền tố vnp_", () => expect(verifySignature(cfg, { ...query, thamSoLa: "1" })).toBe(true));

  const ret: Record<string, string> = { vnp_Amount: "290000000", vnp_BankCode: "NCB", vnp_BankTranNo: "", vnp_ResponseCode: "00", vnp_TmnCode: cfg.tmnCode, vnp_TransactionNo: "14000001", vnp_TransactionStatus: "00", vnp_TxnRef: "ABC" };
  it("chấp nhận phản hồi ký kiểu giữ tham số rỗng (mẫu Node)", () => {
    expect(verifySignature(cfg, { ...ret, vnp_SecureHash: officialSample(ret, cfg.secret) })).toBe(true);
  });
  it("chấp nhận phản hồi ký kiểu bỏ tham số rỗng (mẫu Java)", () => {
    const { vnp_BankTranNo: _omit, ...noEmpty } = ret;
    void _omit;
    expect(verifySignature(cfg, { ...ret, vnp_SecureHash: officialSample(noEmpty, cfg.secret) })).toBe(true);
  });
  it("ký đúng với giá trị chứa & = + % và khoảng trắng", () => {
    const odd = { vnp_Amount: "100", vnp_OrderInfo: "Thanh toan don A&B c=d +e %f", vnp_TxnRef: "X" };
    expect(verifySignature(cfg, { ...odd, vnp_SecureHash: officialSample(odd, cfg.secret) })).toBe(true);
  });
});

describe("VNPay: cấu hình từ môi trường", () => {
  it("trả về null khi chưa có khóa (dùng cổng giả lập)", () => expect(vnpayConfig()).toBeNull());
  it("chỉ có một trong hai khóa vẫn coi là chưa cấu hình", () => {
    process.env.VNPAY_TMN_CODE = "X";
    expect(vnpayConfig()).toBeNull();
    delete process.env.VNPAY_TMN_CODE;
  });
  it("có đủ khóa thì dùng sandbox mặc định và bỏ dấu / cuối của APP_URL", () => {
    process.env.VNPAY_TMN_CODE = "TMN";
    process.env.VNPAY_HASH_SECRET = "SEC";
    process.env.APP_URL = "https://stay.example.com///";
    const c = vnpayConfig();
    expect(c).toMatchObject({ tmnCode: "TMN", secret: "SEC", appUrl: "https://stay.example.com" });
    expect(c?.payUrl).toContain("sandbox.vnpayment.vn");
    delete process.env.VNPAY_TMN_CODE;
    delete process.env.VNPAY_HASH_SECRET;
    process.env.APP_URL = "http://localhost:3000";
  });
});
