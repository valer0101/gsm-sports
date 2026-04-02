import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse, Athlete } from '@/types/api';

interface AthletesParams {
  sport?: string;
  country?: string;
  gender?: string;
  hand?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useAthletes(
  params: AthletesParams = {},
  options?: { initialData?: PaginatedResponse<Athlete> },
) {
  return useQuery<PaginatedResponse<Athlete>>({
    queryKey: ['athletes', params],
    queryFn: () => api.get('/athletes', { params }).then((r: { data: any }) => r.data),
    initialData: options?.initialData,
  });
}

export function useAthlete(slug: string) {
  return useQuery<Athlete>({
    queryKey: ['athlete', slug],
    queryFn: () => api.get(`/athletes/${slug}`).then((r: { data: any }) => r.data),
    enabled: !!slug,
  });
}
