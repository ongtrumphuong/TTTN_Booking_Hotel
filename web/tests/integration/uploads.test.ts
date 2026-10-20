import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, UploadError, readUpload, saveImage, uploadDir } from "@/lib/uploads";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "kgs-uploads-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

const solid = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 40, b: 40 } } });
const png = (w = 60, h = 40) => solid(w, h).png().toBuffer();
const jpg = (w = 60, h = 40) => solid(w, h).jpeg().toBuffer();
const webp = (w = 60, h = 40) => solid(w, h).webp().toBuffer();
const nameOf = (url: string) => url.replace("/api/uploads/", "");
const saved = (url: string) => readFileSync(path.join(dir, nameOf(url)));

describe("saveImage: ảnh hợp lệ", () => {
  it.each([
    ["JPEG", jpg],
    ["PNG", png],
    ["WebP", webp],
  ])("nhận %s và lưu dưới dạng WebP với tên ngẫu nhiên", async (_n, make) => {
    const url = await saveImage(await make());
    expect(url).toMatch(/^\/api\/uploads\/[a-f0-9]{32}\.webp$/);
    expect(existsSync(path.join(uploadDir(), nameOf(url)))).toBe(true);
    const buf = saved(url);
    expect(buf.subarray(0, 4).toString()).toBe("RIFF");
    expect(buf.subarray(8, 12).toString()).toBe("WEBP");
  });

  it("thu nhỏ ảnh lớn về tối đa 2000px, giữ tỷ lệ", async () => {
    const meta = await sharp(saved(await saveImage(await png(4000, 3000)))).metadata();
    expect([meta.width, meta.height]).toEqual([2000, 1500]);
  });

  it("không phóng to ảnh nhỏ", async () => {
    const meta = await sharp(saved(await saveImage(await png(120, 80)))).metadata();
    expect([meta.width, meta.height]).toEqual([120, 80]);
  });

  it("bỏ siêu dữ liệu EXIF (tác giả, bản quyền, vị trí)", async () => {
    const withExif = await solid(80, 60).jpeg().withExif({ IFD0: { Copyright: "SECRET-COPYRIGHT-TAG", Artist: "SECRET-ARTIST" } }).toBuffer();
    expect(withExif.toString("latin1")).toContain("SECRET-COPYRIGHT-TAG"); // đầu vào có thật
    const out = saved(await saveImage(withExif));
    expect(out.toString("latin1")).not.toContain("SECRET-COPYRIGHT-TAG");
    expect(out.toString("latin1")).not.toContain("SECRET-ARTIST");
    expect((await sharp(out).metadata()).exif).toBeUndefined();
  });

  it("xoay đúng theo hướng chụp (EXIF orientation) rồi bỏ cờ xoay", async () => {
    const rotated = await solid(100, 50).jpeg().withMetadata({ orientation: 6 }).toBuffer(); // cần xoay 90 độ
    const meta = await sharp(saved(await saveImage(rotated))).metadata();
    expect([meta.width, meta.height]).toEqual([50, 100]);
  });

  it("mỗi lần lưu cho một tên khác nhau", async () => {
    const buf = await png();
    const names = await Promise.all(Array.from({ length: 40 }, () => saveImage(buf)));
    expect(new Set(names).size).toBe(40);
  });
});

describe("saveImage: tệp không hợp lệ hoặc nguy hiểm", () => {
  const rejects = async (data: Buffer, message?: string) => {
    const before = readdirSync(dir).length;
    const err = await saveImage(data).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(UploadError);
    if (message) expect((err as Error).message).toContain(message);
    expect(readdirSync(dir).length).toBe(before); // không để lại tệp nào
  };

  it("tệp rỗng", () => rejects(Buffer.alloc(0), "rỗng"));
  it("mã PHP đội lốt ảnh", () => rejects(Buffer.from("<?php system($_GET['c']); ?>"), "không phải ảnh"));
  it("SVG (có thể chứa script)", () => rejects(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "không phải ảnh"));
  it("HTML đội lốt ảnh", () => rejects(Buffer.from("<html><script>alert(1)</script></html>"), "không phải ảnh"));
  it("GIF (định dạng không được phép)", async () => rejects(await solid(10, 10).gif().toBuffer(), "JPEG, PNG hoặc WebP"));
  it("TIFF (định dạng không được phép)", async () => rejects(await solid(10, 10).tiff().toBuffer(), "JPEG, PNG hoặc WebP"));
  it("ảnh bị cắt cụt", async () => rejects((await png(200, 200)).subarray(0, 60)));
  it("vượt 5 MB", () => rejects(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_FILE_BYTES)]), "5 MB"));

  it("'bom điểm ảnh': nhỏ về dung lượng nhưng vượt 50 triệu điểm ảnh", async () => {
    const bomb = await solid(9000, 9000).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(MAX_FILE_BYTES); // qua được giới hạn dung lượng
    await rejects(bomb);
  }, 60_000);

  it("mã độc nối đuôi ảnh bị loại bỏ khi mã hóa lại", async () => {
    const marker = "EVIL_PAYLOAD_MARKER_123";
    const polyglot = Buffer.concat([await png(), Buffer.from(`<script>${marker}</script>`)]);
    const url = await saveImage(polyglot);
    expect(saved(url).toString("latin1")).not.toContain(marker);
  });
});

describe("readUpload: chống đọc tệp ngoài thư mục ảnh", () => {
  it("đọc lại được ảnh đã lưu", async () => {
    const url = await saveImage(await png());
    const buf = await readUpload(nameOf(url));
    expect(buf?.length).toBeGreaterThan(0);
  });
  it.each(["../package.json", "..\\package.json", "%2e%2e%2fpackage.json", "x.webp", `${"a".repeat(32)}.webp.bak`, `${"A".repeat(32)}.webp`, `${"a".repeat(32)}.png`, "", "\u0000"])(
    "từ chối tên %j",
    async (name) => expect(await readUpload(name)).toBeNull(),
  );
  it("tên đúng dạng nhưng không tồn tại", async () => expect(await readUpload(`${"0".repeat(32)}.webp`)).toBeNull());
});
