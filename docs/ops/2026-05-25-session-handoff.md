# Session Handoff — 25 May 2026

> Snapshot for resuming work in a new session. Previous session set up the entire production stack from scratch (launch-week plan + 12 post-launch fixes + Railway/DNS/Sentry/Resend/Google OAuth/domains). Most of the work is done; a few last-mile items remain.

> **Secret values are NOT in this file by design — GitHub secret scanning blocks them.** All secrets live in Railway service env vars and in the user's password manager / chat history. This doc only references their names.

## TL;DR — state of the system

| Layer | Status | URL |
|---|---|---|
| Web (Next.js) | 🟢 LIVE | https://www.gsmarm.com |
| API (NestJS) | 🟢 LIVE | https://api.gsmarm.com |
| apex redirect | 🟢 HTTP only | http://gsmarm.com → https://www.gsmarm.com (HTTPS apex needs Cloudflare) |
| Postgres | 🟢 Online (Railway managed) | private network |
| Redis | 🟢 Online (Railway managed) | private network |
| Resend (mail) | 🟢 Verified | sender: no-reply@mail.gsmarm.com |
| Sentry | 🟢 Wired | EU region, 2 projects (api + web) |
| Google OAuth | 🟢 Configured | callback at api.gsmarm.com |
| Telegram bot | 🟡 Token present, webhook NOT set | needs `setWebhook` once api stable |

All 3 Railway services in **EU West (Amsterdam)**. Total Railway cost: ~$5/mo, currently sitting on free trial credit.

## Critical open issue (blocks login from browser)

### `JWT_ACCESS_SECRET` not set on gsm-web service

The web's Next.js middleware (`apps/web/src/middleware.ts`) verifies the auth JWT to gate `/admin`. After commit `84a39ce` it reads `JWT_ACCESS_SECRET` (preferred) or `JWT_SECRET` (fallback). **Neither is set on the `gsm-web` Railway service.**

**Effect:** login succeeds (API sets cookie, client-side shows "Admin" in nav), but navigating to `/admin` redirects back to `/auth/login` in a loop because the middleware can't verify the JWT.

**Fix:** in Railway → `gsm-web` → Variables → `+ New Variable`, add:
```
Key:   JWT_ACCESS_SECRET
Value: <copy from gsm-sports service JWT_ACCESS_SECRET — must be byte-identical>
```

Apply → Deploy. After ~30 sec rebuild, browser login should work end-to-end. Test in incognito to avoid stale cookies.

## What lives where

### Railway project: `gsmarm-sport`
- **gsm-sports** (api) — custom domain `api.gsmarm.com`, port 4000
- **gsm-web** (web) — custom domain `www.gsmarm.com`, port 3001
- **Postgres** — managed, volume backed (`postgres-volume`)
- **Redis** — managed, volume backed (`redis-volume`)

### DNS at NameCheap (BasicDNS)
| Type | Host | Value (suffix) | Purpose |
|---|---|---|---|
| CNAME | `api` | `…up.railway.app` | api custom domain |
| CNAME | `www` | `…up.railway.app` | web custom domain |
| TXT | `_railway-verify.api` | `railway-verify=…` | Railway ownership |
| TXT | `_railway-verify.www` | `railway-verify=…` | Railway ownership |
| URL Redirect | `@` | `https://www.gsmarm.com/` (Unmasked) | apex → www |
| MX | `send.mail` | `feedback-smtp.eu-west-1.amazonses.com` (pri 10) | Resend feedback |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | Resend SPF |
| TXT | `resend._domainkey.mail` | `p=MIGfMA0G…` (DKIM key) | Resend DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC |

### Sentry org `gsm-sports` (EU region, gsm-sports.sentry.io)
- Project `gsm-api` — DSN stored in Railway env `SENTRY_DSN` on gsm-sports
- Project `gsm-web` — DSN stored in Railway env `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` on gsm-web

### Resend
- Domain: `mail.gsmarm.com` (verified, all 4 DNS records green)
- API key: stored in Railway env `RESEND_API_KEY` on gsm-sports
- Sender: `GSM Sports <no-reply@mail.gsmarm.com>` (env `MAIL_FROM`)

### Google Cloud OAuth (project `gsm-sports`)
- Client name: `gsm-sports-web-oauth` (Web application type)
- Client ID + Secret stored in Railway env `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on gsm-sports
- Authorized JS origins: `http://localhost:3001`, `https://gsmarm.com`, `https://www.gsmarm.com`
- Authorized redirect URIs: `http://localhost:4000/v1/auth/google/callback`, `https://api.gsmarm.com/v1/auth/google/callback`

### Env var inventory (names only — values in Railway dashboard)

**On gsm-sports (api):**
```
NODE_ENV, PORT
DATABASE_URL, REDIS_URL                  (Railway service references)
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET    (signing JWTs)
JWT_CHECKIN_SECRET, JWT_TELEGRAM_LINK_SECRET
JWT_ACCESS_EXPIRES=15m
OAUTH_STATE_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://api.gsmarm.com/v1/auth/google/callback
GOOGLE_SUCCESS_REDIRECT=https://gsmarm.com/auth/google/callback
SENTRY_DSN, SENTRY_ENVIRONMENT=production, SENTRY_TRACES_SAMPLE_RATE=0.1
LOG_LEVEL=info
RESEND_API_KEY
MAIL_FROM=GSM Sports <no-reply@mail.gsmarm.com>
FRONTEND_URL=https://gsmarm.com,https://www.gsmarm.com,https://gsm-web-production.up.railway.app
NEXT_PUBLIC_SITE_URL=https://gsmarm.com
ADMIN_EMAIL=valeryordanyan@gmail.com
ADMIN_PASSWORD                           (temporary — change after first login)
TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
COOKIE_DOMAIN=.gsmarm.com                (cross-subdomain auth cookie)
```

**On gsm-web (web):**
```
NODE_ENV=production, PORT=3001, HOSTNAME=0.0.0.0
NEXT_PUBLIC_SITE_URL=https://gsmarm.com
NEXT_PUBLIC_API_URL=https://api.gsmarm.com/v1
NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_DSN, SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_TELEGRAM_HANDLE=gsm_arm_sport
NEXT_PUBLIC_CONTACT_EMAIL=hello@gsmarm.com
JWT_ACCESS_SECRET                        ← MISSING, must add (blocker)
```

## What was done in this session

### Code shipped to `main`

Initial launch-week PR #106 (merged) — 24 tasks across:
- **A.** Mail module (Resend) + trilingual templates (ru/en/hy) + HTML escape
- **B.** Password reset backend (entity, service, 2 endpoints, DTOs)
- **C.** Email verification backend (entity, service, 2 endpoints, register integration)
- **D.** Web pages (forgot-password, reset-password, verify-email, banner) + 22 i18n keys × 3 locales
- **E.** npm scripts (`migration:show`, `start:prod:migrate`)
- **F.** Backups (`scripts/backup-db.sh` + GHA workflow + `restore-from-backup.md`)
- **G.** Updated deploy runbook + uptime runbook + `apps/web/vercel.json`
- **H.** `STATUS.md` + `ROADMAP.md` refresh (with honest 🟢/🔴 corrections)

Post-launch fixes — 12 commits to main, each catching a real prod bug:
1. `a2b411e` — entity column names with `@Column({ name: 'snake_case' })` aliases (would have crashed every reset/verify)
2. `c224df9` — mount `EmailVerificationBanner` in `ConditionalLayout`
3. `cafb1d7` — throttle verify-email + UNIQUE token_hash + security doc sync
4. `792a4eb` — TypeORM `migrationsRun: true` (npm migration:run doesn't exist in pruned prod image)
5. `dc691b1` — copy `tsconfig.base.json` in Dockerfile builder stage
6. `61696ac` — drop `apps/api/node_modules` COPY (npm hoists to root)
7. `fa7d0d0` — pass `NEXT_PUBLIC_*` as ARG in web Dockerfile (build-time vars)
8. `94c020e` — isolate seed operations + run `seedAdmin` first
9. `f257703` — `COOKIE_DOMAIN` env for cross-subdomain cookie
10. `84a39ce` — web middleware accepts `JWT_ACCESS_SECRET`

### Manual / ops done
- ✅ NameCheap domain verification (was on hold initially due to unverified WHOIS)
- ✅ Sentry account + 2 projects + DSNs collected
- ✅ Resend account + `mail.gsmarm.com` verified + DKIM/SPF/DMARC + API key
- ✅ Google Cloud OAuth client created (web application, all URIs configured)
- ✅ Railway project created, all services deployed
- ✅ Custom domains `api.gsmarm.com` + `www.gsmarm.com` + apex redirect
- ✅ All env vars populated on both services (~25 vars on api, ~12 on web)
- ✅ `seedAdmin` ran successfully → admin user exists in Postgres (role `admin`)

## What's left, by priority

### 1. Blocking — finish login flow (~5 min)
- [ ] Add `JWT_ACCESS_SECRET` env on **gsm-web** Railway service (copy from gsm-sports)
- [ ] After Railway redeploy, test login in incognito: should land in `/admin` without redirect
- [ ] Change admin password via `/profile` UI → then **remove** `ADMIN_PASSWORD` from Railway env (or rotate)

### 2. Important — end-to-end smoke (~30 min)
- [ ] Register a new test user (separate email) → verify email arrives via Resend → confirm verification flow
- [ ] Try forgot-password → email arrives → reset → new password works
- [ ] Try Google OAuth → consent screen → redirect back logged in
- [ ] Try creating a test tournament from admin panel
- [ ] Check Sentry catches a deliberate error

### 3. Important — backup pipeline (~15 min)
- [ ] Create Cloudflare R2 bucket `gsm-sports-backups`
- [ ] Generate R2 access keys
- [ ] Add as GitHub repo secrets: `PROD_DATABASE_URL`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] Manually trigger `.github/workflows/backup.yml` once → confirm file lands in R2
- [ ] Do a restore drill into a throwaway Postgres per `docs/runbooks/restore-from-backup.md`

### 4. Important — observability and ops (~20 min)
- [ ] M7: Better Stack monitor on `https://api.gsmarm.com/health` + `https://www.gsmarm.com/` → alerts to Telegram
- [ ] M8: `setWebhook` for Telegram bot pointed at `https://api.gsmarm.com/v1/telegram/webhook` (see deploy-production runbook for curl)

### 5. Important — legal text (M6, user-owned)
- [ ] Generate ToS + Privacy via termly.io or iubenda
- [ ] Hand text (ru/en/hy) to next session → insert into `apps/web/src/app/legal/{terms,privacy}/page.tsx`

### 6. Nice-to-have / follow-ups
- [ ] Fix 500 on `GET /v1/tournaments/featured-armfight` (camelCase vs snake_case in tournaments table, or null guard)
- [ ] Move DNS to Cloudflare → enables HTTPS apex redirect (`https://gsmarm.com` currently times out)
- [ ] Sentry source-map upload in CI (readable stack traces)
- [ ] Rotate Google OAuth Client Secret (was visible in earlier chat)
- [ ] Tag `v0.1.0` after smoke gate passes

## Known small issues (not blockers)

- **`https://gsmarm.com` (HTTPS apex) times out.** NameCheap URL Redirect only handles HTTP. Fix: migrate DNS to Cloudflare. Workaround: users typing `gsmarm.com` default to HTTP which redirects fine.
- **`GET /v1/tournaments/featured-armfight` returns 500.** Homepage featured section. Likely null check missing or column name mismatch.
- **`gptbot` (OpenAI) hits `/` and gets 404.** Cosmetic — no `/` route on api.
- **`sportsService.seed()` throws on each container restart** (sports already seeded). Now caught by try/catch in main.ts — logged but doesn't crash. Could be made idempotent later.

## How to resume in new session

The new agent should:
1. Read this file (`docs/ops/2026-05-25-session-handoff.md`)
2. Run `git pull origin main` and check `git log --oneline -20` to see latest commits
3. Run `curl https://api.gsmarm.com/health` to confirm api is up
4. Ask user current status of `JWT_ACCESS_SECRET` env on gsm-web — that's the immediate blocker
5. Proceed through "What's left" in priority order

## Reference docs

- `docs/superpowers/specs/2026-05-20-production-launch-week-design.md` — original spec
- `docs/superpowers/plans/2026-05-20-production-launch-week.md` — implementation plan (24 tasks)
- `docs/runbooks/deploy-production.md` — Railway deploy procedure (updated for Railway-only path)
- `docs/runbooks/restore-from-backup.md` — R2 restore drill
- `docs/runbooks/uptime-monitoring.md` — Better Stack setup
- `docs/STATUS.md` — feature implementation state
- `docs/ROADMAP.md` — phase pointers

## Repo + accounts

- GitHub: `valer0101/gsm-sports`
- Latest main: `84a39ce` (as of 25 May 2026, 10:30 UTC) — see `git log` for newer
- Railway project: `gsmarm-sport` (project ID in dashboard URL)
- Sentry org: `gsm-sports` at `gsm-sports.sentry.io`
- Resend account: `gsmarmofficial@gmail.com`
- Google Cloud project: `gsm-sports`
- Admin user (created in DB): `valeryordanyan@gmail.com` (password in Railway `ADMIN_PASSWORD` env, temporary)
