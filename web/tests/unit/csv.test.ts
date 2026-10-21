import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("giữ nguyên văn bản thường và số; ô rỗng cho null/undefined/NaN", () => {
    expect(csvCell("Nguyễn Văn An")).toBe("Nguyễn Văn An");
    expect(csvCell(1250000)).toBe("1250000");
    expect(csvCell(-5)).toBe("-5"); // số âm là số, không phải công thức
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("đặt trong nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng, và nhân đôi nháy kép", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('nói "xin chào"')).toBe('"nói ""xin chào"""');
    expect(csvCell("dòng 1\ndòng 2")).toBe('"dòng 1\ndòng 2"');
  });

  it("chặn CSV injection: ô văn bản bắt đầu bằng = + - @ tab CR được thêm dấu nháy đơn", () => {
    for (const bad of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      const out = csvCell(bad);
      expect(out.replace(/^"/, "").startsWith("'"), bad).toBe(true);
    }
    expect(csvCell("a=b")).toBe("a=b"); // chỉ xét ký tự đầu
  });
});

describe("toCsv", () => {
  it("có BOM UTF-8, dòng tiêu đề, CRLF và dòng cuối có xuống dòng", () => {
    const out = toCsv(["Mã", "Khách"], [["KGS-1", "An"], ["KGS-2", "=cmd"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out.slice(1)).toBe("Mã,Khách\r\nKGS-1,An\r\nKGS-2,'=cmd\r\n");
  });
});
