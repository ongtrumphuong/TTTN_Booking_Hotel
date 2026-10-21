import { describe, expect, it } from "vitest";
import { isAllowedPanorama, isEquirectangular } from "@/lib/panorama";
import { panoramaFor } from "../../prisma/panoramas";

describe("ảnh 360° hợp lệ", () => {
  it("chấp nhận ảnh mẫu đóng gói sẵn, ảnh đã tải lên và URL https từ máy chủ ảnh được phép", () => {
    expect(isAllowedPanorama("/panoramas/cabin.jpg")).toBe(true);
    expect(isAllowedPanorama("/panoramas/cayley_interior.jpg")).toBe(true);
    expect(isAllowedPanorama(`/api/uploads/${"a".repeat(32)}.webp`)).toBe(true);
    expect(isAllowedPanorama("https://images.unsplash.com/photo-1?w=4096")).toBe(true);
  });

  it("từ chối đường dẫn thoát thư mục, máy chủ lạ, http thường, scheme nguy hiểm", () => {
    for (const bad of [
      "/panoramas/../.env",
      "/panoramas/a/b.jpg",
      "/panoramas/x.png",
      "/panoramas/cabin.jpg?x=1",
      "https://evil.example.com/a.jpg",
      "http://images.unsplash.com/a.jpg",
      "javascript:alert(1)",
      "//images.unsplash.com/a.jpg",
      "data:image/jpeg;base64,AAAA",
      "",
    ]) {
      expect(isAllowedPanorama(bad), bad).toBe(false);
    }
  });
});

describe("tỷ lệ equirectangular", () => {
  it("chiều rộng gấp đôi chiều cao (lệch tối đa 5%)", () => {
    expect(isEquirectangular(8192, 4096)).toBe(true);
    expect(isEquirectangular(4000, 2000)).toBe(true);
    expect(isEquirectangular(4096, 2000)).toBe(true);
    expect(isEquirectangular(4000, 3000)).toBe(false);
    expect(isEquirectangular(2000, 2000)).toBe(false);
    expect(isEquirectangular(100, 0)).toBe(false);
  });
});

describe("ảnh mẫu theo loại phòng", () => {
  it("mọi ảnh mẫu đều qua kiểm tra hợp lệ", () => {
    for (const n of ["Phòng Tiêu chuẩn", "Phòng Deluxe", "Phòng Gia đình", "Suite Biển", "Phòng lạ"]) expect(isAllowedPanorama(panoramaFor(n))).toBe(true);
  });
  it("phòng gia đình dùng ảnh rộng, deluxe dùng ảnh có ban công, còn lại dùng phòng ngủ", () => {
    expect(panoramaFor("Phòng Gia đình")).toBe("/panoramas/anniversary_lounge.jpg");
    expect(panoramaFor("Phòng Deluxe")).toBe("/panoramas/cayley_interior.jpg");
    expect(panoramaFor("Phòng Tiêu chuẩn")).toBe("/panoramas/cabin.jpg");
  });
});
