# Uptime monitoring

**Goal:** an external service pings `/health` (api) and `/` (web) every minute and alerts on failure.

## Recommended provider: Better Stack (formerly Better Uptime)

Free tier: 10 monitors, 3-minute checks. Sufficient for launch.

Alternative: UptimeRobot — slightly less polished UI, similar free tier.

## Setup

1. Create an account at https://betterstack.com.
2. Add two **HTTP monitors**:

   | Monitor name | URL | Expected | Interval |
   |---|---|---|---|
   | GSM API health | `https://api.<your-domain>/health` | 200, JSON contains `"status":"ok"` | 1 min |
   | GSM Web | `https://<your-domain>/` | 200 | 1 min |

   Both endpoints are `@Public()` + `@SkipThrottle()` server-side (see `apps/api/src/health/health.controller.ts`), so the monitor needs no credentials.

3. Add a Telegram alert channel:
   - In Better Stack: Integrations → Telegram → follow the prompt to add the Better Stack bot to your Telegram group.
   - Route both monitors to that channel.

4. Force a test alert:
   - Pause the api monitor's target URL (temporarily stop the Railway service, or change the monitor URL to a 404 endpoint).
   - Confirm an alert lands in Telegram within ~5 minutes.
   - Restore the monitor.

## Verification

- [ ] Both monitors are in "Up" state.
- [ ] Test alert reached Telegram and recovery alert followed.
- [ ] Status page (if you enabled the public one) shows both monitors green.

## Notes

- **Don't put auth on `/health`.** The monitor is unauthenticated by design.
- **Watch `/ready`, not `/health`, only if you want the alert to fire when the DB is unreachable.** For launch we keep `/health` (process alive) as the primary signal — DB hiccups will surface in Sentry; the uptime monitor watches "is the box up."
- **First-week noise:** expect 1–2 false positives from cold deploys. After two weeks of stability you can tighten the alert threshold.
