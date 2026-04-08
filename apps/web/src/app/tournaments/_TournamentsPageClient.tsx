'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { TournamentCardSkeleton } from '@/components/ui/Skeleton';
import { useTournaments } from '@/hooks/useTournaments';
import type { PaginatedResponse, Tournament } from '@/types/api';

const UPCOMING_STATUSES = new Set([
  'draft',
  'upcoming',
  'registration_open',
  'registration_closed',
  'bracket_ready',
]);

type Tab = 'all' | 'upcoming' | 'active' | 'completed';

interface SectionProps {
  title: string;
  accentColor: string;
  badge?: string;
  tournaments: Tournament[];
}

function TournamentSection({ title, accentColor, badge, tournaments }: SectionProps) {
  if (tournaments.length === 0) return null;
  return (
    <div className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        <h2 className="text-2xl font-black uppercase tracking-wide text-white">{title}</h2>
        {badge && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor + '30', color: accentColor }}
          >
            {badge}
          </span>
        )}
        <span
          className="ml-2 text-sm font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
        >
          {tournaments.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  initialData?: PaginatedResponse<Tournament>;
  sport?: string;
}

export function TournamentsPageClient({ initialData, sport }: Props) {
  const tTournaments = useTranslations('tournaments');
  const tCommon = useTranslations('common');

  const [activeTab, setActiveTab] = useState<Tab>('all');

  const { data, isLoading, isError } = useTournaments({ sport, limit: 100 }, { initialData });

  const all = data?.data ?? [];
  const active = all.filter((t) => t.status === 'active');
  const upcoming = all.filter((t) => UPCOMING_STATUSES.has(t.status));
  const completed = all.filter((t) => t.status === 'completed');

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'all', label: tCommon('all'), count: all.length, color: 'var(--color-primary)' },
    { key: 'active', label: tTournaments('active'), count: active.length, color: '#ef4444' },
    {
      key: 'upcoming',
      label: tTournaments('upcoming'),
      count: upcoming.length,
      color: 'var(--color-primary)',
    },
    {
      key: 'completed',
      label: tTournaments('completed'),
      count: completed.length,
      color: '#6b7280',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">{tTournaments('title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {tTournaments('subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-10 flex-wrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={
                isActive
                  ? { backgroundColor: tab.color, color: tab.key === 'all' ? 'black' : 'white' }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              {tab.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={
                  isActive
                    ? { backgroundColor: 'rgba(0,0,0,0.2)', color: 'inherit' }
                    : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                }
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isError ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
          {tCommon('error')}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TournamentCardSkeleton key={i} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
          {tTournaments('no_results')}
        </div>
      ) : activeTab === 'all' ? (
        <>
          <TournamentSection
            title={tTournaments('active')}
            accentColor="#ef4444"
            badge="LIVE"
            tournaments={active}
          />
          <TournamentSection
            title={tTournaments('upcoming')}
            accentColor="var(--color-primary)"
            tournaments={upcoming}
          />
          <TournamentSection
            title={tTournaments('completed')}
            accentColor="#6b7280"
            tournaments={completed}
          />
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(activeTab === 'active' ? active : activeTab === 'upcoming' ? upcoming : completed)
            .length === 0 ? (
            <div
              className="col-span-full text-center py-16"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {tTournaments('no_results')}
            </div>
          ) : (
            (activeTab === 'active' ? active : activeTab === 'upcoming' ? upcoming : completed).map(
              (tournament) => <TournamentCard key={tournament.id} tournament={tournament} />,
            )
          )}
        </div>
      )}
    </div>
  );
}
