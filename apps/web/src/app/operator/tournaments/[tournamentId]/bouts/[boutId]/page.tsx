'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useOperatorBrackets } from '@/hooks/useOperator';
import { Skeleton } from '@/components/ui/Skeleton';
import { BoutFocusView } from '@/components/operator/armfight/BoutFocusView';

export default function BoutFocusPage({
  params,
}: {
  params: Promise<{ tournamentId: string; boutId: string }>;
}) {
  const { tournamentId, boutId } = use(params);
  const t = useTranslations('operator_armfight');
  const { data: brackets, isLoading } = useOperatorBrackets(tournamentId);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Skeleton className="h-screen w-full rounded-2xl" />
      </div>
    );
  }

  const bracket = (brackets ?? []).find(
    (b) => (b.bracketData as any)?.format === 'armfight',
  );

  if (!bracket) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p className="text-white font-bold">{t('error_not_armfight')}</p>
        <Link
          href={`/operator/tournaments/${tournamentId}`}
          className="underline text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('back_to_card')}
        </Link>
      </div>
    );
  }

  return (
    <BoutFocusView
      tournamentId={tournamentId}
      bracketId={bracket.id}
      boutId={boutId}
      isLocked={bracket.isLocked}
    />
  );
}
