"use client";

// Chỉ hiện khi layout gốc bị lỗi nên không dùng Tailwind hay font của layout; style nội tuyến để luôn hiển thị được.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbf8f3", color: "#10222b" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
          <p style={{ color: "#dc2626", fontWeight: 700, letterSpacing: 2, fontSize: 13 }}>CÓ LỖI XẢY RA</p>
          <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Rất tiếc, ứng dụng gặp sự cố</h1>
          <p style={{ color: "#5f6f76" }}>Vui lòng thử lại. Nếu lỗi vẫn tiếp diễn hãy liên hệ bộ phận hỗ trợ.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5f6f76" }}>Mã lỗi: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, background: "#0e7490", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
