import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import type { Tournament } from '@/types/api';

const MONTHS_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const PRIZE_EMOJI: Record<string, string> = {
  money: '$',
  medal: '🥇',
  trophy: '🏆',
  certificate: '📜',
  custom: '🎁',
};
const AGE_LABELS: Record<string, string> = {
  under18: 'U18',
  under23: 'U23',
  adults: '23+',
  veterans: 'VET',
  open: 'OPEN',
};

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const locale = useLocale();

  const d = new Date(tournament.startDate);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  const cfg = (tournament.sportConfig ?? {}) as Record<string, any>;
  const prizes: any[] = cfg.prizes ?? [];
  const ageGroups: string[] = cfg.ageGroups ?? [];
  const entryFee = cfg.entryFee;
  const weightCategories = [...(tournament.weightCategories ?? [])].sort(
    (a, b) => (a.maxWeight ?? 9999) - (b.maxWeight ?? 9999),
  );

  // Top money prize
  const moneyPrize = prizes.find((p) => p.type === 'money' && p.value);
  const hasPrize = prizes.length > 0;

  const isFull = tournament.maxParticipants != null && !tournament.registrationOpen;
  const canRegister = tournament.registrationOpen;

  const sportName = tournament.sport
    ? locale === 'ru'
      ? tournament.sport.nameRu
      : locale === 'hy'
        ? tournament.sport.nameHy
        : tournament.sport.nameEn
    : null;

  return (
    <Link
      href={`/tournaments/${tournament.slug}`}
      className="group block rounded-2xl overflow-hidden border border-white/10 transition-all hover:border-white/25 hover:-translate-y-1 hover:shadow-2xl"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      {/* ─── Image / Banner ─── */}
      <div className="relative h-44 bg-gradient-to-br from-white/5 to-white/10 overflow-hidden">
        {tournament.posterUrl ? (
          <Image
            src={tournament.posterUrl}
            alt={tournament.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {sportName && (
              <span
                className="text-xs font-bold px-2 py-1 rounded bg-black/60 backdrop-blur-sm uppercase tracking-wider"
                style={{ color: 'var(--color-accent)' }}
              >
                {sportName}
              </span>
            )}
            {cfg.competitionType && (
              <span className="text-xs font-bold px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-white uppercase tracking-wider">
                {cfg.competitionType === 'armfight' ? 'ARMFIGHT' : 'СЕТКА'}
              </span>
            )}
          </div>
          {tournament.isLive && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-red-600/80 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
          {isFull && !tournament.isLive && (
            <span className="text-xs font-bold px-2 py-1 rounded bg-black/60 text-white/50">
              FULL
            </span>
          )}
        </div>

        {/* Date bottom-left */}
        <div className="absolute bottom-3 left-3">
          <p className="font-black text-2xl leading-none" style={{ color: 'var(--color-accent)' }}>
            {month} {day}
          </p>
          <p className="text-xs text-white/60 font-medium">{year}</p>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="p-4">
        {/* Name */}
        <h3 className="font-black text-white text-base leading-tight mb-3 line-clamp-2 uppercase tracking-wide">
          {tournament.name}
        </h3>

        {/* Info rows */}
        <div className="space-y-1.5 mb-3">
          {tournament.location && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="text-sm">📍</span>
              <span className="uppercase tracking-wider font-medium">{tournament.location}</span>
            </div>
          )}

          {weightCategories.length > 0 && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="text-sm">⚖️</span>
              <span className="uppercase tracking-wider">
                {weightCategories.length <= 4
                  ? weightCategories.map((w) => w.name).join(', ')
                  : `${weightCategories
                      .slice(0, 3)
                      .map((w) => w.name)
                      .join(', ')} +${weightCategories.length - 3}`}
              </span>
            </div>
          )}

          {ageGroups.length > 0 && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="text-sm">👤</span>
              <span className="uppercase tracking-wider">
                {ageGroups.map((a) => AGE_LABELS[a] ?? a).join(', ')}
              </span>
            </div>
          )}

          {hasPrize && (
            <div className="flex items-center gap-2 text-xs">
              {moneyPrize ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20 font-black text-green-400 leading-none text-sm shrink-0">
                  $
                </span>
              ) : (
                <span className="text-sm shrink-0">🏆</span>
              )}
              <span
                className="font-bold uppercase tracking-wider"
                style={{ color: moneyPrize ? '#4ade80' : '#fbbf24' }}
              >
                {moneyPrize
                  ? `${Number(moneyPrize.value).toLocaleString()} AMD PRIZE POOL`
                  : prizes
                      .map((p) => (p.type === 'money' ? '$' : (PRIZE_EMOJI[p.type] ?? '🎁')))
                      .join(' ')}
              </span>
            </div>
          )}

          {entryFee && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="text-sm">{entryFee.type === 'free' ? '🎁' : '💰'}</span>
              <span className="uppercase tracking-wider">
                {entryFee.type === 'free'
                  ? 'Бесплатная регистрация'
                  : entryFee.amount
                    ? `Взнос: ${Number(entryFee.amount).toLocaleString()} AMD`
                    : 'Платный взнос'}
              </span>
            </div>
          )}
        </div>

        {/* CTA Button */}
        <button
          className="w-full py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border"
          style={
            canRegister
              ? {
                  backgroundColor: 'var(--color-accent)',
                  borderColor: 'var(--color-accent)',
                  color: 'white',
                }
              : isFull
                ? {
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.4)',
                  }
                : {
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.6)',
                  }
          }
        >
          {canRegister ? 'Register' : isFull ? 'Join Waitlist' : 'View Details'}
        </button>
      </div>
    </Link>
  );
}
