import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse, Tournament } from '@/types/api';

interface TournamentsParams {
  sport?: string;
  status?: string;
  country?: string;
  page?: number;
  limit?: number;
}

export function useTournaments(params: TournamentsParams = {}) {
  return useQuery<PaginatedResponse<Tournament>>({
    queryKey: ['tournaments', params],
    queryFn: () => api.get('/tournaments', { params }).then((r: { data: any }) => r.data),
  });
}

export function useTournament(slug: string) {
  return useQuery<Tournament>({
    queryKey: ['tournament', slug],
    queryFn: () => api.get(`/tournaments/${slug}`).then((r: { data: any }) => r.data),
    enabled: !!slug,
  });
}
