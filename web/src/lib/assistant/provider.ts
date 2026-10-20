/** Lớp trừu tượng cho nhà cung cấp mô hình ngôn ngữ, để đổi nhà cung cấp (hoặc dùng bản giả khi kiểm thử) mà không sửa vòng lặp của trợ lý. */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolDecl = {
  name: string;
  description: string;
  /** JSON Schema (tập con mà Gemini hỗ trợ). */
  parameters: Record<string, unknown>;
};

export type ToolCall = { name: string; args: Record<string, unknown> };

export type ProviderTurn = { text: string; toolCalls: ToolCall[] };

/** Một cuộc hội thoại đang chạy với mô hình: lần lượt hỏi mô hình rồi đưa kết quả công cụ vào. */
export interface ProviderSession {
  next(): Promise<ProviderTurn>;
  addToolResults(calls: ToolCall[], results: unknown[]): void;
}

export interface AgentProvider {
  start(input: { system: string; history: ChatMessage[]; tools: ToolDecl[] }): ProviderSession;
}

/** Lỗi từ nhà cung cấp; `busy` = hết hạn mức/quá tải (nên báo khách thử lại sau, không phải lỗi hệ thống). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly busy = false,
  ) {
    super(message);
  }
}
