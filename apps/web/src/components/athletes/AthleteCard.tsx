import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { Athlete } from '@/types/api';
import { CountryLabel } from '@/components/ui/CountryLabel';

interface AthleteCardProps {
  athlete: Athlete;
}

export function AthleteCard({ athlete: a }: AthleteCardProps) {
  const t = useTranslations('athletes');
  const fullName = `${a.firstName} ${a.lastName}`;

  return (
    <Link
      href={`/athletes/${a.slug}`}
      className="flex gap-4 rounded-xl border border-white/10 p-4 transition-all hover:border-white/25 hover:-translate-y-0.5"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 w-20 h-20 rounded-full overflow-hidden border border-white/15 flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        {a.photoUrl ? (
          <Image
            src={a.photoUrl}
            alt={fullName}
            width={80}
            height={80}
            className="object-cover w-full h-full [object-position:center_15%]"
          />
        ) : (
          <span className="text-xl font-bold text-white/40">
            {a.firstName[0]}
            {a.lastName[0]}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">{fullName}</span>
          {a.isVerified && (
            <svg className="w-4 h-4 shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        <div className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {a.country && <CountryLabel value={a.country} />}
          {a.primaryHand && (
            <span className="ml-2">
              ·{' '}
              {t(
                a.primaryHand === 'left'
                  ? 'left_hand'
                  : a.primaryHand === 'right'
                    ? 'right_hand'
                    : 'both_hands',
              )}
            </span>
          )}
        </div>

        {/* Ranking badges */}
        <div className="flex gap-3 mt-2">
          {a.worldRank && (
            <span className="text-xs" style={{ color: 'var(--color-accent)' }}>
              🌍 #{a.worldRank}
            </span>
          )}
          {a.totalPoints > 0 && (
            <span className="text-xs text-white/50">
              {a.totalPoints} {t('points')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
