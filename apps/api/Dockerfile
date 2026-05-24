# syntax=docker/dockerfile:1.7

# ─── Stage 1: prune monorepo to only api's required workspace deps ───
FROM node:20-alpine AS pruner
WORKDIR /repo
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo@2

# Copy the whole repo (small enough for a monorepo of this size); turbo
# will produce a minimal subset for the @gsm/api workspace.
COPY . .
RUN turbo prune @gsm/api --docker

# ─── Stage 2: install + build (with workspace deps) ───────────────────
FROM node:20-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat python3 make g++

# Install only the deps needed to build @gsm/api (and its workspace deps).
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/package-lock.json ./package-lock.json
RUN npm ci

# Bring the rest of the source pruned to api's workspaces.
COPY --from=pruner /repo/out/full/ .

# turbo prune --docker doesn't copy root-level files like tsconfig.base.json
# into out/full/, but every workspace tsconfig extends it (e.g.
# packages/scheduler/tsconfig.json → ../../tsconfig.base.json). Without
# this file tsc errors with TS5083 and falls back to a default config
# without skipLibCheck=true, which cascades into ~30 type errors in
# transitive node_modules .d.ts files. Copy it explicitly from the
# pruner stage where the full repo was checked out.
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json

# Build the workspace deps (@gsm/shared-types, @gsm/scheduler, @gsm/bracket-engine)
# and then the api itself.
RUN npx turbo run build --filter=@gsm/api

# Drop dev-only deps so we ship a small runtime image.
RUN npm prune --omit=dev

# ─── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init
# Run as non-root for defence-in-depth.
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

# Copy the pruned dependency tree + built api dist.
COPY --from=builder --chown=nestjs:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/packages ./packages

USER nestjs

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# `dumb-init` reaps zombie processes and forwards SIGTERM to Node so
# the container shuts down cleanly when the orchestrator stops it.
ENTRYPOINT ["dumb-init", "--"]
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
