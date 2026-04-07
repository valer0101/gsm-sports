'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tournament, Bracket } from '@/types/api';

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

export function useRecordResult(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, winnerId }: { matchId: string; winnerId: string }) =>
      api
        .post(`/operator/brackets/${bracketId}/result`, { matchId, winnerId })
        .then((r: any) => r.data),
    onSuccess: (data: Bracket) => {
      qc.invalidateQueries({ queryKey: ['operator', 'brackets'] });
      qc.invalidateQueries({ queryKey: ['brackets', data.tournamentId] });
    },
  });
}
