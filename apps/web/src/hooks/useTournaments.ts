import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PaginatedResponse,
  Tournament,
  TournamentEntry,
  Bracket,
  BracketAuditLog,
  PendingMatchesByBracket,
  AgeGroup,
} from '@/types/api';

interface TournamentsParams {
  sport?: string;
  status?: string;
  country?: string;
  page?: number;
  limit?: number;
}

export function useTournaments(
  params: TournamentsParams = {},
  options?: { initialData?: PaginatedResponse<Tournament> },
) {
  return useQuery<PaginatedResponse<Tournament>>({
    queryKey: ['tournaments', params],
    queryFn: () => api.get('/tournaments', { params }).then((r: { data: any }) => r.data),
    initialData: options?.initialData,
  });
}

export function useTournament(slug: string) {
  return useQuery<Tournament>({
    queryKey: ['tournament', slug],
    queryFn: () => api.get(`/tournaments/${slug}`).then((r: { data: any }) => r.data),
    enabled: !!slug,
  });
}

interface RegistrationsParams {
  ageGroup?: string;
  hand?: string;
  page?: number;
  limit?: number;
}

export function useRegistrations(tournamentId: string, params: RegistrationsParams = {}) {
  return useQuery<PaginatedResponse<TournamentEntry>>({
    queryKey: ['registrations', tournamentId, params],
    queryFn: () =>
      api
        .get(`/tournaments/${tournamentId}/registrations`, { params })
        .then((r: { data: any }) => r.data),
    enabled: !!tournamentId,
  });
}

export function useBrackets(tournamentId: string) {
  return useQuery<Bracket[]>({
    queryKey: ['brackets', tournamentId],
    queryFn: () =>
      api.get(`/brackets/tournament/${tournamentId}`).then((r: { data: any }) => r.data),
    enabled: !!tournamentId,
  });
}

interface RegisterPayload {
  ageGroup: AgeGroup;
  hand?: 'left' | 'right';
  weightKg?: number;
  notes?: string;
}

export function useRegister(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      api
        .post(`/tournaments/${tournamentId}/registrations`, payload)
        .then((r: { data: any }) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', tournamentId] });
    },
  });
}

export function useCancelRegistration(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.delete(`/tournaments/${tournamentId}/registrations/${entryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', tournamentId] });
    },
  });
}

// ─── Bracket management hooks ─────────────────────────────

/** Record or correct a match result */
export function useRecordResult(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      matchId: string;
      winnerId: string;
      notes?: string;
      forceCorrect?: boolean;
    }) => api.patch(`/brackets/${bracketId}/result`, payload).then((r: { data: any }) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

/** Reset a single match and all downstream results */
export function useResetMatch(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { matchId: string; reason?: string }) =>
      api.patch(`/brackets/${bracketId}/match-reset`, payload).then((r: { data: any }) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

/** Reset entire bracket */
export function useResetBracket(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/brackets/${bracketId}/reset`).then((r: { data: any }) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

/** Lock / unlock a bracket */
export function useLockBracket(bracketId: string, tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lock: boolean) =>
      api
        .patch(`/brackets/${bracketId}/${lock ? 'lock' : 'unlock'}`)
        .then((r: { data: any }) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', tournamentId] });
    },
  });
}

/** Audit log for a bracket */
export function useBracketAuditLog(bracketId: string) {
  return useQuery<BracketAuditLog[]>({
    queryKey: ['bracket-audit', bracketId],
    queryFn: () => api.get(`/brackets/${bracketId}/audit`).then((r: { data: any }) => r.data),
    enabled: !!bracketId,
  });
}

// ─── Operator hooks ───────────────────────────────────────

/** Pending matches for operator — grouped by bracket */
export function usePendingMatches(tournamentId: string) {
  return useQuery<PendingMatchesByBracket[]>({
    queryKey: ['operator', 'pending-matches', tournamentId],
    queryFn: () =>
      api
        .get(`/operator/tournaments/${tournamentId}/pending-matches`)
        .then((r: { data: any }) => r.data),
    enabled: !!tournamentId,
    refetchInterval: 15_000, // refresh every 15s in case of updates
  });
}
