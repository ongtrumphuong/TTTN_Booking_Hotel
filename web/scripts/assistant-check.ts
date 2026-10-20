// Kiểm tra khóa Gemini và model cho trợ lý ảo. Chạy sau khi điền GEMINI_API_KEY trong web/.env:
//
//   npx tsx --env-file=.env scripts/assistant-check.ts
//
// In ra: khóa có dùng được không, các model "flash" hỗ trợ generateContent, và thử một lượt gọi hàm (function calling) với model đang cấu hình.
const key = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
const base = "https://generativelanguage.googleapis.com/v1beta";

async function main() {
  if (!key) {
    console.error("Chưa có GEMINI_API_KEY trong web/.env. Tạo khóa miễn phí tại https://aistudio.google.com/apikey");
    process.exit(1);
  }

  const list = await fetch(`${base}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (!list.ok) {
    console.error(`Khóa không dùng được (${list.status}):`, (await list.json().catch(() => ({})))?.error?.message ?? "");
    process.exit(1);
  }
  const models = ((await list.json()).models ?? []) as { name: string; supportedGenerationMethods?: string[] }[];
  const usable = models.filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /flash/i.test(m.name)).map((m) => m.name.replace("models/", ""));
  console.log("Khóa hợp lệ. Model flash dùng được:", usable.slice(0, 12).join(", ") || "(không thấy)");
  if (!usable.includes(model)) console.warn(`Cảnh báo: "${model}" không có trong danh sách. Đặt GEMINI_MODEL thành một trong các tên ở trên.`);

  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Tìm phòng ở Đà Lạt từ 2027-01-10 đến 2027-01-12, dưới 1,5 triệu/đêm, view hồ Xuân Hương" }] }],
      tools: [
        {
          functionDeclarations: [
            {
              name: "search_rooms",
              description: "Tìm phòng còn trống",
              parameters: {
                type: "object",
                properties: {
                  city: { type: "string" },
                  checkIn: { type: "string" },
                  checkOut: { type: "string" },
                  maxPricePerNight: { type: "integer" },
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["city", "checkIn", "checkOut"],
              },
            },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Gọi model "${model}" thất bại (${res.status}):`, data?.error?.message ?? "");
    process.exit(1);
  }
  const call = data.candidates?.[0]?.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall)?.functionCall;
  console.log(call ? `Gọi hàm hoạt động: ${JSON.stringify(call)}` : "Model trả lời nhưng không gọi hàm (kiểm tra lại model).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
