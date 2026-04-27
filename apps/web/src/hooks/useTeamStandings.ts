'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TeamStandingsResponse } from '@/types/api';

/**
 * Public country-level team leaderboard for a tournament. Polled every
 * 30s so spectator and federation displays catch newly-recorded match
 * results without a manual refresh — the same cadence used by the
 * arena display polling brackets. Cache is also invalidated on window
 * focus because the leaderboard shifts whenever a final is decided
 * and stale data is actively misleading.
 */
export function useTeamStandings(tournamentId: string) {
  return useQuery<TeamStandingsResponse>({
    queryKey: ['team-standings', tournamentId],
    queryFn: () =>
      api.get(`/tournaments/${tournamentId}/team-standings`).then((r) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
