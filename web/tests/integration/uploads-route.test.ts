import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Ai được tải ảnh lên: quản trị viên và đối tác (form khách sạn/phòng dùng chung), không phải khách thường hay người chưa đăng nhập.
const session = vi.hoisted(() => ({ user: null as null | { id: string; role: "USER" | "ADMIN" | "HOST" } }));
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => session.user }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/uploads/route";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "kgs-route-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

async function upload() {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } } }).png().toBuffer();
  const form = new FormData();
  form.append("files", new File([new Uint8Array(png)], "anh.png", { type: "image/png" }));
  return POST(new NextRequest("http://localhost/api/admin/uploads", { method: "POST", body: form, headers: { "content-length": String(png.length + 300) } }));
}

describe("POST /api/admin/uploads: phân quyền", () => {
  it("chưa đăng nhập: 401", async () => {
    session.user = null;
    expect((await upload()).status).toBe(401);
  });

  it("khách thường: 403", async () => {
    session.user = { id: "u1", role: "USER" };
    expect((await upload()).status).toBe(403);
  });

  it.each(["ADMIN", "HOST"] as const)("%s: tải được ảnh", async (role) => {
    session.user = { id: "u2", role };
    const res = await upload();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { urls: string[] };
    expect(body.urls).toHaveLength(1);
    expect(body.urls[0]).toMatch(/^\/api\/uploads\//);
  });
});
