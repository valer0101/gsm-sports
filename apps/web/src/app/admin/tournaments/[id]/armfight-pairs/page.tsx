'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAdminTournament, useConfirmedEntries, useArmfightBracket } from '@/hooks/useAdmin';
import { isArmfightTournament } from '@/lib/armfight';
import { PairBuilder } from '@/components/admin/armfight-pairs/PairBuilder';
import { PairsSummary } from '@/components/admin/armfight-pairs/PairsSummary';
import { EmptyEntriesState } from '@/components/admin/armfight-pairs/EmptyEntriesState';

export default function ArmfightPairsPage({ params }: { params: { id: string } }) {
  const t = useTranslations('armfight_pairs');
  const { data: tournament, isLoading: loadingT } = useAdminTournament(params.id);
  const { data: entriesEnvelope, isLoading: loadingE } = useConfirmedEntries(params.id);
  const { data: bracket, isLoading: loadingB } = useArmfightBracket(params.id);

  if (loadingT || loadingE || loadingB) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-6 w-40 rounded bg-[var(--color-surface-2)] animate-pulse mb-6" />
        <div className="h-64 rounded bg-[var(--color-surface-2)] animate-pulse" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold">404</h2>
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
          href={`/admin/tournaments/${params.id}`}
          className="inline-block mt-6 px-4 py-2 rounded-md text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
        >
          {t('back_to_tournament')}
        </Link>
      </div>
    );
  }

  const entries = entriesEnvelope?.data ?? [];
  const status = (tournament as any).status as string;
  const bracketGenerated = (tournament as any).bracketGenerated as boolean;
  const terminal = status === 'completed' || status === 'cancelled';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('page_title')}
        </h1>
        <Link
          href={`/admin/tournaments/${params.id}`}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t('back_to_tournament')}
        </Link>
      </div>

      {/* State 4 — completed/cancelled (bracket may be null if never generated) */}
      {terminal ? (
        bracket ? (
          <PairsSummary tournamentId={params.id} bracket={bracket} canRebuild={false} />
        ) : (
          <EmptyEntriesState tournamentId={params.id} />
        )
      ) : /* State 3 — bracket generated */
      bracketGenerated && bracket ? (
        <PairsSummary tournamentId={params.id} bracket={bracket} canRebuild />
      ) : /* State 1 — fewer than 2 confirmed entries */
      entries.length < 2 ? (
        <EmptyEntriesState tournamentId={params.id} />
      ) : (
        /* State 2 — full form */
        <PairBuilder tournamentId={params.id} confirmedEntries={entries} />
      )}
    </div>
  );
}
