'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  getRoundRobinStandings,
  getSwissStandings,
  type BracketData as EngineBracketData,
} from '@gsm/bracket-engine';
import { Avatar } from '@/components/Avatar';
import type { BracketData } from '@/types/api';

/**
 * Public standings table for any non-elimination format. Pure read —
 * runs the engine's per-format helper on the bracketData blob and
 * renders a small table sorted by W-L (competition ranking; ties share
 * the same `position`).
 *
 * Returns `null` for elimination brackets and for round_robin / swiss
 * with no players, so callers can drop it in unconditionally.
 */
export function StandingsTable({ data }: { data: BracketData }) {
  const t = useTranslations('standings');

  const standings = useMemo(() => {
    const engineData = data as unknown as EngineBracketData;
    if (data.format === 'round_robin') return getRoundRobinStandings(engineData);
    if (data.format === 'swiss') return getSwissStandings(engineData);
    return [];
  }, [data]);

  if (data.format !== 'round_robin' && data.format !== 'swiss') return null;
  if (standings.length === 0) return null;

  // Look up photoUrl from `data.players` for the avatar column. The
  // standings rows don't carry it (engine type stays display-light).
  const playerById = new Map(data.players.map((p) => [p.id, p]));

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div
        className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest"
        style={{
          backgroundColor: 'var(--color-secondary)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {t('title')}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--color-text-secondary)' }}>
            <th className="text-left px-3 py-2 font-medium text-xs">{t('col_position')}</th>
            <th className="text-left px-2 py-2 font-medium text-xs">{t('col_athlete')}</th>
            <th className="text-center px-2 py-2 font-medium text-xs">{t('col_played')}</th>
            <th className="text-center px-2 py-2 font-medium text-xs">{t('col_wins')}</th>
            <th className="text-center px-2 py-2 font-medium text-xs">{t('col_losses')}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const player = playerById.get(row.playerId);
            const isLeader = row.position === 1;
            return (
              <tr
                key={row.playerId}
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
                <td className="px-2 py-2 text-white">
                  <span className="flex items-center gap-2">
                    <Avatar
                      src={player?.photoUrl}
                      firstName={row.firstName}
                      lastName={row.lastName}
                      size={22}
                    />
                    <span className="truncate">
                      {`${row.firstName} ${row.lastName}`.trim()}
                    </span>
                  </span>
                </td>
                <td
                  className="px-2 py-2 text-center font-mono text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {row.played}
                </td>
                <td className="px-2 py-2 text-center font-mono text-xs text-white">
                  {row.wins}
                </td>
                <td className="px-2 py-2 text-center font-mono text-xs text-white">
                  {row.losses}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
