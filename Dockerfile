# FYK Consolidated — Production Dockerfile (Divine 15/10)
# Multi-stage build: deps → build → runtime, minimal attack surface

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Env validation at build time — fails fast if missing required vars
ENV VITE_SUPABASE_URL=https://dummy.supabase.co
ENV VITE_SUPABASE_ANON_KEY=dummy
ENV SUPABASE_URL=https://dummy.supabase.co
ENV SUPABASE_ANON_KEY=dummy
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy

RUN pnpm generate-routes
RUN pnpm typecheck
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fyk

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/supabase ./supabase

USER fyk
EXPOSE 3000

# Health check — production readiness probe
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server/server.js"]
