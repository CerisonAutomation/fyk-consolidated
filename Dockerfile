# FYK — TanStack Start (Vite) production image.
#
# This replaces an earlier Dockerfile that ran `prisma generate` and started
# `node dist/server.js`: Prisma is not in this project, and `dist/server.js` is
# not the build output. The app is built by Vite and served by the Node server
# that TanStack Start emits into `.output`.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm typecheck && pnpm test && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Only the built server bundle and what it needs at runtime.
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json

RUN addgroup -g 1001 -S fyk && adduser -S fyk -u 1001 -G fyk
USER fyk

EXPOSE 3000

# /api/health is a real endpoint: it reports Supabase reachability, whether the
# durable rate limiter is in play, and any schema gaps. It answers 503 while the
# app is not wired to a project, so a failing check here means the deployment is
# misconfigured rather than that the container is dead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
