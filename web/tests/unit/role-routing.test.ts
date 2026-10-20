import { describe, expect, it } from "vitest";
import { afterLoginPath, areaRedirect, homeFor, staffRedirect } from "@/lib/role-routing";

describe("homeFor", () => {
  it("mỗi vai trò có trang chủ riêng", () => {
    expect(homeFor("USER")).toBe("/");
    expect(homeFor("HOST")).toBe("/host");
    expect(homeFor("ADMIN")).toBe("/admin");
  });
});

describe("afterLoginPath: đăng nhập xong vào đâu", () => {
  it("quản trị viên luôn vào /admin; giữ đường dẫn nếu nó thuộc khu vực quản trị", () => {
    expect(afterLoginPath("ADMIN", "/")).toBe("/admin");
    expect(afterLoginPath("ADMIN", "/hotels/abc")).toBe("/admin");
    expect(afterLoginPath("ADMIN", "/host/payouts")).toBe("/admin");
    expect(afterLoginPath("ADMIN", "/admin/vouchers")).toBe("/admin/vouchers");
    expect(afterLoginPath("ADMIN", "/admin")).toBe("/admin");
  });
  it("đối tác luôn vào /host; giữ đường dẫn nếu nó thuộc khu vực đối tác", () => {
    expect(afterLoginPath("HOST", "/")).toBe("/host");
    expect(afterLoginPath("HOST", "/admin")).toBe("/host");
    expect(afterLoginPath("HOST", "/host/bookings?status=CONFIRMED")).toBe("/host/bookings?status=CONFIRMED");
  });
  it("khách vào đường dẫn định vào, nhưng không bị đưa vào khu vực quản trị/đối tác", () => {
    expect(afterLoginPath("USER", "/bookings")).toBe("/bookings");
    expect(afterLoginPath("USER", "/admin")).toBe("/");
    expect(afterLoginPath("USER", "/host/hotels")).toBe("/");
  });
  it("không nhầm tiền tố giống tên: /administrator, /hostel không thuộc khu vực quản trị/đối tác", () => {
    expect(afterLoginPath("ADMIN", "/administrator")).toBe("/admin");
    expect(afterLoginPath("USER", "/hostel")).toBe("/hostel");
    expect(afterLoginPath("HOST", "/hostel")).toBe("/host");
  });
});

describe("staffRedirect: quản trị viên và đối tác không vào được giao diện khách", () => {
  it("khách và người chưa đăng nhập không bị chuyển hướng ở đây", () => {
    for (const p of ["/", "/hotels", "/admin", "/host/x"]) {
      expect(staffRedirect("USER", p)).toBeNull();
      expect(staffRedirect(null, p)).toBeNull();
      expect(staffRedirect(undefined, p)).toBeNull();
    }
  });
  it("quản trị viên ở trong /admin thì đi tiếp; mọi nơi khác bị đưa về /admin", () => {
    expect(staffRedirect("ADMIN", "/admin")).toBeNull();
    expect(staffRedirect("ADMIN", "/admin/hotels/abc")).toBeNull();
    for (const p of ["/", "/hotels", "/hotels/dalat", "/book/xyz", "/bookings", "/favorites", "/login", "/partner", "/assistant/confirm", "/host", "/host/payouts"]) {
      expect(staffRedirect("ADMIN", p)).toBe("/admin");
    }
  });
  it("đối tác ở trong /host thì đi tiếp; mọi nơi khác (kể cả /admin) bị đưa về /host", () => {
    expect(staffRedirect("HOST", "/host")).toBeNull();
    expect(staffRedirect("HOST", "/host/hotels/new")).toBeNull();
    for (const p of ["/", "/hotels", "/bookings", "/register", "/partner/register", "/admin", "/admin/users"]) {
      expect(staffRedirect("HOST", p)).toBe("/host");
    }
  });
  it("/account được đưa sang trang tài khoản riêng của khu vực để vẫn đổi hồ sơ và mật khẩu được", () => {
    expect(staffRedirect("ADMIN", "/account")).toBe("/admin/account");
    expect(staffRedirect("HOST", "/account")).toBe("/host/account");
    expect(staffRedirect("ADMIN", "/admin/account")).toBeNull();
  });
  it("tiền tố gần giống không được coi là thuộc khu vực", () => {
    expect(staffRedirect("ADMIN", "/administrator")).toBe("/admin");
    expect(staffRedirect("HOST", "/hostel")).toBe("/host");
  });
});

describe("areaRedirect: chuyển hướng sớm cho mọi vai trò", () => {
  it("chưa đăng nhập vào /admin hoặc /host thì sang đăng nhập, kèm đường dẫn để quay lại", () => {
    expect(areaRedirect(null, "/admin")).toBe("/login?callbackUrl=%2Fadmin");
    expect(areaRedirect(null, "/host/bookings", "?status=CONFIRMED")).toBe("/login?callbackUrl=%2Fhost%2Fbookings%3Fstatus%3DCONFIRMED");
  });
  it("khách vào /admin hoặc /host thì về trang chủ", () => {
    expect(areaRedirect("USER", "/admin/users")).toBe("/");
    expect(areaRedirect("USER", "/host")).toBe("/");
  });
  it("đúng vai trò thì đi tiếp; trang của khách luôn đi tiếp với khách và người chưa đăng nhập", () => {
    expect(areaRedirect("ADMIN", "/admin/vouchers")).toBeNull();
    expect(areaRedirect("HOST", "/host/payouts")).toBeNull();
    for (const p of ["/", "/hotels", "/login", "/partner", "/bookings"]) {
      expect(areaRedirect("USER", p)).toBeNull();
      expect(areaRedirect(null, p)).toBeNull();
    }
  });
  it("đối tác vào /admin và quản trị viên vào /host bị đưa về khu vực của mình", () => {
    expect(areaRedirect("HOST", "/admin/users")).toBe("/host");
    expect(areaRedirect("ADMIN", "/host/hotels")).toBe("/admin");
  });
  it("tiền tố giống tên không bị coi là khu vực: /administrator và /hostel dành cho khách", () => {
    expect(areaRedirect(null, "/administrator")).toBeNull();
    expect(areaRedirect("USER", "/hostel")).toBeNull();
  });
});
