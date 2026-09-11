# ═══════════════════════════════════════════════════════════════════════════════
# FYK Consolidated — Multi-stage Docker Build
# ═══════════════════════════════════════════════════════════════════════════════

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Enable corepack and pin pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies first (cacheable layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN npx prisma generate
RUN pnpm build

# Stage 2: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy only what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./

# Non-root user
RUN addgroup -g 1001 -S fyk && adduser -S fyk -u 1001 -G fyk
USER fyk

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
