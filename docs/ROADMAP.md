# Roadmap

> Last updated: 20 May 2026 · Move the "Current phase" pointer when finishing a phase.
>
> Companion to [STATUS.md](./STATUS.md). STATUS = what is done now. ROADMAP = what we're doing next.

## Current phase: **Phase 1 — Production launch (10-day plan in progress)**

## Phases

### Phase 0 — Foundations 🟢 Done
Repository, monorepo layout, base stack decisions, CI/CD, security scans.
- Turborepo + npm workspaces
- TypeORM + Postgres + Redis (compose for dev)
- NestJS API skeleton with auth, RBAC
- Next.js 15 web app with i18n (ru/en/hy)
- GitHub Actions: lint, typecheck, build, test, CodeQL, secret scan, dependabot
- ESLint + Prettier shared config

### Phase 1 — Production launch 🟡 In progress (target: ~10 days)
Goal: a single armwrestling tournament can run end-to-end on production infrastructure.

Code-side (mostly done):
- 🟢 Bracket engine: 5 formats + armfight, 98% statement coverage, 90% branch coverage
- 🟢 Operator panel with match-result entry
- 🟢 Live updates via Socket.io
- 🟢 Telegram notifications + match reminders
- 🟢 Health probes (`/health`, `/ready`)
- 🟢 Helmet + tight CORS + auth rate-limit
- 🟢 Sentry + pino observability
- 🟢 Production Dockerfiles (api + web)
- 🟢 404 / 500 error pages
- 🟢 Cookie consent + ToS / Privacy placeholder routes
- 🟢 Footer + SEO basics (robots, sitemap, OG metadata)

Pending (your action mostly):
- 🔴 Hosting account (Railway + Vercel) and DNS — accounts not yet created
- 🔴 Domain name + SSL — domain owned, DNS not yet pointed at Railway/Vercel
- 🔴 Sentry account + DSN — code wired in PR #99; account/DSN still pending
- 🔴 Email provider account (Resend) + DKIM/SPF — code wired; account/DNS still pending
- 🟡 Real legal text (Termly hand-off pending) replacing the placeholders
- 🟢 Database backup cron — daily `pg_dump → R2` via GHA workflow (code-side); R2 bucket + secrets pending your action
- 🟡 Production deploy workflow — Railway + Vercel native auto-deploy off `main` (design decided, runbook updated); actual Railway/Vercel projects + branch connection pending your action
- 🔴 Bug bash with 3-5 operators / athletes on staging
- 🔴 First production deploy

Pending (engineering, post-merge of PRs #88-#91):
- 🟢 Forgot-password via email (Resend) — landed this launch week
- 🟢 Email verification flow (soft gate banner) — landed this launch week
- 🔴 Account recovery via Telegram (deferred post-launch)

### Phase 2 — Sports media foundation 🔴 Planned (3-6 months post-launch)
Goal: become a credible niche sports media product, not just a tournament tool.
- CMS for editorial workflow (Sanity or Strapi) — drafts, scheduled publish, author profiles
- Live blog / minute-by-minute tournament updates
- Deep athlete profiles with statistics and head-to-head
- Web Push for tournament events + email digests
- Mobile-first UX polish; PWA install prompts
- Polish: full-text search (Postgres tsvector), recommendations
- SEO depth: OG images per tournament/athlete, structured data (Schema.org SportsEvent)
- Component tests with @testing-library/react (testing roadmap step 4)
- E2E tests with Playwright on critical flows (testing roadmap step 5)

### Phase 3 — Live & video 🔴 Planned (6-12 months post-launch)
Goal: own the visual side of combat-sport coverage in Armenia.
- VOD via Mux or Cloudflare Stream (HLS, DRM optional)
- Live trainer / RTMP ingestion → HLS distribution
- Real-time scoring of all parallel matches (not just one bracket)
- Personalisation: subscribe to athletes, custom feed, push on their matches
- Multi-sport navigation surfaced on the homepage (today armwrestling-first)

### Phase 4 — Scale & monetization 🔴 Planned (12+ months)
Goal: sustainable revenue, expansion beyond armwrestling.
- iOS + Android apps (React Native or Flutter)
- Advertising (Google Ad Manager) OR subscription paywall (Stripe)
- Sponsorship / federation branding
- Combat-sport expansion: MMA, boxing, kickboxing, wrestling
- Partnership integrations with international federations
- Status page, SLOs, on-call rotation

### Phase 5 — Beyond 🔴 Planned (years out)
Wishlist; do not plan against this list yet.
- TV apps (Apple TV / Android TV / Roku)
- Premium content / paywall
- Live community: comments, fan polls
- Geographic expansion (regional sub-sites)

## Cross-cutting tracks

These run in parallel across phases.

### Documentation
- 🟢 ADR record format established (`docs/adr/`)
- 🟢 Runbook format established (`docs/runbooks/`)
- 🟢 STATUS.md as living implementation tracker
- 🟡 PR template enforces "docs updated" checkbox (this PR)

### Testing
1. 🟢 CI/CD setup (Phase 0)
2. 🟢 Bracket engine 90%+ coverage (PR #86 + #88)
3. 🟢 Web unit tests on critical utilities (PR #87)
4. 🔴 Component tests on auth + tournament-creation forms
5. 🔴 E2E with Playwright on 3-5 scenarios

### Security
- 🟢 Helmet, CORS, rate-limit, secure cookies, RBAC, bcrypt (Phase 1)
- 🔴 Secrets manager (Vault / Doppler) — currently rely on hosting-provider env vars
- 🔴 Penetration test before scaling beyond ~1000 users
- 🔴 GDPR data export / delete endpoints for EU traffic at scale

## Phase exit criteria

A phase ends when:
1. Every 🟢 row in its scope is actually green (verified, not just claimed).
2. The next phase's 🟡 / 🔴 work is picked up in a tracked branch.
3. STATUS.md and ROADMAP.md are updated in the same PR as the phase-closing change.
4. (Launch-specific) Restore drill from a real backup completed and documented in `docs/runbooks/restore-from-backup.md`.
