import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse, RankingEntry } from '@/types/api';

interface RankingsParams {
  sport?: string;
  sportId?: number;
  season?: number;
  hand?: string;
  gender?: string;
  weightCategory?: string;
  country?: string;
  page?: number;
  limit?: number;
}

export function useWorldRankings(
  params: RankingsParams = {},
  options?: { initialData?: PaginatedResponse<RankingEntry> },
) {
  return useQuery<PaginatedResponse<RankingEntry>>({
    queryKey: ['rankings', 'world', params],
    queryFn: () => api.get('/rankings/world', { params }).then((r: { data: any }) => r.data),
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
    staleTime: 60_000,
  });
}

export function useCountryRankings(country: string, params: RankingsParams = {}) {
  return useQuery<PaginatedResponse<RankingEntry>>({
    queryKey: ['rankings', 'country', country, params],
    queryFn: () =>
      api.get(`/rankings/country/${country}`, { params }).then((r: { data: any }) => r.data),
    enabled: !!country,
  });
}
