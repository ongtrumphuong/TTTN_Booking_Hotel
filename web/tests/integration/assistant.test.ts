import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

const session = vi.hoisted(() => ({ user: { id: "", name: "Khách", role: "USER" as const, email: "k@test.local" } }));
vi.mock("@/lib/session", () => ({ requireUser: async () => session.user, getCurrentUser: async () => session.user, safeRedirect: (p: string) => p }));
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));
vi.mock("@/lib/assistant/gemini", async (orig) => {
  const real = await orig<typeof import("@/lib/assistant/gemini")>();
  return { ...real, createGeminiProvider: vi.fn() };
});

import { confirmProposalAction } from "@/app/actions/assistant";
import { POST } from "@/app/api/assistant/route";
import { runAssistant } from "@/lib/assistant/agent";
import { createGeminiProvider } from "@/lib/assistant/gemini";
import { ProviderError, type AgentProvider, type ProviderSession, type ProviderTurn, type ToolCall } from "@/lib/assistant/provider";
import { signProposal, verifyProposal } from "@/lib/assistant/proposal";
import { searchRooms } from "@/lib/assistant/search";

const iso = (n: number) => daysFromToday(n).toISOString().slice(0, 10);
const IN = iso(10);
const OUT = iso(12);

/** Đà Lạt: A có phòng nhìn hồ (rẻ và đắt), B rẻ nhưng không có view, C ở nơi khác. */
async function seed() {
  const dalatA = await mkHotel({ city: "Đà Lạt", name: "Hồ Xuân Hương Hotel", rooms: [{ name: "Phòng Tiêu chuẩn", price: 1_350_000, capacity: 2, quantity: 2 }, { name: "Phòng Deluxe", price: 1_820_000, capacity: 2, quantity: 2 }, { name: "Phòng Gia đình", price: 1_400_000, capacity: 4, quantity: 1 }] });
  await prisma.room.update({ where: { id: dalatA.rooms[0].id }, data: { highlights: ["View hồ Xuân Hương"] } });
  await prisma.room.update({ where: { id: dalatA.rooms[1].id }, data: { highlights: ["View hồ Xuân Hương", "Ban công"] } });
  await prisma.hotel.update({ where: { id: dalatA.id }, data: { highlights: ["Gần Hồ Xuân Hương"] } });
  const dalatB = await mkHotel({ city: "Đà Lạt", name: "Phố Núi Inn", rooms: [{ name: "Phòng Tiêu chuẩn", price: 900_000, capacity: 2, quantity: 3 }] });
  const hanoi = await mkHotel({ city: "Hà Nội", name: "Phố Cổ Hotel", rooms: [{ name: "Phòng Tiêu chuẩn", price: 1_000_000, capacity: 2, quantity: 3 }] });
  return { dalatA, dalatB, hanoi, standardLake: dalatA.rooms[0], deluxeLake: dalatA.rooms[1], family: dalatA.rooms[2] };
}

let guestId: string;
beforeEach(async () => {
  await resetDb();
  guestId = (await mkUser()).id;
  session.user = { ...session.user, id: guestId };
  redirect.mockClear();
  vi.mocked(createGeminiProvider).mockReset();
});

describe("searchRooms: tìm phòng theo yêu cầu của khách", () => {
  it("ví dụ chính: Đà Lạt, dưới 1,5tr/đêm, view hồ Xuân Hương (không dấu, không phân biệt hoa thường)", async () => {
    const s = await seed();
    const r = await searchRooms({ city: "da lat", checkIn: IN, checkOut: OUT, guests: 2, maxPricePerNight: 1_500_000, keywords: ["VIEW HỒ XUÂN HƯƠNG"] });
    if (!r.ok) throw new Error(r.error);
    expect(r.exact.map((o) => o.roomId)).toEqual([s.standardLake.id]);
    expect(r.exact[0]).toMatchObject({ hotelName: "Hồ Xuân Hương Hotel", pricePerNight: 1_350_000, nights: 2, total: 2_700_000 });
    expect(r.exact[0].matched).toEqual(["VIEW HỒ XUÂN HƯƠNG"]);
    // Phòng cùng view nhưng đắt hơn ngân sách được gợi ý riêng và nói rõ lý do.
    expect(r.alternatives.map((o) => o.roomId)).toContain(s.deluxeLake.id);
    expect(r.alternatives.find((o) => o.roomId === s.deluxeLake.id)?.note).toMatch(/vượt ngân sách 320\.000/);
    // Phòng không có view không lọt vào kết quả chính.
    expect(r.exact.some((o) => o.hotelName === "Phố Núi Inn")).toBe(false);
  });

  it("token đề xuất trong kết quả xác thực đúng phòng, ngày, số khách", async () => {
    const s = await seed();
    const r = await searchRooms({ city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: 2, keywords: ["hồ Xuân Hương"] });
    if (!r.ok) throw new Error(r.error);
    expect(verifyProposal(r.exact[0].proposalToken)).toEqual({ roomId: r.exact[0].roomId, checkIn: IN, checkOut: OUT, guests: 2, rooms: 1 });
    expect(r.exact.map((o) => o.roomId)).toContain(s.standardLake.id);
  });

  it("không có phòng nào khớp hẳn thì vẫn gợi ý phòng đúng ngân sách và đủ sức chứa (kèm điều còn thiếu)", async () => {
    const s = await seed();
    const r = await searchRooms({ city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: 4, maxPricePerNight: 1_500_000, keywords: ["view hồ Xuân Hương"] });
    if (!r.ok) throw new Error(r.error);
    expect(r.exact).toEqual([]);
    expect(r.alternatives.map((o) => o.roomId)).toEqual([s.family.id]);
    expect(r.alternatives[0].note).toMatch(/chưa thấy: view hồ Xuân Hương/);
  });

  it("không có từ khóa: trả mọi phòng đủ điều kiện, sắp theo độ phù hợp", async () => {
    await seed();
    const r = await searchRooms({ city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: 2, maxPricePerNight: 1_000_000 });
    if (!r.ok) throw new Error(r.error);
    expect(r.exact.map((o) => o.hotelName)).toEqual(["Phố Núi Inn"]);
  });

  it("bỏ phòng hết chỗ, phòng bị chặn, phòng không đủ sức chứa, khách sạn/phòng đã ẩn", async () => {
    const s = await seed();
    // Hết sạch phòng Tiêu chuẩn của A trong khoảng ngày
    await mkBooking({ userId: guestId, roomId: s.standardLake.id, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", rooms: 2 });
    // Phòng Deluxe bị chặn
    await prisma.roomBlock.create({ data: { roomId: s.deluxeLake.id, startDate: daysFromToday(10), endDate: daysFromToday(13), rooms: 2 } });
    // Khách sạn B bị ẩn
    await prisma.hotel.update({ where: { id: s.dalatB.id }, data: { isActive: false } });

    const r = await searchRooms({ city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: 2 });
    if (!r.ok) throw new Error(r.error);
    const all = [...r.exact, ...r.alternatives].map((o) => o.roomId);
    expect(all).toEqual([s.family.id]); // chỉ còn phòng Gia đình: Tiêu chuẩn hết chỗ, Deluxe bị chặn, khách sạn B bị ẩn
  }, 20_000);

  it("khách đông thì chỉ phòng đủ sức chứa; nhiều phòng thì nhân tổng tiền", async () => {
    const s = await seed();
    const big = await searchRooms({ city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: 4 });
    if (!big.ok) throw new Error(big.error);
    expect(big.exact.map((o) => o.roomId)).toContain(s.family.id);
    expect(big.exact.every((o) => o.capacity >= 4 || o.roomsLeft >= 2)).toBe(true);

    const two = await searchRooms({ city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: 2, rooms: 2, keywords: ["hồ Xuân Hương"], maxPricePerNight: 1_500_000 });
    if (!two.ok) throw new Error(two.error);
    expect(two.exact[0].total).toBe(1_350_000 * 2 * 2);
  });

  it("lỗi rõ ràng: ngày không hợp lệ, ngày quá khứ, điểm đến chưa có (kèm danh sách điểm đến)", async () => {
    await seed();
    expect(await searchRooms({ city: "Đà Lạt", checkIn: "20/10", checkOut: "22/10" })).toMatchObject({ ok: false });
    expect(await searchRooms({ city: "Đà Lạt", checkIn: OUT, checkOut: IN })).toMatchObject({ ok: false });
    const past = await searchRooms({ city: "Đà Lạt", checkIn: iso(-3), checkOut: iso(-1) });
    expect(past).toMatchObject({ ok: false });
    const unknown = await searchRooms({ city: "Sao Hỏa", checkIn: IN, checkOut: OUT });
    expect(unknown).toMatchObject({ ok: false });
    if (!unknown.ok) expect(unknown.error).toMatch(/Đà Lạt/);
  });
});

/** Mô hình giả: chạy theo kịch bản các lượt trả về, ghi lại những gì được gửi vào. */
function scripted(turns: ProviderTurn[]) {
  const seen: { toolResults: unknown[][]; history?: unknown } = { toolResults: [] };
  const provider: AgentProvider = {
    start: ({ history }) => {
      seen.history = history;
      let i = 0;
      const s: ProviderSession = {
        next: async () => turns[Math.min(i++, turns.length - 1)],
        addToolResults: (_c: ToolCall[], results: unknown[]) => void seen.toolResults.push(results),
      };
      return s;
    },
  };
  return { provider, seen };
}

describe("runAssistant: vòng lặp trợ lý", () => {
  it("chạy công cụ do mô hình yêu cầu, đưa kết quả (không chứa token) lại cho mô hình, trả lời kèm thẻ phòng", async () => {
    const s = await seed();
    const { provider, seen } = scripted([
      { text: "", toolCalls: [{ name: "search_rooms", args: { city: "Đà Lạt", checkIn: IN, checkOut: OUT, guests: "2", maxPricePerNight: "1500000", keywords: ["view hồ Xuân Hương"] } }] },
      { text: "Mình tìm được 1 phòng phù hợp.", toolCalls: [] },
    ]);
    const out = await runAssistant(provider, [{ role: "user", content: "Đà Lạt 2 đêm dưới 1tr5 view hồ Xuân Hương" }]);

    expect(out.reply).toBe("Mình tìm được 1 phòng phù hợp.");
    expect(out.cards.filter((c) => !c.alternative).map((c) => c.option.roomId)).toEqual([s.standardLake.id]);
    expect(out.cards.some((c) => c.alternative)).toBe(true);

    const sentToModel = JSON.stringify(seen.toolResults);
    expect(sentToModel).not.toContain("proposalToken");
    expect(sentToModel).not.toContain("imageUrl");
    expect(sentToModel).toContain("Hồ Xuân Hương Hotel");
    expect(sentToModel).toContain("1.350.000");
  });

  it("công cụ lạ bị từ chối nhưng không làm hỏng cuộc trò chuyện; tham số xấu không làm lỗi", async () => {
    await seed();
    const { provider, seen } = scripted([
      { text: "", toolCalls: [{ name: "book_room", args: { roomId: "x" } }, { name: "search_rooms", args: { city: 123, checkIn: {}, checkOut: null, guests: "abc", keywords: [1, "hồ"] } }] },
      { text: "Bạn cho mình ngày đi nhé.", toolCalls: [] },
    ]);
    const out = await runAssistant(provider, [{ role: "user", content: "đặt phòng giúp tôi" }]);
    expect(out.reply).toBe("Bạn cho mình ngày đi nhé.");
    expect(out.cards).toEqual([]);
    expect(JSON.stringify(seen.toolResults)).toContain("Không có công cụ book_room");
  });

  it("chặn vòng lặp công cụ vô hạn và báo lỗi nhà cung cấp", async () => {
    await seed();
    const loop: ProviderTurn = { text: "", toolCalls: [{ name: "search_rooms", args: { city: "Đà Lạt", checkIn: IN, checkOut: OUT } }] };
    await expect(runAssistant(scripted([loop]).provider, [{ role: "user", content: "x" }])).rejects.toBeInstanceOf(ProviderError);
  });

  it("mô hình trả văn bản rỗng thì có câu trả lời dự phòng", async () => {
    const out = await runAssistant(scripted([{ text: "", toolCalls: [] }]).provider, [{ role: "user", content: "x" }]);
    expect(out.reply).toMatch(/chưa trả lời được/);
  });
});

const call = (body: unknown, ip = "9.9.9.9") =>
  POST(new Request("http://localhost/api/assistant", { method: "POST", headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }) as never);

describe("POST /api/assistant", () => {
  const old = process.env.GEMINI_API_KEY;
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("chưa cấu hình khóa thì báo rõ và không gọi nhà cung cấp", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await call({ messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(503);
    expect((await res.json()).reply).toMatch(/GEMINI_API_KEY/);
    expect(createGeminiProvider).not.toHaveBeenCalled();
    if (old) process.env.GEMINI_API_KEY = old;
  });

  it("từ chối yêu cầu sai định dạng hoặc quá dài", async () => {
    expect((await call("không phải json")).status).toBe(400);
    expect((await call({ messages: "x" })).status).toBe(400);
    expect((await call({ messages: [{ role: "assistant", content: "x" }] })).status).toBe(400);
    expect((await call("x".repeat(25_000))).status).toBe(413);
  });

  it("trả lời thành công kèm thẻ phòng; lỗi quá tải báo 503 thân thiện; lỗi khác báo 502", async () => {
    await seed();
    const ok = scripted([
      { text: "", toolCalls: [{ name: "search_rooms", args: { city: "Đà Lạt", checkIn: IN, checkOut: OUT, keywords: ["hồ Xuân Hương"] } }] },
      { text: "Đây là các phòng.", toolCalls: [] },
    ]);
    vi.mocked(createGeminiProvider).mockReturnValue(ok.provider);
    const res = await call({ messages: [{ role: "user", content: "Đà Lạt view hồ" }] }, "1.1.1.1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Đây là các phòng.");
    expect(data.cards.length).toBeGreaterThan(0);

    vi.mocked(createGeminiProvider).mockReturnValue({ start: () => ({ next: async () => { throw new ProviderError("quota", true); }, addToolResults() {} }) });
    const busy = await call({ messages: [{ role: "user", content: "x" }] }, "1.1.1.2");
    expect(busy.status).toBe(503);
    expect((await busy.json()).reply).toMatch(/quá tải/);

    vi.mocked(createGeminiProvider).mockReturnValue({ start: () => ({ next: async () => { throw new Error("boom"); }, addToolResults() {} }) });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call({ messages: [{ role: "user", content: "x" }] }, "1.1.1.3")).status).toBe(502);
    err.mockRestore();
  });

  it("giới hạn số tin nhắn mỗi giờ theo địa chỉ IP", async () => {
    vi.mocked(createGeminiProvider).mockReturnValue(scripted([{ text: "ok", toolCalls: [] }]).provider);
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await call({ messages: [{ role: "user", content: "hi" }] }, "7.7.7.7")).status;
    expect(last).toBe(429);
  }, 30_000);
});

describe("xác nhận giữ phòng do trợ lý đề xuất", () => {
  const stay = { checkIn: IN, checkOut: OUT };

  it("khách bấm xác nhận: tạo đơn Chờ thanh toán với giá tính ở máy chủ rồi chuyển sang trang thanh toán", async () => {
    const s = await seed();
    const result = await confirmProposalAction(signProposal({ roomId: s.standardLake.id, ...stay, guests: 2, rooms: 1 }));
    expect(result).toBeUndefined(); // redirect (giả lập) kết thúc hàm
    const b = await prisma.booking.findFirstOrThrow({ where: { userId: guestId } });
    expect(b).toMatchObject({ roomId: s.standardLake.id, status: "PENDING", paymentStatus: "UNPAID", totalPrice: 1_350_000 * 2, guests: 2, rooms: 1 });
    expect(redirect).toHaveBeenCalledWith(`/bookings/${b.id}/pay`);
  });

  it("từ chối token giả mạo hoặc hết hạn; không tạo đơn", async () => {
    const s = await seed();
    const token = signProposal({ roomId: s.standardLake.id, ...stay, guests: 2, rooms: 1 });
    expect((await confirmProposalAction(token.slice(0, -3) + "xxx"))?.error).toMatch(/hết hạn|không hợp lệ/);
    expect((await confirmProposalAction(signProposal({ roomId: s.standardLake.id, ...stay, guests: 2, rooms: 1 }, Date.now() - 2 * 3_600_000)))?.error).toMatch(/hết hạn/);
    expect(await prisma.booking.count()).toBe(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("phòng vừa hết sau khi trợ lý đề xuất thì báo rõ, không tạo đơn", async () => {
    const s = await seed();
    const token = signProposal({ roomId: s.standardLake.id, ...stay, guests: 2, rooms: 1 });
    await mkBooking({ userId: (await mkUser()).id, roomId: s.standardLake.id, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", rooms: 2 });
    expect((await confirmProposalAction(token))?.error).toMatch(/vừa hết/);
    expect(await prisma.booking.count({ where: { userId: guestId } })).toBe(0);
  });

  it("dùng cùng một đề xuất hai lần chỉ tạo thêm đơn nếu còn phòng (không vượt số phòng)", async () => {
    const s = await seed(); // Tiêu chuẩn còn 2 phòng
    const token = signProposal({ roomId: s.standardLake.id, ...stay, guests: 2, rooms: 1 });
    await confirmProposalAction(token);
    await confirmProposalAction(token);
    const third = await confirmProposalAction(token);
    expect(third?.error).toMatch(/vừa hết/);
    expect(await prisma.booking.count({ where: { userId: guestId } })).toBe(2);
  });
});
