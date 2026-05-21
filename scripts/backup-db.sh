#!/usr/bin/env bash
#
# Daily Postgres → Cloudflare R2 backup.
#
# Run from the GitHub Actions backup workflow OR ad-hoc from any
# environment that has these env vars set:
#
#   DATABASE_URL          Production Postgres URL (postgresql://...)
#   R2_ENDPOINT           e.g. https://<account>.r2.cloudflarestorage.com
#   R2_BUCKET             Bucket name, e.g. gsm-sports-backups
#   R2_ACCESS_KEY_ID      R2 access key (created in Cloudflare dashboard)
#   R2_SECRET_ACCESS_KEY  R2 secret
#
# Produces an object named YYYY/MM/DD/gsm-<ISO>.sql.gz in R2.
# Exits non-zero on dump or upload failure — failure must propagate so
# the GHA job goes red and the alert fires.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DATE_PATH="$(date -u +%Y/%m/%d)"
KEY="${DATE_PATH}/gsm-${TS}.sql.gz"

echo "[backup] dumping to ${KEY}"

# pg_dump -Fc would be smaller, but plain SQL is restorable with psql alone
# (no pg_restore needed), which keeps the restore runbook simple.
pg_dump --no-owner --no-privileges "${DATABASE_URL}" | gzip -9 > "/tmp/backup.sql.gz"

# Upload via aws CLI (R2 is S3-compatible). The CLI must already be
# installed (the GHA runner image ships with it).
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 cp /tmp/backup.sql.gz "s3://${R2_BUCKET}/${KEY}" \
  --endpoint-url "${R2_ENDPOINT}" \
  --no-progress

SIZE="$(stat -c%s /tmp/backup.sql.gz 2>/dev/null || stat -f%z /tmp/backup.sql.gz)"
echo "[backup] uploaded ${SIZE} bytes to s3://${R2_BUCKET}/${KEY}"
rm -f /tmp/backup.sql.gz
