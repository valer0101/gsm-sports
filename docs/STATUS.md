# Implementation Status

> Last updated: 8 May 2026 · Bump this header when adding rows.
>
> Source of truth for "what is built right now." Keep it accurate — claiming a feature is done when it isn't is worse than admitting it's missing.

## Legend

- 🟢 **Done** — full implementation, has tests, used in production code paths
- 🟡 **Partial** — some pieces exist; one of (no UI / no tests / no end-to-end flow / known gaps)
- 🔴 **Planned** — defined in docs, no code yet
- ⚫ **Out of scope** — explicitly not on the roadmap (yet)

## Backend modules (`apps/api/src/`)

| Module | Status | Tests | Notes |
|--------|--------|-------|-------|
| auth | 🟢 | spec | JWT (15m access) + refresh (7d), email-or-phone login, bcrypt cost 12, RBAC via simple-array |
| users | 🟢 | 14 | Email + phone unique indexes, lastLoginAt, seedAdmin from ENV |
| athletes | 🟢 | 18 | Profiles, rankings table, photo upload |
| sports | 🟢 | 15 | Multi-sport via JSONB SportConfig + presets (armwrestling, boxing, mma, jiu_jitsu, chess) |
| tournaments | 🟢 | 12 | CRUD, weight categories, operator assignments, tables |
| brackets | 🟢 | 77 | 5 formats supported by engine + audit log; armfight added in #88 |
| entries | 🟢 | 19 | Registration, check-in audit |
| weigh-ins | 🟢 | — | Required by armwrestling preset; per-tournament override |
| match-assignments | 🟡 | 1 | Service exists; no HTTP controller yet |
| rankings | 🟢 | 16 | Athlete ranking entries |
| schedule | 🟢 | 7 | Match scheduler from `@gsm/scheduler` |
| news | 🟢 | 20 | CRUD with body content |
| team-standings | 🟢 | 7 | Snapshot-based team rankings |
| telegram | 🟢 | 51 | 4 services: notifications, links, updates, reminders, webhook controller |
| operator | 🟢 | 18 | Operator dashboard endpoints |
| admin | 🟢 | 27 | Admin panel endpoints |
| upload | 🟡 | 4 | Controller exists, no service / entity layer |
| events (Socket.io) | 🟡 | 4 | Gateway scaffolded for `/brackets`, JWT handshake; full event surface still WIP |
| health | 🟢 | 3 | `/health` liveness + `/ready` readiness with DB ping (PR #89) |

## Frontend pages (`apps/web/src/app/`)

| Route | Status | Notes |
|-------|--------|-------|
| `/auth/*` | 🟢 | Login, register pages with JWT cookie flow |
| `/admin/*` | 🟢 | Users, tournaments, athletes, news CRUD; React Query everywhere |
| `/operator/*` | 🟢 | Operator tournament management, match-result form (armwrestling schema wired) |
| `/tournaments/[slug]` | 🟢 | Detail + bracket viewer + Socket.io live updates |
| `/tournaments/[slug]/arena` | 🟢 | Projector-friendly arena display |
| `/tournaments/[slug]/broadcast/*` | 🟢 | OBS browser-source overlays |
| `/news/*` | 🟢 | List + detail |
| `/athletes/*` | 🟢 | Directory |
| `/rankings` | 🟢 | Per-category rankings |
| `/sport/[slug]` | 🟡 | Armwrestling-only landing in practice; multi-sport navigation deferred |
| `/profile` | 🟢 | User profile CRUD |
| `/business` | 🟡 | B2B portal stub route |
| `/legal/terms` + `/legal/privacy` | 🟡 | Placeholder routes (PR #91); legal text pending |
| `/not-found` (404) | 🟢 | Trilingual minimal page (PR #91) |
| `/error` (500) | 🟢 | Route + global boundary (PR #91) |
| `/sitemap.xml` + `/robots.txt` | 🟢 | Static; dynamic listings deferred (PR #91) |

## Workspace packages (`packages/`)

| Package | Status | Coverage | Notes |
|---------|--------|----------|-------|
| `@gsm/bracket-engine` | 🟢 | 185 tests · 98.6% stmt · 90.4% branch · 100% func | 5 formats + armfight (PR #88) |
| `@gsm/scheduler` | 🟢 | 1 spec | ETA, table assignment, min-rest |
| `@gsm/shared-types` | 🟢 | — | Types-only; no test harness |
| `@gsm/countries` | 🟢 | 1 spec | ISO-3166 + localised names + flag emoji |
| `@gsm/config` | 🟢 | — | Shared ESLint + TS config |

## Auth & security

| Feature | Status | Notes |
|---------|--------|-------|
| JWT (access + refresh) | 🟢 | 15-min access, 7-day refresh, httpOnly + Secure cookie |
| Roles / RBAC | 🟢 | `user` / `athlete` / `organizer` / `admin` / `super_admin`; @Roles decorator |
| Password hashing | 🟢 | bcrypt cost 12 |
| Login by email OR phone | 🟢 | Regex detection in service |
| OAuth (Google/Facebook) | 🔴 | Entity sketched in DB schema; no implementation |
| 2FA / MFA | 🔴 | Not implemented |
| Password reset (email) | 🔴 | Endpoint not built; PR queued |
| Account recovery via Telegram | 🔴 | Bot is live; recovery flow queued |
| Email verification | 🟡 | `isVerified` column exists; no verify-email link sent |
| Rate-limiting on /auth/* | 🟢 | 10 req / 15 min / IP via `@nestjs/throttler` (PR #89) |
| Helmet + CSP + tight CORS | 🟢 | Production CORS refuses unset FRONTEND_URL (PR #89) |
| Secret management | 🟡 | `.env` for local; production secrets via hosting platform UI — no Vault/Doppler |

## Observability & ops

| Feature | Status | Notes |
|---------|--------|-------|
| Sentry (api + web) | 🟢 (code) / 🟡 (live) | PR #90; activates when DSN env-var is set |
| Structured logging (pino) | 🟢 | nestjs-pino, JSON in prod, pretty in dev (PR #90) |
| Health endpoints | 🟢 | `/health` + `/ready` (PR #89) |
| Uptime monitoring | 🔴 | Better Stack / UptimeRobot — not yet wired |
| OpenTelemetry / metrics | 🔴 | Not yet |
| Production Dockerfile (api + web) | 🟢 | Multi-stage, non-root user, dumb-init (PR #89) |
| GitHub Actions CI/CD | 🟢 | Lint, typecheck, build, test, security scans, dependabot |
| Production deploy workflow | 🔴 | Hosting + DNS + GHA workflow not yet wired |
| Database backups | 🔴 | No cron, no S3 sink |
| Disaster recovery drill | 🔴 | — |

## Notifications & comms

| Channel | Status | Notes |
|---------|--------|-------|
| Telegram | 🟢 | Full bot integration: notifications, link account, match reminders, webhook receiver |
| Email | 🔴 | No provider yet (Resend / SendGrid planned) |
| Web Push | 🔴 | — |
| SMS | 🔴 | — |

## Quality

| Area | Status | Notes |
|------|--------|-------|
| Unit tests (api) | 🟢 | 446 tests as of PR #90 |
| Unit tests (web) | 🟡 | 104 tests; pure utilities only (i18n, wizard helpers, middleware) |
| Component tests (web) | 🔴 | Step 4 of testing roadmap; gated on UI stabilization |
| E2E tests | 🔴 | Step 5 of testing roadmap; vitest.e2e.config exists but empty |
| Coverage threshold in CI | 🔴 | Tests run, no minimum-coverage gate |
| Accessibility audit | 🔴 | No axe / jest-axe |
| Performance budgets / Lighthouse CI | 🔴 | — |

## Compliance & legal

| Item | Status | Notes |
|------|--------|-------|
| Terms of Service | 🟡 | Placeholder route (PR #91); real text pending |
| Privacy Policy | 🟡 | Placeholder route aligned with GDPR Art. 6 (PR #91); real text pending |
| Cookie consent banner | 🟢 | Strictly-necessary-only banner (PR #91) |
| GDPR data export endpoint | 🔴 | Required for EU users at scale |
| Age verification (under 14 minors) | 🔴 | Mentioned in placeholder ToS; not enforced |

## Monetization

⚫ Out of scope until post-launch product decisions. Stripe / subscriptions / paywall not built.

## Mobile

⚫ Web is mobile-responsive; native apps (React Native / Flutter) not in scope for the 10-day launch.
