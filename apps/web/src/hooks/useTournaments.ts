import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PaginatedResponse,
  Tournament,
  TournamentEntry,
  Bracket,
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
  hand: 'left' | 'right';
  weightKg: number;
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
