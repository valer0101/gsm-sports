# 0003 — Turborepo + npm workspaces

**Status:** Accepted
**Date:** 2025-09 (retroactive)

## Context

The product has three distinct surfaces that share types and bracket logic:
- `apps/api` — NestJS backend
- `apps/web` — Next.js 15 frontend
- packages used by both: `@gsm/shared-types`, `@gsm/bracket-engine`, `@gsm/scheduler`, `@gsm/countries`

Polyrepo would force the bracket engine to be published to npm and version-bumped on every change, slowing iteration and inviting "frontend uses bracket-engine 1.4 but backend is on 1.6" drift bugs.

A monorepo is the right call. The choice is which tooling.

Options considered:
- **pnpm** + Turborepo — fastest installs, content-addressable store, single lockfile.
- **Yarn 4 (Berry)** + Turborepo — workspaces work, but PnP + zero-installs added too much config burden.
- **npm 10 workspaces** + Turborepo — simplest, no extra binary in CI, smaller learning curve.
- **Nx** instead of Turborepo — heavier, more opinionated, comes with project generators we don't want.

## Decision

Use **npm workspaces** for package linking + **Turborepo** for task orchestration and caching.

## Consequences

Positive:
- Zero extra package manager binary in CI (npm ships with Node).
- One `package-lock.json` covers the whole repo — no version drift between workspaces.
- Turborepo's `turbo.json` defines task graph and caching: `lint`, `typecheck`, `build`, `test` cache per-package and skip unchanged work.
- Dependabot understands npm workspaces natively.
- Easy onboarding: `npm install` at the root, run `npx turbo <task>`.

Negative:
- npm's workspace dep resolution is slower than pnpm at scale.
- No content-addressable store → bigger `node_modules` tree on disk.
- Turborepo cache hits depend on accurate `inputs` / `outputs` declarations in `turbo.json`; misconfigured caches occasionally serve stale builds.

Hard rules:
- Workspace deps are referenced as `"@gsm/shared-types": "*"` in `package.json` so they always resolve to the local copy.
- A package that ships TypeScript source consumed by other workspaces (`@gsm/shared-types`) must build before its consumers — declared via Turbo's `"dependsOn": ["^build"]`.
- Don't add cross-workspace `import`s that bypass `package.json` — they break in production where the file paths don't exist.

## References

- Root `package.json` — `workspaces` array.
- `turbo.json` — task graph.
- `CLAUDE.md` → "Monorepo Structure".
