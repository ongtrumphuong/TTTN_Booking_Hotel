// Xuất CSV mở được bằng Excel: có BOM UTF-8 để tiếng Việt không vỡ chữ, xuống dòng CRLF.
// Chặn "CSV injection": ô văn bản bắt đầu bằng = + - @ (hoặc tab/CR) sẽ bị Excel hiểu là công thức, nên thêm dấu nháy đơn phía trước.
// Dữ liệu như tên khách, ghi chú do người dùng nhập nên không thể tin là an toàn.

export type CsvValue = string | number | null | undefined;

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = v;
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Phản hồi tải tệp CSV. */
export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
