'use client';

import { useTranslations } from 'next-intl';
import { useTournamentSchedule, useTournamentTables } from '@/hooks/useSchedule';
import { useBrackets } from '@/hooks/useTournaments';
import type {
  Tournament,
  TournamentTable,
  Bracket,
  BracketMatch,
  BracketPlayer,
  ScheduledMatch,
} from '@/types/api';

interface ResolvedMatch {
  match: BracketMatch;
  bracketName: string | null;
}

/**
 * Build a flat `matchId -> {match, bracketName}` map from all brackets so
 * the arena can resolve a claimed/scheduled match id back into the two
 * players by name.
 */
function indexMatches(brackets: Bracket[] | undefined): Map<string, ResolvedMatch> {
  const map = new Map<string, ResolvedMatch>();
  if (!brackets) return map;

  for (const b of brackets) {
    if (!b.bracketData) continue;
    const add = (m: BracketMatch | undefined) => {
      if (!m?.id) return;
      map.set(m.id, { match: m, bracketName: b.weightCategory?.name ?? b.name ?? null });
    };
    b.bracketData.winnersBracket.forEach((round) => round.forEach(add));
    b.bracketData.losersBracket.forEach((round) => round.forEach(add));
    add(b.bracketData.grandFinal);
    if (b.bracketData.superFinal?.needed) add(b.bracketData.superFinal);
  }
  return map;
}

function playerLabel(p: BracketPlayer | undefined): string {
  if (!p) return '';
  if (!p.id || p.id === 'tbd' || p.id === 'bye') return '';
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
}

export function ArenaDisplay({ tournament }: { tournament: Tournament }) {
  const t = useTranslations('arena');
  const { data: tables } = useTournamentTables(tournament.id);
  const { data: schedule } = useTournamentSchedule(tournament.id);
  const { data: brackets } = useBrackets(tournament.id);

  const matchIndex = indexMatches(brackets);

  // Which scheduled matches are the "queue" — cap at 12 so projector stays
  // legible. Pinned matches sorted by `order` already by the server.
  const upcoming = (schedule?.scheduled ?? []).slice(0, 12);

  // Current running match per table = scheduled entry whose estimatedStartAt
  // is in the past AND the table's status is busy. Simpler heuristic: map
  // tableId → first scheduled entry for that table that has started.
  const runningByTableId = new Map<string, ScheduledMatch>();
  const nowMs = Date.now();
  for (const s of schedule?.scheduled ?? []) {
    if (s.estimatedStartAt <= nowMs && !runningByTableId.has(s.tableId)) {
      runningByTableId.set(s.tableId, s);
    }
  }

  const tablesSorted = (tables ?? []).slice().sort((a, b) => a.number - b.number);
  const tableCols =
    tablesSorted.length <= 2 ? 'grid-cols-1 sm:grid-cols-2'
    : tablesSorted.length <= 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p
              className="text-sm uppercase tracking-widest mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('label')}
            </p>
            <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
              {tournament.name}
            </h1>
          </div>
          {tournament.isLive && (
            <span className="px-4 py-2 rounded-full text-sm font-black bg-red-500/20 text-red-300 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
              {t('live')}
            </span>
          )}
        </div>

        {/* Tables grid */}
        {tablesSorted.length === 0 ? (
          <div className="text-center py-20 text-white/40 text-2xl">{t('no_tables')}</div>
        ) : (
          <div className={`grid ${tableCols} gap-4 mb-8`}>
            {tablesSorted.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                running={runningByTableId.get(table.id) ?? null}
                matchIndex={matchIndex}
                labels={{
                  idle: t('table_idle'),
                  busy: t('table_busy'),
                  offline: t('table_offline'),
                  tableNumber: (n: number) => t('table_number', { n }),
                  vs: t('vs'),
                  waiting: t('waiting'),
                }}
              />
            ))}
          </div>
        )}

        {/* Upcoming queue */}
        <div
          className="rounded-2xl border border-white/10 p-5"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <h2 className="text-xl sm:text-2xl font-black text-white mb-3">{t('upcoming_title')}</h2>
          {upcoming.length === 0 ? (
            <p className="text-white/40">{t('no_upcoming')}</p>
          ) : (
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {upcoming.map((s) => (
                <QueueItem
                  key={s.matchId}
                  scheduled={s}
                  matchIndex={matchIndex}
                  tableNumberById={new Map(tablesSorted.map((x) => [x.id, x.number]))}
                  vsLabel={t('vs')}
                  tableLabel={(n: number) => t('table_number', { n })}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function TableCard({
  table,
  running,
  matchIndex,
  labels,
}: {
  table: TournamentTable;
  running: ScheduledMatch | null;
  matchIndex: Map<string, ResolvedMatch>;
  labels: {
    idle: string;
    busy: string;
    offline: string;
    tableNumber: (n: number) => string;
    vs: string;
    waiting: string;
  };
}) {
  const resolved = running ? matchIndex.get(running.matchId) : null;
  const p1 = resolved?.match.player1;
  const p2 = resolved?.match.player2;

  const statusColor =
    table.status === 'busy' ? 'var(--color-accent)'
    : table.status === 'offline' ? '#6b7280'
    : '#10b981';
  const statusLabel =
    table.status === 'busy' ? labels.busy
    : table.status === 'offline' ? labels.offline
    : labels.idle;

  return (
    <div
      className="rounded-2xl border p-5 min-h-[220px] flex flex-col"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: table.status === 'busy' ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-black text-white text-xl sm:text-2xl">
          {labels.tableNumber(table.number)}
          {table.name ? <span className="text-white/50 text-base ml-2 font-semibold">· {table.name}</span> : null}
        </p>
        <span
          className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{ color: statusColor, backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          {statusLabel}
        </span>
      </div>

      {table.status === 'busy' && p1 && p2 ? (
        <div className="flex-1 flex flex-col justify-center text-center">
          <p className="text-2xl sm:text-3xl font-black text-white leading-tight">{playerLabel(p1)}</p>
          <p
            className="text-sm uppercase tracking-widest my-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {labels.vs}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white leading-tight">{playerLabel(p2)}</p>
          {resolved?.bracketName && (
            <p
              className="text-xs mt-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {resolved.bracketName}
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40 text-xl">{labels.waiting}</p>
        </div>
      )}
    </div>
  );
}

function QueueItem({
  scheduled,
  matchIndex,
  tableNumberById,
  vsLabel,
  tableLabel,
}: {
  scheduled: ScheduledMatch;
  matchIndex: Map<string, ResolvedMatch>;
  tableNumberById: Map<string, number>;
  vsLabel: string;
  tableLabel: (n: number) => string;
}) {
  const resolved = matchIndex.get(scheduled.matchId);
  const p1 = playerLabel(resolved?.match.player1);
  const p2 = playerLabel(resolved?.match.player2);
  const tableNumber = tableNumberById.get(scheduled.tableId);
  const nowMs = Date.now();
  const diffMin = Math.max(0, Math.round((scheduled.estimatedStartAt - nowMs) / 60000));

  return (
    <li
      className="rounded-xl p-3 border border-white/10"
      style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
          #{scheduled.order} · {tableNumber !== undefined ? tableLabel(tableNumber) : ''}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-accent)' }}>
          {diffMin === 0 ? '—' : `~${diffMin} min`}
        </span>
      </div>
      <p className="text-white font-bold text-sm truncate">
        {p1 || '—'} <span className="text-white/40 mx-1">{vsLabel}</span> {p2 || '—'}
      </p>
      {resolved?.bracketName && (
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {resolved.bracketName}
        </p>
      )}
    </li>
  );
}
