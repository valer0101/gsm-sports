'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Sport } from '@/types/api';

/**
 * Sports list. Same query key as elsewhere in the app — React Query
 * dedupes the request, so SportSelect and the orchestrator share one
 * cache entry.
 */
export function useSports() {
  return useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: async () => {
      const res = await api.get('/sports?limit=100');
      // The endpoint returns either an array or `{ data: Sport[], meta }` —
      // the existing /new form handles both, mirror that.
      const body = res.data;
      return Array.isArray(body) ? body : (body?.data ?? []);
    },
    staleTime: 5 * 60_000,
  });
}

export function pickSportName(s: Sport | undefined): string {
  if (!s) return '';
  return s.nameRu || s.nameEn || s.nameHy || s.slug;
}

export function pickSportEmoji(slug: string | undefined): string {
  // Existing project has no per-sport emoji on the entity; pick a sensible
  // default by slug. Falls back to a generic icon for unknown sports.
  switch (slug) {
    case 'armwrestling': return '💪';
    case 'mma': return '🥋';
    case 'boxing': return '🥊';
    case 'wrestling': return '🤼';
    case 'kickboxing': return '🦵';
    default: return '🏆';
  }
}
