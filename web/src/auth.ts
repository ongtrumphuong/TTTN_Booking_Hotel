import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkLoginAllowed, clearLoginFailures, clientIpFrom, recordLoginFailure } from "@/lib/login-throttle";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

/** Báo cho giao diện biết đây là bị giới hạn số lần thử chứ không phải sai mật khẩu. */
export class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// Hash giả để thời gian phản hồi không lộ việc email có tồn tại hay không.
const DUMMY_HASH = bcrypt.hashSync("khong-gian-so-dummy", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  logger: {
    // Sai mật khẩu hay bị giới hạn là việc bình thường, không phải lỗi hệ thống: không ghi log lỗi để log luôn sạch và dễ theo dõi.
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error("[auth]", error);
    },
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const ip = clientIpFrom(request?.headers);

        // Đã bị chặn thì từ chối ngay, không so mật khẩu (cũng không cho dò thêm).
        if (!(await checkLoginAllowed(email, ip)).allowed) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) {
          await recordLoginFailure(email, ip);
          return null;
        }

        await clearLoginFailures(email, ip);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "USER" | "ADMIN";
      return session;
    },
  },
});
