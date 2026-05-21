# Deploy production

**Trigger:** Shipping a new version of api or web to production.
**Last tested:** _Not yet — first deploy pending._
**Deploy model:** Native Railway + Vercel auto-deploy off `main`. No custom GitHub Actions deploy job — `main` is already gated by the `ci-success` aggregate check via branch protection.
**Estimated time:** ~20 minutes (excluding wait time for builds).
**Risk level:** Medium — affects live users; rollback path exists but isn't instant.

## Prerequisites

- Hosting account active (Railway, Render, Fly.io, or self-hosted Coolify/Hetzner).
- Production secrets configured in the hosting platform's environment-variable UI (see "Required env vars" below).
- Domain DNS pointing at the hosting platform with HTTPS / SSL certificate provisioned.
- `main` branch is the current source of truth and CI is green on it.
- You have permission to push to `main` (or a release PR is already merged there).

## Required env vars

Set these in the hosting platform's environment UI before the first deploy. Keep them in a password manager / secrets vault, not in git.

### API (`@gsm/api`)

```
NODE_ENV=production
PORT=4000

# Database — provided by your hosting Postgres add-on
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Auth
JWT_SECRET=<generate with `openssl rand -base64 48`>
ADMIN_EMAIL=<first admin login>
ADMIN_PASSWORD=<initial admin password — change after first login>

# CORS allow-list (comma-separated, no localhost in prod)
FRONTEND_URL=https://gsm-sports.example,https://www.gsm-sports.example

# Telegram bot (if used)
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_WEBHOOK_SECRET=<random string>

# Observability — optional, code is no-op without DSN
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
LOG_LEVEL=info

# Email — Resend (sender requires verified domain)
RESEND_API_KEY=re_...
MAIL_FROM=GSM Sports <no-reply@your-domain>

# Used in reset / verification email link URLs (must match the public web URL)
NEXT_PUBLIC_SITE_URL=https://your-domain
```

### Web (`@gsm/web`)

```
NODE_ENV=production
PORT=3001
NEXT_PUBLIC_SITE_URL=https://gsm-sports.example
NEXT_PUBLIC_API_URL=https://api.gsm-sports.example
NEXT_PUBLIC_CONTACT_EMAIL=hello@gsm-sports.example
NEXT_PUBLIC_TELEGRAM_HANDLE=gsm_sports_bot

# Sentry (browser bundle requires NEXT_PUBLIC_)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# Server-side Sentry (same DSN, no public prefix)
SENTRY_DSN=https://...@sentry.io/...
```

## Railway-specific configuration

In the Railway dashboard for the api service:

- **Source**: this repo, branch `main`. Auto-deploy enabled.
- **Dockerfile path**: `apps/api/Dockerfile` (Railway detects it; double-check).
- **Pre-deploy command** (Railway calls this once per release before swapping traffic):

  ```
  npm run migration:run --workspace=@gsm/api
  ```

- **Start command**: leave empty (the Dockerfile `CMD` `node dist/main` is correct).
- **Postgres + Redis**: add as Railway services; copy their connection URLs into the api service's env (`DATABASE_URL`, `REDIS_URL`).
- **Health check path**: `/health` (Railway uses this to gate traffic to a new revision).

## Vercel-specific configuration

In the Vercel dashboard for the web project:

- **Root directory**: `apps/web`.
- **Framework preset**: Next.js (auto-detected).
- **Production branch**: `main`. Auto-deploy enabled.
- **Env vars**: per the "Web (@gsm/web)" list above.
- **Skip the standalone Dockerfile** — Vercel builds with its own pipeline. `apps/web/Dockerfile` is only used by Coolify/self-hosted paths.

## Resend (email) setup

1. Create a Resend account (free tier covers 3 000 emails/mo).
2. Add your sending domain (e.g. `mail.<your-domain>`). Resend will show DNS records — add the three records (SPF, DKIM, DMARC) at Cloudflare. Verification usually completes in minutes.
3. Create an API key, paste into Railway as `RESEND_API_KEY`.
4. Set `MAIL_FROM` to a sender on the verified domain, e.g. `GSM Sports <no-reply@mail.your-domain>`.
5. Test deliverability: hit `/v1/auth/forgot-password` with a real address and confirm the email lands in the primary inbox (not spam) for at least Gmail, iCloud, and Yandex.

## Steps

1. **Confirm CI is green on `main`.**
   ```sh
   gh run list --branch main --limit 5
   ```
   Or check the Actions tab. If anything is red, do not deploy.

2. **Database migrations.**

   Migrations run automatically via Railway's pre-deploy command (`npm run migration:run --workspace=@gsm/api`). To see status manually:

   ```sh
   cd apps/api && npm run migration:show
   ```

   To run a one-off from local against prod (rarely needed):

   ```sh
   DATABASE_URL="$PROD_DATABASE_URL" npm run migration:run --workspace=@gsm/api
   ```

3. **Deploy api.**
   - Railway / Render / Fly: trigger via UI ("Deploy") or via the platform CLI.
   - Coolify / docker-compose self-hosted:
     ```sh
     ssh production
     cd /srv/gsm
     git pull origin main
     docker compose -f docker-compose.yml up -d --build api
     ```
   Watch the build logs for errors. Fail fast — don't deploy web until api is healthy.

4. **Verify api health.**
   ```sh
   curl https://api.gsm-sports.example/health
   # → 200 { "status": "ok", "uptime": ..., "timestamp": "..." }

   curl https://api.gsm-sports.example/ready
   # → 200 { "status": "ok", "checks": { "db": "ok" }, ... }
   ```
   If `/ready` returns 503, the API is up but can't reach the DB — check `DATABASE_URL` and that migrations ran.

5. **Deploy web.**
   Same procedure as api.

6. **Smoke-test the live site.**
   - Open the production URL.
   - Sign in as admin.
   - Open `/admin/tournaments` — confirm the list loads.
   - Open one published tournament page — confirm the bracket renders.
   - Open `/legal/terms` and `/legal/privacy` — confirm they don't 404.

7. **Tag the release** (optional but recommended once a tagging cadence exists).
   ```sh
   git tag v0.1.<n>
   git push origin v0.1.<n>
   ```

## Verification

- ✅ `/health` and `/ready` both return 200 within 60s of deploy.
- ✅ `gh run list` shows the deploy workflow as `success` (once one exists).
- ✅ Sentry receives a `deploy` release event (if SENTRY_RELEASE is wired in CI).
- ✅ Existing user sessions still work (try logging in).
- ✅ A test tournament page renders without console errors in the browser.

## Rollback

The fastest rollback is **redeploy the previous image / commit**:

- **Railway / Render**: each deploy is keyed by commit. Click the previous successful deploy → "Redeploy."
- **Self-hosted**:
  ```sh
  ssh production
  cd /srv/gsm
  git checkout <previous-tag-or-sha>
  docker compose -f docker-compose.yml up -d --build
  ```

If a database migration is the cause of failure:
1. Check what changed: `cd apps/api && npx typeorm migration:show -d src/data-source.ts` (no npm script wraps `migration:show` yet — only `generate`, `run`, and `revert` are exposed in `apps/api/package.json`).
2. Revert the latest migration: `npm run migration:revert --workspace=@gsm/api`. Note: TypeORM `migration:revert` only undoes ONE migration — repeat if multiple new migrations were applied in this deploy.
3. Redeploy the previous code.

If migrations cannot be safely reverted (data loss): restore from the most recent backup. See `restore-from-backup.md` (TBD).

## Notes

- **Migrations are forward-only in spirit.** Don't generate migrations that drop columns lightly — if you need to remove a column, first deploy a migration that stops writing to it; then a later release drops it. This avoids the rollback trap.
- **First-deploy gotcha:** the `seedAdmin` step in `apps/api/src/main.ts` runs on every boot. If `ADMIN_EMAIL` / `ADMIN_PASSWORD` aren't set, it logs a warning and skips. Set them once for the first admin, then remove them or rotate after first login.
- **CORS misconfig is the #1 first-deploy pain point.** Symptom: `/health` works in curl but the web app shows "Network error" everywhere. Fix: `FRONTEND_URL` env var is missing or doesn't list your actual frontend hostname (with scheme).
- **Telegram webhook URL must be set ONCE after the bot token + production URL are live:**
  ```sh
  curl -F "url=https://api.gsm-sports.example/v1/telegram/webhook" \
       -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
       https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
  ```
- **Don't deploy on Friday afternoon** unless someone is on call through the weekend.
