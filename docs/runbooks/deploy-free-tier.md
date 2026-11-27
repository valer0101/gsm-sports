# Deploy on free tier (Vercel + Render + Neon)

**Why:** Railway trial expired (Nov 2026) and the owner chose not to pay. Old Railway data was test-only, so we start from an empty database.
**Cost:** $0/month.
**Estimated time:** ~1 hour, mostly clicking through dashboards.

## Target layout

| Part | Service | Domain | Free-tier limits |
|---|---|---|---|
| Web (Next.js) | **Vercel** (Hobby) | `gsmarm.com`, `www.gsmarm.com` | Non-commercial use only |
| API (NestJS) | **Render** (Free Web Service, Docker) | `api.gsmarm.com` | Sleeps after 15 min idle; first request after sleep ~30–60 s; 512 MB RAM; 750 h/month |
| Postgres | **Neon** (Free) | — | 0.5 GB storage, auto-suspends when idle (fast resume) |
| Uploads | **Cloudflare R2** | `uploads.gsmarm.com` | 10 GB free |
| DNS | NameCheap (unchanged registrar) | — | — |

**Redis is not needed** — the API code does not use it (throttler is in-memory).

### Known trade-offs
- Render free instance sleeps → cron jobs (`MatchReminderTask`, Telegram reminders) do not run while asleep. For tournament days, keep it awake with an uptime ping (see step 6) or upgrade the API service only.
- Vercel Hobby forbids commercial use. If the site starts taking payments/ads, move web to Vercel Pro or to Render/Cloudflare.

## 1. Database — Neon

1. Sign up at https://neon.tech (GitHub login is fine).
2. Create project `gsm-sports`, region **AWS Europe (Frankfurt)** (closest to Render Frankfurt).
3. Copy the **pooled** connection string. It looks like
   `postgresql://<USER>:<PASSWORD>@<ENDPOINT>-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   Keep `?sslmode=require` — `pg` reads it from the URL, no code change needed.

Tables are created automatically: in production the API runs `migrationsRun: true` on every boot, then `seedAdmin` creates the admin user.

## 2. API — Render

1. Sign up at https://render.com with GitHub, give it access to `valer0101/gsm-sports`.
2. **New → Web Service** → pick the repo.
   - Branch: `main`
   - Region: **Frankfurt (EU Central)**
   - Runtime / Language: **Docker**
   - Root Directory: *(leave empty — repo root is the build context)*
   - Dockerfile Path: `apps/api/Dockerfile`
   - Instance type: **Free**
   - Health Check Path (Advanced): `/health`
3. Environment variables (Advanced → Add from .env is fastest):

```
NODE_ENV=production
PORT=4000
DATABASE_URL=<Neon pooled URL from step 1>

JWT_ACCESS_SECRET=<new random 64 chars>
JWT_REFRESH_SECRET=<new random 64 chars>
JWT_CHECKIN_SECRET=<new random 64 chars>
JWT_TELEGRAM_LINK_SECRET=<new random 64 chars>
OAUTH_STATE_SECRET=<new random 64 chars>
JWT_ACCESS_EXPIRES=15m

FRONTEND_URL=https://gsmarm.com,https://www.gsmarm.com
COOKIE_DOMAIN=.gsmarm.com

ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<temporary — change after first login, then delete this var>

# Optional — add when the services are set up again
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.gsmarm.com/v1/auth/google/callback
GOOGLE_SUCCESS_REDIRECT=https://www.gsmarm.com/auth/google/callback
RESEND_API_KEY=...
MAIL_FROM=GSM Sports <no-reply@mail.gsmarm.com>
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_UPLOADS_BUCKET=gsm-uploads
R2_PUBLIC_BASE_URL=https://uploads.gsmarm.com
TELEGRAM_BOT_TOKEN=...
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://api.gsmarm.com/v1/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=...
```

   Generate secrets locally: `openssl rand -hex 32`.
   Without R2 vars the API boots and logs a warning; only uploads fail.
4. Create the service. First build takes ~5–8 min. Check `https://<name>.onrender.com/health` → `200`.
5. **Settings → Custom Domains → Add** `api.gsmarm.com`. Render shows a CNAME target (`<name>.onrender.com`).

## 3. Web — Vercel

1. Sign up at https://vercel.com with GitHub, **Add New → Project** → import `valer0101/gsm-sports`.
2. **Root Directory:** `apps/web` (Vercel picks up `apps/web/vercel.json`, which installs and builds from the monorepo root). Framework: Next.js.
3. Environment variables (Production):

```
NEXT_PUBLIC_SITE_URL=https://www.gsmarm.com
NEXT_PUBLIC_API_URL=https://api.gsmarm.com/v1
NEXT_PUBLIC_TELEGRAM_HANDLE=gsm_arm_sport
NEXT_PUBLIC_CONTACT_EMAIL=<public contact email>
JWT_ACCESS_SECRET=<byte-identical to the API's JWT_ACCESS_SECRET>
# Optional
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
```

   `JWT_ACCESS_SECRET` is required — without it the middleware cannot verify the cookie and `/admin` loops back to login.
4. Deploy. Then **Settings → Domains → Add** `www.gsmarm.com` and `gsmarm.com` (set apex to redirect to www). Vercel shows the DNS records.

## 4. DNS at NameCheap

Domain List → `gsmarm.com` → **Advanced DNS**. Delete the old Railway records (`api`/`www` CNAMEs to `…up.railway.app`, `_railway-verify.*` TXT, the `@` URL Redirect). Keep the Resend `send.mail`, `resend._domainkey.mail` and `_dmarc` records.

| Type | Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` (Vercel — check the value Vercel shows) |
| CNAME | `www` | `cname.vercel-dns.com.` (or the value Vercel shows) |
| CNAME | `api` | `<name>.onrender.com.` |

Vercel serves HTTPS on the apex, which also fixes the old "`https://gsmarm.com` times out" issue.
Propagation: usually 5–30 min. Vercel and Render issue certificates automatically once DNS resolves.

## 5. External services to repoint

- **Google OAuth** (Cloud Console → Credentials → `gsm-sports-web-oauth`): JS origins `https://gsmarm.com`, `https://www.gsmarm.com`; redirect URI `https://api.gsmarm.com/v1/auth/google/callback` — unchanged if domains stay the same.
- **Telegram webhook:** after the API is up, call `setWebhook` (see `deploy-production.md`).

## 6. Smoke test

1. `curl https://api.gsmarm.com/health` → `200` (first call may take ~60 s while Render wakes).
2. Open `https://www.gsmarm.com` and `https://gsmarm.com` → both load over HTTPS.
3. Log in with `ADMIN_EMAIL` in incognito → `/admin` opens without redirect loop.
4. Change the admin password in `/profile`, then delete `ADMIN_PASSWORD` from Render env.
5. Optional keep-awake: a free UptimeRobot / Better Stack monitor on `https://api.gsmarm.com/health` every 5–10 min keeps Render from sleeping during the day (counts toward the 750 h/month — one service running 24/7 fits).

## 7. Clean up

- Railway: delete project `gsmarm-sport` so it cannot bill later.
- Backups: `.github/workflows/backup.yml` works against Neon too — set `PROD_DATABASE_URL` to the Neon **direct** (non-pooled) URL in GitHub secrets.
