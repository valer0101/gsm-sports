import { useTranslations } from 'next-intl';
import Link from 'next/link';

/** State 1 — fewer than 2 confirmed entries OR tournament still in
 *  draft. Tells the admin to open registration first. */
export function EmptyEntriesState({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('armfight_pairs');
  return (
    <div className="max-w-xl mx-auto py-12 text-center">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
        {t('empty_no_entries_title')}
      </h2>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {t('empty_no_entries_body')}
      </p>
      <Link
        href={`/admin/tournaments/${tournamentId}`}
        className="inline-block mt-6 px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        {t('back_to_tournament')}
      </Link>
    </div>
  );
}
