"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { clientIpFrom } from "@/lib/login-throttle";
import { sendPasswordResetEmail } from "@/lib/email";
import { consumeResetToken, createResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { hit } from "@/lib/rate-limit";
import { requireUser, safeRedirect } from "@/lib/session";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; email?: string; done?: boolean; values?: Record<string, string> };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ")),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

const passwordRule = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .regex(/[A-Za-z]/, "Mật khẩu cần có chữ cái")
  .regex(/\d/, "Mật khẩu cần có chữ số");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ")),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)\d{9}$/, "Số điện thoại không hợp lệ")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .regex(/[A-Za-z]/, "Mật khẩu cần có chữ cái")
    .regex(/\d/, "Mật khẩu cần có chữ số"),
});

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: String(formData.get("email") ?? "") };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirect(String(formData.get("callbackUrl") ?? "")),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      if ((e as { code?: string }).code === "too_many_attempts") {
        return { error: "Bạn đã nhập sai quá nhiều lần. Vì lý do an toàn, vui lòng thử lại sau khoảng 15 phút.", email: parsed.data.email };
      }
      return { error: "Email hoặc mật khẩu không đúng", email: parsed.data.email };
    }
    throw e; // NEXT_REDIRECT phải được ném lại
  }
  return {};
}

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: String(formData.get("email") ?? "") };

  // Chống tạo tài khoản hàng loạt: tối đa 10 lần đăng ký mỗi giờ từ một địa chỉ IP.
  const ip = clientIpFrom(await headers());
  if ((await hit(`register:ip:${ip}`, 3_600_000)) > 10) {
    return { error: "Bạn đã thử đăng ký quá nhiều lần. Vui lòng thử lại sau." };
  }

  const { name, email, phone, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { fieldErrors: { email: "Email này đã được đăng ký" }, email };

  // Đăng ký ở trang đối tác tạo tài khoản HOST (chỉ quản lý khách sạn của mình, khách sạn phải được sàn duyệt mới hiển thị).
  const role = formData.get("partner") === "1" ? "HOST" : "USER";
  await prisma.user.create({
    data: { name, email, phone: phone || null, passwordHash: await bcrypt.hash(password, 10), role },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: safeRedirect(String(formData.get("callbackUrl") ?? "")) });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Đăng ký xong nhưng đăng nhập tự động thất bại, vui lòng đăng nhập lại." };
    throw e;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

/** Luôn trả lời giống nhau dù email có tồn tại hay không, để không lộ email nào đã đăng ký. */
export async function requestPasswordResetAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ")).safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: "Email không hợp lệ" }, email: String(formData.get("email") ?? "") };
  const email = parsed.data;

  const ip = clientIpFrom(await headers());
  const [byIp, byEmail] = await Promise.all([hit(`reset:ip:${ip}`, 3_600_000), hit(`reset:email:${email}`, 3_600_000)]);
  if (byIp > 10 || byEmail > 3) return { error: "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau một giờ.", email };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (user) {
    const token = await createResetToken(user.id);
    const appUrl = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
    await sendPasswordResetEmail(email, user.name, `${appUrl}/reset-password?token=${token}`);
  }
  return { done: true, email };
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = passwordRule.safeParse(formData.get("password"));
  if (!password.success) return { fieldErrors: { password: password.error.issues[0].message } };
  if (formData.get("confirm") !== password.data) return { fieldErrors: { confirm: "Mật khẩu nhập lại không khớp" } };

  const ip = clientIpFrom(await headers());
  if ((await hit(`reset-submit:ip:${ip}`, 3_600_000)) > 20) return { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau." };

  if (!(await consumeResetToken(token, password.data))) {
    return { error: "Liên kết không hợp lệ hoặc đã hết hạn." };
  }
  return { done: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự").max(80, "Họ tên tối đa 80 ký tự"),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)\d{9}$/, "Số điện thoại không hợp lệ")
    .optional()
    .or(z.literal("")),
});

/** Sửa họ tên và số điện thoại. Email không đổi được vì là tên đăng nhập. */
export async function updateProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const parsed = profileSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { name: String(formData.get("name") ?? ""), phone: String(formData.get("phone") ?? "") } };

  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/account");
  return { done: true };
}

/** Đổi mật khẩu khi đang đăng nhập: bắt buộc nhập đúng mật khẩu hiện tại, có giới hạn số lần thử. */
export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const current = String(formData.get("current") ?? "");
  const next = passwordRule.safeParse(formData.get("password"));
  if (!next.success) return { fieldErrors: { password: next.error.issues[0].message } };
  if (formData.get("confirm") !== next.data) return { fieldErrors: { confirm: "Mật khẩu nhập lại không khớp" } };

  // Chống dò mật khẩu hiện tại bằng phiên đã đăng nhập: tối đa 10 lần mỗi 15 phút.
  if ((await hit(`pwchange:${user.id}`, 15 * 60_000)) > 10) return { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) return { fieldErrors: { current: "Mật khẩu hiện tại không đúng" } };
  if (current === next.data) return { fieldErrors: { password: "Mật khẩu mới phải khác mật khẩu hiện tại" } };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next.data, 10) } });
  // Đổi mật khẩu cũng vô hiệu các liên kết đặt lại mật khẩu đang chờ.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  return { done: true };
}
