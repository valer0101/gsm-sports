# Deploy production

**Trigger:** Shipping a new version of api or web to production.
**Last tested:** _Not yet — first deploy pending._
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

## Steps

1. **Confirm CI is green on `main`.**
   ```sh
   gh run list --branch main --limit 5
   ```
   Or check the Actions tab. If anything is red, do not deploy.

2. **Run database migrations against production.**

   Migrations are TypeORM-generated TypeScript files in `apps/api/src/migrations/`. Run them once per release, before swapping traffic to the new container.

   Most hosting platforms can be configured to run a one-shot job before container start — set the start command to:
   ```
   npm run migration:run --workspace=@gsm/api && node apps/api/dist/main
   ```
   For more controlled deploys, run migrations from a one-off job:
   ```sh
   # SSH or platform shell into the running api container, then:
   npm run migration:run --workspace=@gsm/api
   ```

3. **Deploy api.**
   - Railway / Render / Fly: trigger via UI ("Deploy") or via the platform CLI.
   - Coolify / docker-compose self-hosted:
     ```sh
     ssh production
     cd /srv/gsm
     git pull origin main
     docker compose -f docker-compose.prod.yml up -d --build api
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
  docker compose -f docker-compose.prod.yml up -d --build
  ```

If a database migration is the cause of failure:
1. Check what changed: `npm run migration:show --workspace=@gsm/api`.
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
