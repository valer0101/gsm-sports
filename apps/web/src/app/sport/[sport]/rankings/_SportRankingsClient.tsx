'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWorldRankings } from '@/hooks/useRankings';
import type { RankingEntry } from '@/types/api';

const WEIGHT_CATEGORIES = [
  { key: '115+', labelEn: 'SUPER HEAVYWEIGHT', labelRu: 'СУПЕРТЯЖ',    sub: '115KG+' },
  { key: '105',  labelEn: 'HEAVYWEIGHT',       labelRu: 'ТЯЖЁЛЫЙ',     sub: '115KG'  },
  { key: '95',   labelEn: 'LIGHT HEAVYWEIGHT', labelRu: 'ПОЛУТЯЖ',     sub: '105KG'  },
  { key: '85',   labelEn: 'MIDDLEWEIGHT',      labelRu: 'СРЕДНИЙ',     sub: '95KG'   },
  { key: '77',   labelEn: 'WELTERWEIGHT',      labelRu: 'ПОЛУСРЕДНИЙ', sub: '85KG'   },
  { key: '70',   labelEn: 'LIGHTWEIGHT',       labelRu: 'ЛЁГКИЙ',     sub: '77KG'   },
  { key: '63',   labelEn: 'FEATHERWEIGHT',     labelRu: 'НАИЛЕГЧ.',    sub: '70KG'   },
];

function AthleteRow({ entry, rank }: { entry: RankingEntry; rank: number }) {
  const isFirst = rank === 1;
  if (!entry.athlete) return null;
  return (
    <Link
      href={`/athletes/${entry.athlete.slug}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
      style={{
        backgroundColor: isFirst ? 'rgba(212,175,55,0.08)' : 'transparent',
        borderLeft: isFirst ? '2px solid var(--color-accent)' : '2px solid transparent',
      }}
    >
      <span className={`w-6 text-center font-black text-sm shrink-0 ${
        rank === 1 ? 'text-yellow-400' :
        rank === 2 ? 'text-gray-300' :
        rank === 3 ? 'text-amber-600' : 'text-white/30'
      }`}>
        {rank}
      </span>

      <div
        className="w-24 h-24 rounded-full overflow-hidden border border-white/10 shrink-0 flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        {entry.athlete.photoUrl ? (
          <Image src={entry.athlete.photoUrl} alt="" width={96} height={96} className="object-cover" />
        ) : (
          <span className="text-lg font-bold text-white/40">
            {entry.athlete.firstName?.[0]}{entry.athlete.lastName?.[0]}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isFirst ? 'text-yellow-400' : 'text-white'}`}>
          {entry.athlete.firstName} {entry.athlete.lastName}
        </p>
      </div>

      <span className="text-sm shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
        {entry.country}
      </span>
    </Link>
  );
}

function HandColumn({ title, entries, isLoading }: { title: string; entries: RankingEntry[]; isLoading: boolean }) {
  const t = useTranslations('rankings');
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/10 overflow-hidden">
      <div
        className="px-4 py-3 text-xs font-bold uppercase tracking-widest border-b border-white/10"
        style={{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)' }}
      >
        {title}
      </div>
      <div
        className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b border-white/5"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--color-text-secondary)', gridTemplateColumns: '24px 32px 1fr auto', gap: '12px' }}
      >
        <span>#</span>
        <span />
        <span>{t('athlete')}</span>
        <span>{t('country')}</span>
      </div>

      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 animate-pulse">
            <div className="w-6 h-4 bg-white/10 rounded" />
            <div className="w-8 h-8 bg-white/10 rounded-full" />
            <div className="flex-1 h-4 bg-white/10 rounded" />
            <div className="w-12 h-4 bg-white/10 rounded" />
          </div>
        ))
      ) : entries.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('no_results')}
        </div>
      ) : (
        entries.map((entry, idx) => (
          <AthleteRow key={entry.id} entry={entry} rank={idx + 1} />
        ))
      )}
    </div>
  );
}

type View = 'world' | 'armenia';

export function SportRankingsClient({ sport, locale }: { sport: string; locale: string }) {
  const t = useTranslations('rankings');
  const [view, setView] = useState<View>('world');
  const [selectedWeight, setSelectedWeight] = useState('115+');

  const params = { sport, weightCategory: selectedWeight, limit: 20 };

  const worldRight = useWorldRankings({ ...params, hand: 'right' });
  const worldLeft  = useWorldRankings({ ...params, hand: 'left' });
  const armRight   = useWorldRankings({ ...params, hand: 'right', country: 'AM' });
  const armLeft    = useWorldRankings({ ...params, hand: 'left',  country: 'AM' });

  const rightEntries = view === 'world' ? worldRight.data?.data ?? [] : armRight.data?.data ?? [];
  const leftEntries  = view === 'world' ? worldLeft.data?.data  ?? [] : armLeft.data?.data  ?? [];
  const isLoading    = view === 'world' ? worldRight.isLoading : armRight.isLoading;

  const selectedCat = WEIGHT_CATEGORIES.find((c) => c.key === selectedWeight)!;
  const catLabel = locale === 'ru' ? selectedCat.labelRu : selectedCat.labelEn;

  return (
    <div className="flex min-h-[600px]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/10 py-6 px-3">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4 px-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('weight_division')}
        </p>
        <nav className="space-y-1">
          {WEIGHT_CATEGORIES.map((cat) => {
            const isActive = cat.key === selectedWeight;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedWeight(cat.key)}
                className="w-full text-left px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-between"
                style={
                  isActive
                    ? { backgroundColor: 'var(--color-secondary)', color: 'white', borderLeft: '3px solid var(--color-primary)' }
                    : { color: 'rgba(255,255,255,0.35)' }
                }
              >
                <span>{cat.labelEn}</span>
                {isActive && <span style={{ color: 'var(--color-primary)' }}>⚡</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 px-6 py-6">
        {/* View tabs */}
        <div className="flex gap-2 mb-6">
          {(['world', 'armenia'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={
                view === v
                  ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              {v === 'world' ? t('world_title') : t('armenia')}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-black uppercase text-white">
            {view === 'world' ? t('world_title') : t('armenia')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-primary)' }}>
            {catLabel} ({selectedCat.sub})
          </p>
        </div>

        {view === 'armenia' ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('no_results')}
          </div>
        ) : (
          <div className="flex gap-4">
            <HandColumn title={t('right_hand')} entries={rightEntries} isLoading={isLoading} />
            <HandColumn title={t('left_hand')}  entries={leftEntries}  isLoading={worldLeft.isLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
