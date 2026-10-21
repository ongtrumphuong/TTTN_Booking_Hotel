import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UploadError, saveImage } from "@/lib/uploads";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "kgs-pano-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

const jpg = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 90, b: 160 } } }).jpeg().toBuffer();
const read = (url: string) => readFileSync(path.join(dir, url.replace("/api/uploads/", "")));

describe("saveImage: ảnh 360°", () => {
  it("nhận ảnh tỷ lệ 2:1 và giữ độ phân giải cao hơn ảnh thường (tối đa 6000px)", async () => {
    const url = await saveImage(await jpg(8000, 4000), { panorama: true });
    const meta = await sharp(read(url)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(6000);
    expect(meta.height).toBe(3000);
  });

  it("ảnh nhỏ không bị phóng to", async () => {
    const url = await saveImage(await jpg(1024, 512), { panorama: true });
    expect((await sharp(read(url)).metadata()).width).toBe(1024);
  });

  it("từ chối ảnh không đúng tỷ lệ 2:1", async () => {
    await expect(saveImage(await jpg(1000, 1000), { panorama: true })).rejects.toThrow(UploadError);
    await expect(saveImage(await jpg(1200, 800), { panorama: true })).rejects.toThrow(/gấp đôi/);
  });

  it("ảnh thường vẫn thu nhỏ về 2000px như trước", async () => {
    const url = await saveImage(await jpg(4000, 2000));
    expect((await sharp(read(url)).metadata()).width).toBe(2000);
  });
});
