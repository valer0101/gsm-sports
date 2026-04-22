'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tournament, Bracket, PendingMatchesByBracket } from '@/types/api';

export function useOperatorTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['operator', 'tournaments'],
    queryFn: () => api.get('/operator/tournaments').then((r: any) => r.data),
  });
}

export function useOperatorBrackets(tournamentId: string) {
  return useQuery<Bracket[]>({
    queryKey: ['operator', 'brackets', tournamentId],
    queryFn: () =>
      api.get(`/operator/tournaments/${tournamentId}/brackets`).then((r: any) => r.data),
    enabled: !!tournamentId,
  });
}

export function useOperatorPendingMatches(tournamentId: string) {
  return useQuery<PendingMatchesByBracket[]>({
    queryKey: ['operator', 'pending-matches', tournamentId],
    queryFn: () =>
      api.get(`/operator/tournaments/${tournamentId}/pending-matches`).then((r: any) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 15_000,
  });
}

export function useOperatorWithdrawPlayer(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { matchId: string; position: 1 | 2; reason: string }) =>
      api
        .patch(`/brackets/${bracketId}/matches/${payload.matchId}/withdraw-player`, {
          position: payload.position,
          reason: payload.reason,
        })
        .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'pending-matches', tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

export function useRecordResult(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId,
      winnerId,
      notes,
    }: {
      matchId: string;
      winnerId: string;
      notes?: string;
    }) =>
      api
        .post(`/operator/brackets/${bracketId}/result`, { matchId, winnerId, notes })
        .then((r: any) => r.data),
    onSuccess: (data: Bracket) => {
      qc.invalidateQueries({ queryKey: ['operator', 'brackets'] });
      qc.invalidateQueries({ queryKey: ['operator', 'pending-matches'] });
      qc.invalidateQueries({ queryKey: ['brackets', data.tournamentId] });
    },
  });
}
