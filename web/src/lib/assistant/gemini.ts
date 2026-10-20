import "server-only";
import { ProviderError, type AgentProvider, type ChatMessage, type ProviderSession, type ProviderTurn, type ToolCall, type ToolDecl } from "./provider";

// Model mặc định; đổi bằng biến GEMINI_MODEL nếu tên model thay đổi hoặc muốn dùng model khác của gói miễn phí.
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 25_000;

export const isAssistantConfigured = () => !!process.env.GEMINI_API_KEY?.trim();

type Part = Record<string, unknown>;
type Content = { role: "user" | "model"; parts: Part[] };

type GeminiResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

class GeminiSession implements ProviderSession {
  // Nội dung được giữ nguyên dạng mà Gemini trả về (kể cả các trường chữ ký suy luận) rồi gửi lại ở lượt sau.
  private contents: Content[];

  constructor(
    private readonly system: string,
    history: ChatMessage[],
    private readonly tools: ToolDecl[],
    private readonly fetcher: typeof fetch,
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    this.contents = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  }

  async next(): Promise<ProviderTurn> {
    let res: Response;
    try {
      res = await this.fetcher(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: this.system }] },
          contents: this.contents,
          tools: [{ functionDeclarations: this.tools }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new ProviderError(`Không gọi được Gemini: ${e instanceof Error ? e.message : String(e)}`, true);
    }

    const data = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      const busy = res.status === 429 || res.status === 503 || data.error?.status === "RESOURCE_EXHAUSTED";
      throw new ProviderError(`Gemini ${res.status}: ${data.error?.message ?? "lỗi không rõ"}`, busy);
    }

    const content = data.candidates?.[0]?.content;
    if (!content?.parts?.length) {
      throw new ProviderError(`Gemini không trả nội dung (${data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? "không rõ lý do"})`);
    }
    this.contents.push({ role: "model", parts: content.parts });

    const text = content.parts
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text as string)
      .join("")
      .trim();
    const toolCalls: ToolCall[] = content.parts
      .filter((p) => p.functionCall && typeof (p.functionCall as { name?: unknown }).name === "string")
      .map((p) => {
        const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
        return { name: fc.name, args: fc.args ?? {} };
      });
    return { text, toolCalls };
  }

  addToolResults(calls: ToolCall[], results: unknown[]) {
    this.contents.push({
      role: "user",
      parts: calls.map((c, i) => ({ functionResponse: { name: c.name, response: { result: results[i] } } })),
    });
  }
}

export function createGeminiProvider(opts: { apiKey?: string; model?: string; fetcher?: typeof fetch } = {}): AgentProvider {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ProviderError("Thiếu GEMINI_API_KEY");
  const model = opts.model ?? (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
  return {
    start: ({ system, history, tools }) => new GeminiSession(system, history, tools, opts.fetcher ?? fetch, apiKey, model),
  };
}
