'use client';

/**
 * Inner view component. Lives in `_view.tsx` (underscore-prefixed so
 * Next.js doesn't treat it as a route) — the default-export route in
 * `page.tsx` unwraps the awaitable `params` with `React.use` and delegates
 * here with a plain `id`. Splitting the unwrap from the view lets unit
 * tests render this directly without a Suspense boundary around the
 * `use(params)` suspend.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAdminTournament, useConfirmedEntries, useArmfightBracket } from '@/hooks/useAdmin';
import { isArmfightTournament } from '@/lib/armfight';
import { Skeleton } from '@/components/ui/Skeleton';
import { PairBuilder } from '@/components/admin/armfight-pairs/PairBuilder';
import { PairsSummary } from '@/components/admin/armfight-pairs/PairsSummary';
import { EmptyEntriesState } from '@/components/admin/armfight-pairs/EmptyEntriesState';

export function ArmfightPairsView({ id }: { id: string }) {
  const t = useTranslations('armfight_pairs');
  const { data: tournament, isLoading: loadingT } = useAdminTournament(id);
  const { data: entriesEnvelope, isLoading: loadingE } = useConfirmedEntries(id);
  const { data: bracket, isLoading: loadingB } = useArmfightBracket(id);

  if (loadingT || loadingE || loadingB) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-64 w-full rounded" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t('tournament_not_found')}
        </h2>
        <Link
          href="/admin/tournaments"
          className="inline-block mt-6 px-4 py-2 rounded-md text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
        >
          {t('back_to_list')}
        </Link>
      </div>
    );
  }

  // Defensive: direct URL access to /armfight-pairs on a non-armfight tournament
  if (!isArmfightTournament(tournament as any)) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t('not_armfight_title')}
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {t('not_armfight_body')}
        </p>
        <Link
          href={`/admin/tournaments/${id}`}
          className="inline-block mt-6 px-4 py-2 rounded-md text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
        >
          {t('back_to_tournament')}
        </Link>
      </div>
    );
  }

  const entries = entriesEnvelope?.data ?? [];
  const status = (tournament as any).status as string;
  const terminal = status === 'completed' || status === 'cancelled';
  // State-3 detection uses the bracket itself, not `tournament.bracketGenerated` —
  // the backend's single-bracket `generate()` path (which sub-project B Task 19
  // wired armfight to use) never flips that flag; only `generateAll` does. Bracket
  // presence from useArmfightBracket is the authoritative signal.
  const hasBracket = bracket !== null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('page_title')}
        </h1>
        <Link
          href={`/admin/tournaments/${id}`}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t('back_to_tournament')}
        </Link>
      </div>

      {/* State 4 — completed/cancelled (bracket may be null if never generated) */}
      {terminal ? (
        bracket ? (
          <PairsSummary tournamentId={id} bracket={bracket} canRebuild={false} />
        ) : (
          <EmptyEntriesState tournamentId={id} />
        )
      ) : /* State 3 — bracket exists for this armfight tournament */
      hasBracket && bracket ? (
        <PairsSummary tournamentId={id} bracket={bracket} canRebuild />
      ) : /* State 1 — fewer than 2 confirmed entries */
      entries.length < 2 ? (
        <EmptyEntriesState tournamentId={id} />
      ) : (
        /* State 2 — full form */
        <PairBuilder tournamentId={id} confirmedEntries={entries} />
      )}
    </div>
  );
}
