# syntax=docker/dockerfile:1
# Ảnh Docker cho Không Gian Số Stay (Next.js bản standalone + Prisma + sharp).
# Build không cần kết nối cơ sở dữ liệu. Các biến môi trường thật chỉ cấp lúc chạy container.

FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma cần OpenSSL; ca-certificates để gọi VNPay/SMTP qua TLS.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Cài thư viện (có cache theo package-lock) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ứng dụng ---
FROM deps AS builder
COPY . .
RUN npx prisma generate
ENV BUILD_STANDALONE=1
RUN npm run build

# --- Công cụ vận hành dùng một lần: áp dụng migration, tạo quản trị viên (có đủ prisma, tsx) ---
FROM builder AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Ảnh chạy thật: chỉ gồm bản standalone, nhỏ và chạy bằng người dùng không có quyền root ---
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --create-home nextjs \
    && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
# Thư mục ảnh quản trị viên tải lên: gắn volume vào đây để không mất khi cập nhật container.
VOLUME ["/app/uploads"]
EXPOSE 3000
CMD ["node", "server.js"]
