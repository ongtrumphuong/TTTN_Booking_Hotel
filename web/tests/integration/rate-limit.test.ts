import { beforeEach, describe, expect, it } from "vitest";
import { LOGIN_LIMITS, LOGIN_WINDOW_MS, checkLoginAllowed, clearLoginFailures, recordLoginFailure } from "@/lib/login-throttle";
import { clear, hit, peek } from "@/lib/rate-limit";
import { prisma, resetDb } from "../helpers/db";

const MIN = 60_000;
const T0 = new Date("2026-10-20T10:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);

beforeEach(resetDb);

describe("hit / peek / clear", () => {
  it("đếm tăng dần trong cùng một cửa sổ", async () => {
    expect(await hit("k", 15 * MIN, T0)).toBe(1);
    expect(await hit("k", 15 * MIN, at(1))).toBe(2);
    expect(await hit("k", 15 * MIN, at(14))).toBe(3);
  });

  it("hết cửa sổ thì đếm lại từ 1 và dời mốc bắt đầu", async () => {
    await hit("k", 15 * MIN, T0);
    await hit("k", 15 * MIN, at(5));
    expect(await hit("k", 15 * MIN, at(16))).toBe(1);
    const row = await prisma.rateLimit.findUniqueOrThrow({ where: { key: "k" } });
    expect(row.windowStart.toISOString()).toBe(at(16).toISOString());
  });

  it("các khóa độc lập với nhau", async () => {
    await hit("a", 15 * MIN, T0);
    await hit("a", 15 * MIN, T0);
    expect(await hit("b", 15 * MIN, T0)).toBe(1);
  });

  it("25 yêu cầu đồng thời không mất lần đếm nào", async () => {
    const counts = await Promise.all(Array.from({ length: 25 }, () => hit("race", 15 * MIN, T0)));
    expect([...counts].sort((x, y) => x - y)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { key: "race" } })).count).toBe(25);
  });

  it("peek: chưa chạm ngưỡng thì không chặn", async () => {
    for (let i = 0; i < 4; i++) await hit("p", 15 * MIN, T0);
    expect(await peek("p", 5, 15 * MIN, at(1))).toEqual({ blocked: false, retryAfterSec: 0 });
  });

  it("peek: chạm ngưỡng thì chặn và cho biết còn bao lâu", async () => {
    for (let i = 0; i < 5; i++) await hit("p", 15 * MIN, T0);
    const state = await peek("p", 5, 15 * MIN, at(5));
    expect(state.blocked).toBe(true);
    expect(state.retryAfterSec).toBe(10 * 60);
  });

  it("peek: hết cửa sổ thì hết bị chặn", async () => {
    for (let i = 0; i < 5; i++) await hit("p", 15 * MIN, T0);
    expect((await peek("p", 5, 15 * MIN, at(15))).blocked).toBe(false);
  });

  it("peek: khóa chưa từng có thì không chặn", async () => expect((await peek("none", 1, MIN, T0)).blocked).toBe(false));

  it("peek không cộng thêm lần đếm", async () => {
    await hit("p", 15 * MIN, T0);
    await peek("p", 5, 15 * MIN, T0);
    await peek("p", 5, 15 * MIN, T0);
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { key: "p" } })).count).toBe(1);
  });

  it("clear xóa đúng các khóa được chỉ định", async () => {
    await hit("x", MIN, T0);
    await hit("y", MIN, T0);
    await hit("z", MIN, T0);
    await clear("x", "y");
    expect((await prisma.rateLimit.findMany({ select: { key: true } })).map((r) => r.key)).toEqual(["z"]);
    await clear(); // không có khóa nào: không lỗi
  });
});

describe("giới hạn đăng nhập sai", () => {
  const EMAIL = "khach@khongiansos.vn";
  const fail = async (email: string, ip: string, times: number, now = T0) => {
    for (let i = 0; i < times; i++) await recordLoginFailure(email, ip, now);
  };

  it("hằng số đúng thiết kế: 5 / 15 / 30 lần trong 15 phút", () => {
    expect(LOGIN_LIMITS).toEqual({ pair: 5, email: 15, ip: 30 });
    expect(LOGIN_WINDOW_MS).toBe(15 * MIN);
  });

  it("chưa sai lần nào thì được phép", async () => expect(await checkLoginAllowed(EMAIL, "1.1.1.1", T0)).toEqual({ allowed: true, retryAfterSec: 0 }));

  it("4 lần sai vẫn được thử, lần thứ 5 sai thì bị chặn", async () => {
    await fail(EMAIL, "1.1.1.1", 4);
    expect((await checkLoginAllowed(EMAIL, "1.1.1.1", T0)).allowed).toBe(true);
    await fail(EMAIL, "1.1.1.1", 1);
    const gate = await checkLoginAllowed(EMAIL, "1.1.1.1", at(1));
    expect(gate.allowed).toBe(false);
    expect(gate.retryAfterSec).toBe(14 * 60);
  });

  it("chặn theo cặp: IP khác hoặc tài khoản khác không bị ảnh hưởng", async () => {
    await fail(EMAIL, "1.1.1.1", 5);
    expect((await checkLoginAllowed(EMAIL, "2.2.2.2", T0)).allowed).toBe(true); // người dùng thật ở nơi khác
    expect((await checkLoginAllowed("admin@khongiansos.vn", "1.1.1.1", T0)).allowed).toBe(true);
  });

  it("email không phân biệt hoa thường và khoảng trắng thừa", async () => {
    await fail("Khach@KhongIanSos.vn ", "1.1.1.1", 5);
    expect((await checkLoginAllowed(EMAIL, "1.1.1.1", T0)).allowed).toBe(false);
  });

  it("dò mật khẩu từ nhiều IP: chặn theo email sau 15 lần, ở mọi IP", async () => {
    for (let i = 1; i <= 14; i++) await fail(EMAIL, `10.0.0.${i}`, 1);
    expect((await checkLoginAllowed(EMAIL, "10.9.9.9", T0)).allowed).toBe(true);
    await fail(EMAIL, "10.0.0.15", 1);
    expect((await checkLoginAllowed(EMAIL, "10.9.9.9", T0)).allowed).toBe(false);
  });

  it("một IP thử nhiều email: chặn theo IP sau 30 lần, với mọi tài khoản", async () => {
    for (let i = 1; i <= 29; i++) await fail(`u${i}@example.com`, "9.9.9.9", 1);
    expect((await checkLoginAllowed(EMAIL, "9.9.9.9", T0)).allowed).toBe(true);
    await fail("u30@example.com", "9.9.9.9", 1);
    expect((await checkLoginAllowed(EMAIL, "9.9.9.9", T0)).allowed).toBe(false);
  });

  it("hết 15 phút thì được thử lại", async () => {
    await fail(EMAIL, "1.1.1.1", 5);
    expect((await checkLoginAllowed(EMAIL, "1.1.1.1", at(14))).allowed).toBe(false);
    expect((await checkLoginAllowed(EMAIL, "1.1.1.1", at(15))).allowed).toBe(true);
  });

  it("đăng nhập đúng xóa bộ đếm của tài khoản nhưng giữ bộ đếm theo IP", async () => {
    await fail(EMAIL, "1.1.1.1", 4);
    await clearLoginFailures(EMAIL, "1.1.1.1");
    expect(await prisma.rateLimit.count({ where: { key: { startsWith: "login:pair:" } } })).toBe(0);
    expect(await prisma.rateLimit.count({ where: { key: { startsWith: "login:email:" } } })).toBe(0);
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { key: "login:ip:1.1.1.1" } })).count).toBe(4);
  });

  it("lần bị chặn không được cộng thêm: thời gian khóa không bị kéo dài", async () => {
    await fail(EMAIL, "1.1.1.1", 5);
    // người gọi chỉ ghi nhận thất bại khi KHÔNG bị chặn; kiểm tra rằng check không làm đổi bộ đếm
    await checkLoginAllowed(EMAIL, "1.1.1.1", at(1));
    await checkLoginAllowed(EMAIL, "1.1.1.1", at(2));
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { key: `login:pair:${EMAIL}|1.1.1.1` } })).count).toBe(5);
  });
});
