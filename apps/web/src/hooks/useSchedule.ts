'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TournamentSchedule, TournamentTable } from '@/types/api';

/**
 * Public per-tournament schedule — ETA + table assignment for every pending
 * match. Polled every 15s so an operator sees the queue drift forward
 * without a manual refresh. Cache is invalidated by the operator's own
 * mutations (claim / record / withdraw) via the existing invalidators in
 * `useOperator.ts`, and by the arena display on its own timer.
 */
/** Public list of all tables in a tournament. */
export function useTournamentTables(tournamentId: string) {
  return useQuery<TournamentTable[]>({
    queryKey: ['tournament-tables', tournamentId],
    queryFn: () =>
      api.get(`/tournaments/${tournamentId}/tables`).then((r: any) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 15_000,
  });
}

export function useTournamentSchedule(tournamentId: string) {
  return useQuery<TournamentSchedule>({
    queryKey: ['schedule', tournamentId],
    queryFn: () =>
      api.get(`/tournaments/${tournamentId}/schedule`).then((r: any) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 15_000,
    // Schedule shifts whenever a match completes — stale data is actively
    // misleading, so refetch on window focus.
    refetchOnWindowFocus: true,
  });
}
