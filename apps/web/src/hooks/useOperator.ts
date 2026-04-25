'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Tournament,
  Bracket,
  PendingMatchesByBracket,
  OperatorMyTable,
  MatchTableAssignment,
} from '@/types/api';

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
      api.patch(`/brackets/${bracketId}/withdraw-player`, payload).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'pending-matches', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'my-table', tournamentId] });
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

export function useOperatorMyTable(tournamentId: string) {
  return useQuery<OperatorMyTable | null>({
    queryKey: ['operator', 'my-table', tournamentId],
    queryFn: () =>
      api.get(`/operator/tournaments/${tournamentId}/my-table`).then((r: any) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 15_000,
  });
}

export function useOperatorClaimNext(tournamentId: string, tableId: string) {
  const qc = useQueryClient();
  return useMutation<MatchTableAssignment>({
    mutationFn: () =>
      api
        .post(`/operator/tournaments/${tournamentId}/tables/${tableId}/claim-next`)
        .then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator', 'my-table', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'pending-matches', tournamentId] });
      qc.invalidateQueries({ queryKey: ['operator', 'brackets', tournamentId] });
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] });
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
      result,
    }: {
      matchId: string;
      winnerId: string;
      notes?: string;
      /**
       * Sport-specific result detail (Phase 3.2). Omit to preserve any
       * prior payload on a correction; send `null` to clear; send an
       * object matching the tournament's `MatchResultSchema` to record.
       */
      result?: Record<string, unknown> | null;
    }) =>
      api
        .post(`/operator/brackets/${bracketId}/result`, {
          matchId,
          winnerId,
          notes,
          result,
        })
        .then((r: any) => r.data),
    onSuccess: (data: Bracket) => {
      qc.invalidateQueries({ queryKey: ['operator', 'brackets'] });
      qc.invalidateQueries({ queryKey: ['operator', 'pending-matches'] });
      qc.invalidateQueries({ queryKey: ['operator', 'my-table', data.tournamentId] });
      qc.invalidateQueries({ queryKey: ['schedule', data.tournamentId] });
      qc.invalidateQueries({ queryKey: ['brackets', data.tournamentId] });
    },
  });
}
