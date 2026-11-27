/**
 * One-off cleanup: when uploads migrated from local container disk to
 * Cloudflare R2, every URL previously stored in the DB became dead (the
 * `apps/api/uploads/` directory was wiped on the next Railway redeploy).
 *
 * This script walks every column that holds an uploaded-file URL and
 * NULLs out rows whose URL points at the legacy local path. The UI
 * already falls back to a placeholder when the URL is null.
 *
 * Run once, in prod, after the R2 deploy goes out:
 *   cd apps/api
 *   npx ts-node scripts/null-dead-upload-urls.ts
 *
 * Run with --dry-run to preview without writing:
 *   npx ts-node scripts/null-dead-upload-urls.ts --dry-run
 *
 * A URL is considered dead if it matches `%/uploads/%` — covers both the
 * old `${API_BASE_URL}/uploads/<uuid>.<ext>` shape and any relative
 * `/uploads/<uuid>.<ext>` variant.
 */

import { AppDataSource } from '../src/data-source';

const TARGETS: Array<{ table: string; column: string }> = [
  { table: 'users', column: 'avatarUrl' },
  { table: 'athletes', column: 'photoUrl' },
  { table: 'tournaments', column: 'posterUrl' },
  { table: 'news', column: 'coverImage' },
  { table: 'sports', column: 'iconUrl' },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await AppDataSource.initialize();

  // eslint-disable-next-line no-console
  console.log(`[null-dead-upload-urls] ${dryRun ? 'DRY RUN — ' : ''}scanning ${TARGETS.length} columns`);

  let totalNulled = 0;
  for (const { table, column } of TARGETS) {
    const countRows: Array<{ count: string }> = await AppDataSource.query(
      `SELECT COUNT(*) AS count FROM "${table}" WHERE "${column}" LIKE '%/uploads/%'`,
    );
    const count = Number(countRows[0]?.count ?? 0);
    // eslint-disable-next-line no-console
    console.log(`  ${table}.${column}: ${count} row${count === 1 ? '' : 's'} match`);

    if (!dryRun && count > 0) {
      await AppDataSource.query(
        `UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" LIKE '%/uploads/%'`,
      );
    }
    totalNulled += count;
  }

  // eslint-disable-next-line no-console
  console.log(`[null-dead-upload-urls] ${dryRun ? 'would null' : 'nulled'} ${totalNulled} row(s) total`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[null-dead-upload-urls] failed:', err);
  process.exit(1);
});
