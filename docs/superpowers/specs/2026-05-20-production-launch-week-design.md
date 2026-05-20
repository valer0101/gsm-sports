# Production Launch — One-Week Plan

> Date: 2026-05-20
> Phase: Phase 1 — Production launch (per `docs/ROADMAP.md`)
> Companion to: `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/08-DEPLOYMENT.md`, `docs/runbooks/deploy-production.md`

## 1. Goal

Take the GSM Sports platform to a **full public launch** within ~7 days: live on the existing domain, open self-registration with working email-based password reset and email verification, real legal text, daily off-platform backups, external uptime monitoring, and Sentry receiving errors.

Public-launch gate is reached at end of day 6, after a phased rollout that front-loads the riskiest unknowns (hosting, DNS, email deliverability).

## 2. Why this is achievable in a week

The code is largely production-ready:

- 446 API tests; bracket engine at 98.6% statement coverage.
- All MVP pages built (auth, admin, operator, tournaments, athletes, news, rankings, legal placeholders, 404/500, sitemap/robots).
- Auth: JWT (access+refresh in httpOnly cookies), RBAC, Google OAuth, login by email-or-phone, bcrypt cost 12.
- Production hardening already shipped: Helmet, tight CORS, rate-limiter on `/auth/*`, multi-stage Dockerfiles with non-root user, `/health` + `/ready` probes.
- Sentry + pino wired in code (no-op until DSN env var is set).
- CI green: lint, typecheck, build, test, CodeQL, secret scan, Dependabot.

**The gap is operational, not architectural.** What is missing is the deploy pipeline wiring, the email flows that depend on a provider that did not exist yet, daily off-platform backups, external uptime monitoring, and the manual infra/legal/account work.

## 3. Locked-in decisions

| Decision | Choice | Rationale |
|---|---|---|
| Launch scope | Full public launch | Per user. Open registration + reset + verify + legal + backups + monitoring at go-live. |
| Hosting (web) | Vercel | Push-to-deploy, edge CDN, free tier viable at launch scale. |
| Hosting (api + DB + cache) | Railway | Managed Postgres + Redis, push-to-deploy from `main`, ~$5–20/mo at launch. |
| DNS | Cloudflare | Free, automatic SSL via Vercel/Railway. |
| Email provider | Resend | Recommended in docs; 3 000 emails/mo free; clean API; fast domain setup. |
| Legal text | User-generated (Termly / iubenda), I insert ru/en/hy | Reasonable risk balance; lawyer-grade text is a post-launch tightening. |
| Email verification at launch | **Soft gate** — banner only, no hard block on core flows | Hard block can wait until post-launch; do not block the first tournament. |
| Domain | Already owned (hostname provided by user at deploy time) | Removes DNS-propagation/registration timeline risk. |
| Deploy trigger | Native Railway + Vercel auto-deploy from `main` (no GHA orchestration) | `main` is already gated by `ci-success` via branch protection; less code, fewer failure modes than a custom GHA deploy job. |
| Migrations on deploy | Railway pre-deploy / release command runs `npm run migration:run --workspace=@gsm/api` once per release | Single execution before traffic swap. Avoids the multi-instance race that a `migrate && start` CMD would create on scale-out. |
| Backups | Defense-in-depth: Railway managed Postgres backups (primary) + GHA-scheduled daily `pg_dump → Cloudflare R2` (off-platform copy) | Cheap, zero extra infra, restorable. |

## 4. Code workstreams (what I build)

Each gets `*.spec.ts` coverage per project conventions, DTOs with `class-validator`, errors as `HttpException` with appropriate status, NestJS `Logger` (no `console.log`).

### 4.1 Mail module (Resend)

- `apps/api/src/mail/` — `MailModule`, `MailService` wrapping the `resend` SDK.
- Reads `RESEND_API_KEY`, `MAIL_FROM`. With no key set: log a warning and short-circuit to a no-op (same pattern as Sentry today). Allows local/CI runs without secrets.
- Templated HTML per email type (password reset, email verification). Trilingual (ru/en/hy) selected by the user's locale.
- Inject into Auth services that need it.

### 4.2 Password reset flow

**Backend:**
- New entity / table `password_reset_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`). TypeORM-generated migration.
- Token: random 32-byte hex (high entropy), **hashed with SHA-256** (no per-token salt needed; the token itself is the secret) before storage; plaintext only in the email link. bcrypt is deliberately avoided — it adds latency without security benefit for already-high-entropy single-use tokens.
- `POST /v1/auth/forgot-password` — accepts email; **always returns 200** regardless of whether the user exists (no user enumeration). Generates token, emails reset link.
- `POST /v1/auth/reset-password` — accepts token + new password. Validates token (unused, unexpired), sets password (bcrypt cost 12), marks token used, invalidates active refresh tokens for that user.
- Existing `@nestjs/throttler` covers `/auth/*` rate-limiting.

**Frontend:**
- `app/[locale]/auth/forgot-password/page.tsx` — request form (React Hook Form + Zod, next-intl strings).
- `app/[locale]/auth/reset-password/page.tsx` — accepts `?token=`, new-password form.
- Add "Forgot password?" link on existing login page.

### 4.3 Email verification flow (soft gate)

**Backend:**
- New table `email_verification_tokens` — same shape as reset tokens.
- On register: create token, send verification email.
- `GET /v1/auth/verify-email?token=` — validates and sets `users.is_verified = true`.
- `POST /v1/auth/resend-verification` — for the banner "resend" action; throttled.
- **No** flow gating on `is_verified` at launch. Hard-gating is deferred.

**Frontend:**
- `app/[locale]/auth/verify-email/page.tsx` — handles the verify token, shows success/error states.
- `<EmailVerificationBanner>` component shown on any logged-in route when `user.isVerified === false`, with a "resend" action.

### 4.4 Deploy pipeline (Railway + Vercel)

- **Web (Vercel):** repo connected, project root `apps/web`, framework auto-detected (Next.js 15). Production branch = `main`. Auto-deploy on push.
- **API (Railway):** service from repo using `apps/api/Dockerfile`. Production branch = `main`. Auto-deploy on push.
- Provide a `vercel.json` only if needed (most config is dashboard-side).
- **No** custom GitHub Actions deploy job. `main` is already protected by the `ci-success` aggregate check; that is our deploy gate.
- Finalize `docs/runbooks/deploy-production.md` (replace "_Not yet — first deploy pending._" with first-deploy notes once it lands).

### 4.5 Migrations on deploy

- Add npm script `migration:show` to `apps/api/package.json` (noted as missing in the runbook).
- Add npm script `start:prod:migrate` running `migration:run` then `node dist/main` — usable as a fallback, but **not** the recommended path.
- Recommended path: configure Railway's **release / pre-deploy command** to run `npm run migration:run --workspace=@gsm/api` once per release, before traffic swap. Documented in the runbook.
- Dockerfile `CMD` stays `node dist/main` (single-purpose; migrations are a deploy concern, not a process concern).

### 4.6 Database backups (off-platform)

- `scripts/backup-db.sh` — `pg_dump $DATABASE_URL` → `gzip` → `aws s3 cp` (or `rclone`) to Cloudflare R2, with timestamped object key.
- `.github/workflows/backup.yml` — scheduled (daily, UTC 03:00), uses repository secrets `DATABASE_URL`, `R2_*`. Runs the script, fails the workflow if upload or dump fails.
- `docs/runbooks/restore-from-backup.md` — currently TBD; ship it with this work.
- Retention policy noted in runbook: 30 daily / 12 weekly, manually pruned for now.

### 4.7 Uptime monitoring

- Mostly your task (account, monitor config). My side: confirm `/health` stays public and cheap; document the monitor configuration and alert routing (Telegram bot is already live and can receive alerts) in the deploy runbook.

### 4.8 Sentry activation

- Code already wired (PR #99). My side: verify env-var reads at app start, confirm `SENTRY_ENVIRONMENT=production` is honored, document required env vars. Source-map upload in CI is **deferred** — nice-to-have, not on critical path.

### 4.9 Cross-cutting hygiene

- Refresh `docs/STATUS.md` — currently dated 8 May 2026; Google OAuth (PR #97) is done but still marked 🔴.
- Refresh `docs/ROADMAP.md` Phase 1 — the items I land this week move from 🔴 to 🟢; remove the stale "script template ready" claim about backups (no such template exists today).
- Update `docs/01-VISION.md` only if scope shifts (not expected).

## 5. Manual / infra work (user-owned)

I cannot do these. Listed in approximate order they unblock the code work.

| ID | Task | Unblocks |
|---|---|---|
| M1 | Railway: project, Postgres add-on, Redis add-on, api service, env vars (see runbook), set pre-deploy command to `npm run migration:run --workspace=@gsm/api` | api deploy |
| M2 | Vercel: project, root `apps/web`, env vars, link `main` as production branch | web deploy |
| M3 | Cloudflare DNS: apex → Vercel, `api.` subdomain → Railway custom domain, confirm SSL | full prod |
| M4 | Sentry: account, two projects (api + web), copy DSNs into Railway and Vercel env | observability live |
| M5 | Resend: account, verify sending domain, add DKIM/SPF/DMARC DNS records at Cloudflare, API key into Railway env, sender address into `MAIL_FROM` | password reset + email verify |
| M6 | Termly / iubenda: generate ToS + Privacy, hand off final text in ru / en / hy | legal go-live |
| M7 | Better Stack or UptimeRobot: monitors on `/health` and the web root, alert channel pointed at Telegram | uptime alerts |
| M8 | Telegram: `setWebhook` against the prod URL (curl already in the deploy runbook) | bot in prod |
| M9 | First admin: set `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the seed step, log in, change password, then rotate the env value | admin access |

## 6. Day-by-day sequencing (Approach C — phased with gates)

### Day 1–2 — Infra-first (front-load risk)
- Me: finalize deploy configs (4.4), migration-on-deploy wiring (4.5), runbook updates.
- You: M1, M2, M3. Deploy current code (registration and Google OAuth already work).
- **Gate:** `/health` and `/ready` return 200 on the real domain; web loads; admin can log in.

### Day 2–3 — Internal bug bash
- 3–5 trusted operators / athletes: register → create tournament → register athletes → run matches → view bracket. Bugs go to a triage list; I fix by priority.

### Day 3–5 — Email, backups, monitoring, legal
- Me: mail module (4.1), password reset (4.2), email verification (4.3), backup script + GHA schedule + restore runbook (4.6).
- You: M4, M5, M7. Hand off M6 (legal text); I insert into ru/en/hy.
- **Gates:** test password-reset email lands and not in spam; nightly backup ran and was test-restored; Sentry caught a test error from both api and web.

### Day 6 — Go-live gate → public
- Run the full go-live checklist (Section 7). All green → open public registration and announce.

### Day 7 — Buffer / watch
- Reserve for surprises. On-call rotation for Sentry alerts and uptime monitor for the first 24 hours of public.

## 7. Go-live checklist (Day 6 — all must be green)

**Infra / deploy**
- [ ] CI green on `main`; Railway + Vercel auto-deploy fired from `main`.
- [ ] `/health` and `/ready` = 200 on prod; migrations applied via the pre-deploy command.
- [ ] CORS: `FRONTEND_URL` set to the real production hostname(s); no "Network error" from the browser.
- [ ] Valid SSL on web and on the `api.` subdomain.

**User flows (smoke on live prod)**
- [ ] Register → verification email arrives → soft banner visible until verified.
- [ ] Login with email, login with phone, Google OAuth.
- [ ] Password reset: email lands (not in spam), new password works, old refresh sessions invalidated.
- [ ] Create a tournament → add athletes → run matches → bracket renders; Socket.io live updates received.
- [ ] `/legal/terms` and `/legal/privacy` show the real Termly/iubenda text in ru / en / hy (no placeholder, no 404).

**Ops / security**
- [ ] Sentry captured a test error from both api and web.
- [ ] Nightly backup ran successfully **and** a restore drill succeeded per `restore-from-backup.md`.
- [ ] Uptime monitor active; a forced test alert reached Telegram.
- [ ] Telegram `setWebhook` pointed at the prod URL.
- [ ] First admin created, default password rotated, `ADMIN_PASSWORD` removed from env or rotated.
- [ ] `@nestjs/throttler` confirmed active on `/auth/*`; no secrets in git; all secrets only in hosting platform env.

## 8. Explicitly out of scope this week (risk accepted / deferred)

These are deliberate non-goals for this window. They are not forgotten — they live on the roadmap.

- Account recovery via Telegram (bot already live; flow comes after launch).
- **Hard** email-verification gating (soft banner is the launch decision).
- Facebook OAuth, 2FA/MFA.
- GDPR data export / delete endpoints (relevant for EU traffic at scale, not at launch).
- HTTP controller for `match-assignments`, service/entity layer for `upload`, full Socket.io event surface (🟡 in STATUS; current flows are not blocked).
- Component tests and E2E (testing-roadmap steps 4 and 5 — gated on UI stabilization).
- Sentry source-map upload in CI (nice-to-have).
- Status page, OpenTelemetry / metrics, secrets manager (Vault / Doppler) — post-launch hardening.
- Lawyer-grade legal text (post-launch tightening over the Termly/iubenda baseline).

## 9. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Email deliverability poor (spam folder) on day 3 | Medium | High — breaks password reset perception | Resend domain verification + DKIM/SPF/DMARC done on day 3, **not** day 6; test with multiple inboxes (Gmail, iCloud, Yandex) before go-live. |
| CORS misconfig on first deploy ("Network error" everywhere) | Medium | Medium | `FRONTEND_URL` env documented and double-checked at day-1 gate. Already flagged as the #1 first-deploy pain point in the runbook. |
| Migration ran but app failed → partial state | Low | High | Railway pre-deploy command runs migrations before traffic swap. On failure: revert via runbook's rollback section + revert last migration if needed. |
| Backup writes but cannot restore | Medium | Critical (silent loss) | Day-3–5 gate requires a successful restore drill **before** go-live, not just a successful upload. |
| Legal text not delivered by day 5 | Medium | Medium | Day-6 gate fails legal row. Two fallbacks: extend internal-only soft-launch by 1–2 days, or fall back to current placeholders with a "draft" banner — explicitly an accepted-risk option. |
| Hard CI gate breaks due to dependency bump mid-week | Low | Medium | Branch protection requires `ci-success`; failing PRs hold the queue. Dependabot PRs go to a branch, not `main`. |

## 10. What "done" looks like

The phase exit criteria (per `docs/ROADMAP.md`) say:
1. Every 🟢 row in scope is actually green (verified, not just claimed).
2. The next phase's 🟡 / 🔴 work is picked up in a tracked branch.
3. `STATUS.md` and `ROADMAP.md` are updated in the same PR as the phase-closing change.

Done for this spec = all rows of Section 7 are checked, Sections 4.1–4.9 are merged, Section 8 items are explicitly listed as deferred in updated `STATUS.md`/`ROADMAP.md`, and the first real production deploy is tagged.
