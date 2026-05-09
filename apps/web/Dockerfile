# syntax=docker/dockerfile:1.7

# ─── Stage 1: prune monorepo to only web's required workspace deps ───
FROM node:20-alpine AS pruner
WORKDIR /repo
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo@2

COPY . .
RUN turbo prune @gsm/web --docker

# ─── Stage 2: install + build the Next.js app ────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat python3 make g++

COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/package-lock.json ./package-lock.json
RUN npm ci

COPY --from=pruner /repo/out/full/ .

# Build workspace deps + the Next app. Next produces a `standalone` output
# under `apps/web/.next/standalone` (see `next.config.js`) — that's what
# we copy into the runtime image.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx turbo run build --filter=@gsm/web

# ─── Stage 3: runtime — Next.js standalone server ─────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Next standalone output bundles the minimum subset of node_modules
# automatically — no `npm ci` here, no separate node_modules copy.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
