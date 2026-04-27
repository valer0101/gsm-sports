'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTeamStandings } from '@/hooks/useTeamStandings';
import type { TeamStandingsRow } from '@/types/api';
import { CountryLabel } from '@/components/ui/CountryLabel';

/**
 * Country-level leaderboard for a tournament (Phase 3.4). Data comes
 * from the public `GET /v1/tournaments/:id/team-standings` endpoint —
 * `useTeamStandings` polls it every 30s and on window focus so this
 * view stays fresh on a federation projector without manual refresh.
 *
 * Each row shows the country, total points, the count of distinct
 * athletes who scored at least once, and a medal-count summary derived
 * from the breakdown. The summary is rendered as positions explicitly
 * because the configurable scoring scheme means "gold/silver/bronze"
 * doesn't always correspond to 1/2/3 — a 5-tier scheme would still
 * map cleanly here.
 */
export function TeamStandingsTable({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('teamStandings');
  const { data, isLoading, isError } = useTeamStandings(tournamentId);

  // Sorted positions (1-based) from `pointsByPlace`. Stable across
  // renders, used for the legend and to drive the per-row tally.
  const positions = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.pointsByPlace)
      .map((k) => Number(k))
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
  }, [data]);

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border border-white/10 p-6 text-sm text-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('loading')}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="rounded-2xl border border-white/10 p-6 text-sm text-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('error')}
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div
        className="rounded-2xl border border-white/10 p-6 text-sm text-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('empty_state')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div
          className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--color-secondary)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>{t('title')}</span>
          <Legend pointsByPlace={data.pointsByPlace} positions={positions} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)' }}>
              <th className="text-left px-3 py-2 font-medium text-xs">{t('col_position')}</th>
              <th className="text-left px-2 py-2 font-medium text-xs">{t('col_team')}</th>
              <th className="text-center px-2 py-2 font-medium text-xs">{t('col_points')}</th>
              <th className="text-center px-2 py-2 font-medium text-xs whitespace-nowrap">
                {t('col_athletes_scoring')}
              </th>
              <th className="text-left px-2 py-2 font-medium text-xs">{t('col_medals')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <TeamRow key={row.team} row={row} positions={positions} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamRow({
  row,
  positions,
  t,
}: {
  row: TeamStandingsRow;
  positions: number[];
  t: ReturnType<typeof useTranslations>;
}) {
  const isLeader = row.position === 1;

  // Tally placements per position so the row can show "🥇1 🥈1 🥉2"
  // without re-iterating in render. Pre-computed once.
  const countByPosition = useMemo(() => {
    const m = new Map<number, number>();
    for (const item of row.breakdown) {
      m.set(item.placement, (m.get(item.placement) ?? 0) + 1);
    }
    return m;
  }, [row.breakdown]);

  return (
    <tr
      className="border-t border-white/5"
      style={{
        backgroundColor: isLeader ? 'rgba(34,197,94,0.06)' : 'transparent',
      }}
    >
      <td
        className="px-3 py-2 font-mono text-xs"
        style={{
          color: isLeader ? '#86efac' : 'var(--color-text-secondary)',
          fontWeight: isLeader ? 700 : 400,
        }}
      >
        {row.position}
      </td>
      <td className="px-2 py-2 text-white font-bold tracking-wide">
        <CountryLabel value={row.team} />
      </td>
      <td className="px-2 py-2 text-center font-mono text-white">{row.points}</td>
      <td
        className="px-2 py-2 text-center font-mono text-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {row.athletesScoring}
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {positions.map((p) => {
            const n = countByPosition.get(p);
            if (!n) return null;
            return (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10"
                style={{ color: 'var(--color-text-secondary)' }}
                title={t('medal_tooltip', { place: p, count: n })}
              >
                <PlaceIcon place={p} />
                <span className="font-mono">{n}</span>
              </span>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function Legend({
  pointsByPlace,
  positions,
}: {
  pointsByPlace: Record<number, number>;
  positions: number[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 normal-case tracking-normal text-[11px] font-normal">
      {positions.map((p) => (
        <span
          key={p}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <PlaceIcon place={p} />
          <span className="font-mono">{pointsByPlace[p]}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Render an icon for a 1-based finishing position. Top three get the
 * familiar medal emojis; further places fall back to "Nth" text so the
 * UI stays accurate for arbitrarily-deep `pointsByPlace` schemes (e.g.
 * Olympic 1-8). Avoids assuming gold/silver/bronze map to 1/2/3 in
 * exotic scoring schemes by reading directly from the place number.
 */
function PlaceIcon({ place }: { place: number }) {
  if (place === 1) return <span aria-hidden>🥇</span>;
  if (place === 2) return <span aria-hidden>🥈</span>;
  if (place === 3) return <span aria-hidden>🥉</span>;
  return (
    <span className="font-mono text-[10px]" aria-hidden>
      {place}
    </span>
  );
}
