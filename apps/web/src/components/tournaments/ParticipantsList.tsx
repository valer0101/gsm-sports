'use client';

import { useTranslations } from 'next-intl';
import { useRegistrations } from '@/hooks/useTournaments';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AgeGroup } from '@/types/api';

const AGE_GROUP_KEYS: Record<AgeGroup, string> = {
  juniors: 'age_juniors',
  adults: 'age_adults',
  veterans: 'age_veterans',
};

interface Props {
  tournamentId: string;
}

export function ParticipantsList({ tournamentId }: Props) {
  const t = useTranslations('tournaments');
  const { data, isLoading, isError } = useRegistrations(tournamentId, { limit: 100 });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
        {t('participants_error')}
      </p>
    );
  }

  if (data.data.length === 0) {
    return (
      <p className="text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
        {t('participants_empty')}
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        {t('participants_count', { count: data.meta.total })}
      </p>
      <div className="divide-y divide-white/5">
        {data.data.map((entry, idx) => (
          <div key={entry.id} className="flex items-center gap-4 py-3">
            <span
              className="text-sm w-7 text-right shrink-0"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {idx + 1}
            </span>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
              {entry.user?.avatarUrl ? (
                <img src={entry.user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white/40">
                  {entry.user?.firstName?.[0] ?? '?'}
                </span>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">
                {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {entry.user?.country ?? ''}
              </p>
            </div>

            {/* Tags */}
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {entry.ageGroup && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {t(AGE_GROUP_KEYS[entry.ageGroup])}
                </span>
              )}
              {entry.hand && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {entry.hand === 'left' ? t('hand_left') : t('hand_right')}
                </span>
              )}
              {entry.weightKg && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-accent-dim)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {entry.weightKg} {t('kg')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
