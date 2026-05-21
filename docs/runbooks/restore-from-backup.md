# Restore database from backup

**Trigger:** Production data loss or corruption — needs a point-in-time restore from a `pg_dump` snapshot stored in Cloudflare R2.
**Last tested:** _Pending — first restore drill is part of the launch-week go-live gate._
**Estimated time:** 15–30 minutes for a database under ~1 GB.
**Risk level:** High — restores overwrite live data. Always restore to a fresh database first when possible.

## Prerequisites

- Access to the R2 bucket (`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` in your local env, or via Cloudflare dashboard).
- `aws` CLI installed locally (R2 is S3-compatible).
- `psql` and `gunzip` available locally.
- A target Postgres URL — **prefer a fresh DB**, not the live one, for verification.

## Steps

### 1. List recent backups

```sh
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 ls s3://gsm-sports-backups/ --recursive \
  --endpoint-url "$R2_ENDPOINT" \
  | sort | tail -10
```

You'll see keys like `2026/05/19/gsm-2026-05-19T03-00-00Z.sql.gz`.

### 2. Download the target backup

```sh
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 cp s3://gsm-sports-backups/2026/05/19/gsm-2026-05-19T03-00-00Z.sql.gz /tmp/restore.sql.gz \
  --endpoint-url "$R2_ENDPOINT"
```

### 3. Restore to a **fresh** database first

Create or pick an empty database. Never restore over the live DB until verified.

```sh
# Example: a Railway preview branch or a local docker compose Postgres.
RESTORE_URL="postgresql://user:pass@host:5432/gsm_restore"

gunzip -c /tmp/restore.sql.gz | psql "$RESTORE_URL"
```

### 4. Verify

Connect with `psql "$RESTORE_URL"` and spot-check:

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM tournaments;
SELECT max(created_at) FROM users; -- should be near the backup timestamp
```

### 5. Promote (only if step 4 looks correct)

If the restore database itself is the new prod (e.g., a Railway "swap" path), update the production `DATABASE_URL` and restart the api.

If you're restoring INTO the existing prod database (more invasive):

```sh
# Take an emergency snapshot of the current corrupt state first.
pg_dump "$PROD_DATABASE_URL" | gzip > "/tmp/emergency-pre-restore-$(date -u +%FT%TZ).sql.gz"

# Drop and recreate schema, then load.
psql "$PROD_DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c /tmp/restore.sql.gz | psql "$PROD_DATABASE_URL"
```

### 6. Run any pending migrations

If the restored snapshot is older than the deployed code:

```sh
DATABASE_URL="$PROD_DATABASE_URL" npm run migration:run --workspace=@gsm/api
```

### 7. Smoke test the live site

- `curl https://api.<your-domain>/ready` → 200.
- Sign in as admin, open the admin tournaments list, open one tournament page.

## Verification (drill — to be run as part of go-live)

- [ ] A backup uploaded in the last 24 hours is listed in R2.
- [ ] Download succeeds.
- [ ] Restore to a throwaway DB succeeds without errors.
- [ ] `users` and `tournaments` row counts roughly match production.
- [ ] No orphan-foreign-key warnings in the psql output.

## Notes

- **Retention is manual for now.** R2 keeps everything; cull older than 30 days with a one-shot `aws s3 rm --recursive` if storage grows.
- **The `pg_dump` is logical (plain SQL).** It does NOT preserve sequence IDs across schema-only upgrades — always run migrations after restore if the schema has moved forward.
- **Don't restore over the live DB during an outage without first taking the emergency snapshot.** Without it you can't tell whether a restore made things worse.
