import { NextResponse, type NextRequest } from "next/server";
import { runAssistant, sanitizeHistory } from "@/lib/assistant/agent";
import { createGeminiProvider, isAssistantConfigured } from "@/lib/assistant/gemini";
import { ProviderError } from "@/lib/assistant/provider";
import { clientIpFrom } from "@/lib/login-throttle";
import { hit } from "@/lib/rate-limit";

const MAX_BODY_CHARS = 20_000;
const PER_IP_PER_HOUR = 30;
const GLOBAL_PER_HOUR = 200; // bảo vệ hạn mức của gói miễn phí

const reply = (text: string, status: number) => NextResponse.json({ reply: text, cards: [] }, { status });

/** Trợ lý ảo: nhận lịch sử hội thoại, trả lời kèm thẻ phòng. Trợ lý chỉ tìm và tư vấn, không tạo đơn và không thanh toán. */
export async function POST(req: NextRequest) {
  if (!isAssistantConfigured()) {
    return reply("Trợ lý ảo chưa được bật (chưa cấu hình GEMINI_API_KEY). Bạn vẫn có thể tìm phòng bằng ô tìm kiếm ở trang chủ.", 503);
  }

  const ip = clientIpFrom(req.headers);
  const [perIp, global] = await Promise.all([hit(`assistant:ip:${ip}`, 3_600_000), hit("assistant:global", 3_600_000)]);
  if (perIp > PER_IP_PER_HOUR) return reply("Bạn đã nhắn quá nhiều trong một giờ. Vui lòng thử lại sau.", 429);
  if (global > GLOBAL_PER_HOUR) return reply("Trợ lý đang có quá nhiều người dùng. Vui lòng thử lại sau ít phút.", 429);

  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return reply("Tin nhắn quá dài.", 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply("Yêu cầu không hợp lệ.", 400);
  }
  const history = sanitizeHistory((body as { messages?: unknown })?.messages);
  if (!history) return reply("Yêu cầu không hợp lệ.", 400);

  try {
    return NextResponse.json(await runAssistant(createGeminiProvider(), history));
  } catch (e) {
    if (e instanceof ProviderError && e.busy) return reply("Trợ lý đang quá tải hoặc hết lượt dùng miễn phí. Bạn thử lại sau ít phút nhé.", 503);
    console.error("[assistant]", e instanceof Error ? e.message : e);
    return reply("Xin lỗi, trợ lý đang gặp sự cố. Bạn thử lại sau hoặc dùng ô tìm kiếm ở trang chủ nhé.", 502);
  }
}
