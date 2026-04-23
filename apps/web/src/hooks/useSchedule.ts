'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TournamentSchedule } from '@/types/api';

/**
 * Public per-tournament schedule — ETA + table assignment for every pending
 * match. Polled every 15s so an operator sees the queue drift forward
 * without a manual refresh. Cache is invalidated by the operator's own
 * mutations (claim / record / withdraw) via the existing invalidators in
 * `useOperator.ts`, and by the arena display on its own timer.
 */
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
